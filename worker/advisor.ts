/**
 * المستشار الذكي: يمرّر أسئلة الإدارة مع ملخص أرقام المنظومة إلى Claude ويعيد الإجابة كبث مباشر.
 *
 * - مفتاح Anthropic محفوظ كسرّ في Cloudflare (ANTHROPIC_API_KEY) ولا يصل للمتصفح
 * - الملخص المرسل أرقام تجارية فقط (أبراج، باقات، أسعار، ديون...) بدون أسماء أو هواتف أو كلمات مرور
 * - الخادم لا يحلل البث (حد وقت المعالج في الخطة المجانية)، بل يمرره كما هو للمتصفح
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = 40;             // أسئلة لكل موظف في اليوم (للتحكم بالتكلفة)
const MAX_TURNS = 40;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 60_000;

const SYSTEM_PROMPT = `أنت المستشار التجاري الخبير لـ«شبكة أولاد كشيش»، مزود إنترنت لاسلكي صغير في قضاء الزبير بمحافظة البصرة في العراق.
تشتري الشبكة الاشتراكات بالجملة من مزودين رئيسيين (مثل إيرثلنك) وتبيعها للمشتركين عبر أبراج وسكترات لاسلكية تملكها، والعملة الدينار العراقي.

مهمتك أن تساعد صاحب الشبكة على تنمية العمل: التسويق وجذب مشتركين جدد، تسعير الباقات والزيادات والرسوم الإضافية، تقليل الديون والتأخير في الدفع، الاحتفاظ بالمشتركين، تقييم الأبراج (أيها يستحق التوسعة أو الصيانة أو التفكيك)، وأولويات الاستثمار.

مع كل سؤال تصلك «لقطة» من أرقام المنظومة الحالية. اعتمد عليها: احسب بالأرقام الفعلية واذكر الحسابات باختصار حتى يمكن التحقق منها. الأرقام المسماة «متوقعة» تفترض تجديد كل المشتركين غير الموقوفين، والمقبوض الفعلي موجود منفصلاً. إذا كانت البيانات ناقصة أو قديمة (مثلاً اشتراكات منتهية منذ فترة طويلة) فقل ذلك بوضوح واقترح ما يجب تسجيله في المنظومة ليصبح التحليل أدق.

ضع في الحسبان واقع السوق المحلي: الدفع النقدي وزين كاش وكي كارد، التواصل عبر واتساب، انقطاعات الكهرباء والمولدات، منافسة الفايبر (FTTH) والمزودين الآخرين في الزبير، والعلاقات الشخصية في الأحياء.

أعطِ توصيات عملية قابلة للتنفيذ هذا الأسبوع وهذا الشهر، مرتبة حسب الأثر المتوقع، مع المخاطر والبدائل عندما يكون القرار حساساً (مثل رفع الأسعار). كن صريحاً حتى لو كان الجواب غير مريح، ولا تخترع أرقاماً غير موجودة في اللقطة؛ وعند التقدير قل إنه تقدير.

أجب بلغة السؤال (العربية افتراضياً)، بعناوين قصيرة ونقاط واضحة، وبطول يناسب السؤال.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

class AdvisorError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function validate(body: any): { messages: ChatMessage[]; context: string } {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length || messages.length > MAX_TURNS) throw new AdvisorError(400, 'المحادثة فارغة أو طويلة جداً. ابدأ محادثة جديدة.');
  const clean: ChatMessage[] = messages.map((m: any) => {
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m?.content !== 'string' || !m.content.trim()) {
      throw new AdvisorError(400, 'رسالة غير صالحة.');
    }
    if (m.content.length > MAX_MESSAGE_CHARS) throw new AdvisorError(400, 'الرسالة طويلة جداً.');
    return { role: m.role, content: m.content };
  });
  if (clean[clean.length - 1].role !== 'user') throw new AdvisorError(400, 'آخر رسالة يجب أن تكون سؤالاً.');
  const context = typeof body?.context === 'string' ? body.context.slice(0, MAX_CONTEXT_CHARS) : '';
  return { messages: clean, context };
}

/** يحجز سؤالاً من حصة اليوم؛ يرفض عند تجاوز الحد */
async function reserveQuota(db: D1Database, userId: string): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const row = await db
    .prepare(`INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
              ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
              WHERE count < ?
              RETURNING count`)
    .bind(userId, day, DAILY_LIMIT)
    .first<{ count: number }>();
  if (!row) throw new AdvisorError(429, `تم استخدام الحد اليومي (${DAILY_LIMIT} سؤالاً). حاول غداً.`);
  return DAILY_LIMIT - row.count;
}

export async function handleAdvisorChat(
  req: Request,
  env: { DB: D1Database; ANTHROPIC_API_KEY?: string },
  user: { id: string; role: string },
): Promise<Response> {
  let reserved = false;
  try {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new AdvisorError(403, 'المستشار الذكي متاح للمدير والمحاسب فقط.');
    }
    if (!env.ANTHROPIC_API_KEY) {
      throw new AdvisorError(503, 'المستشار الذكي غير مفعّل بعد: يجب إضافة مفتاح ANTHROPIC_API_KEY في إعدادات Cloudflare.');
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new AdvisorError(400, 'طلب غير صالح.');
    }
    const { messages, context } = validate(body);
    const remaining = await reserveQuota(env.DB, user.id);
    reserved = true;

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    // asResponse(): البث الخام (SSE) يُمرَّر للمتصفح بدون تحليل داخل الخادم
    const upstream = await client.beta.messages
      .create({
        model: MODEL,
        max_tokens: 32_000,
        stream: true,
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort: 'high' },
        // عند رفض أمني نادر يعيد الخادم المحاولة تلقائياً على النموذج البديل الموصى به
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        cache_control: { type: 'ephemeral' },
        system: [
          { type: 'text', text: SYSTEM_PROMPT },
          { type: 'text', text: `لقطة أرقام المنظومة الآن:\n${context || '(لا توجد بيانات)'}` },
        ],
        messages,
      })
      .asResponse();

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        'x-advisor-remaining': String(remaining),
      },
    });
  } catch (err) {
    // فشل الطلب لا يُحسب من حصة اليوم
    if (reserved) {
      await env.DB.prepare(`UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ? AND count > 0`)
        .bind(user.id, new Date().toISOString().slice(0, 10)).run().catch(() => undefined);
    }
    if (err instanceof AdvisorError) return json({ error: err.message }, err.status);
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: 'مفتاح Anthropic غير صحيح. راجع ANTHROPIC_API_KEY في Cloudflare.' }, 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد دقيقة.' }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('advisor api error', err.status, err.message);
      return json({ error: `تعذر الاتصال بخدمة الذكاء الاصطناعي (${err.status ?? 'شبكة'}).` }, 502);
    }
    console.error('advisor error', err);
    return json({ error: 'خطأ داخلي في المستشار الذكي.' }, 500);
  }
}
