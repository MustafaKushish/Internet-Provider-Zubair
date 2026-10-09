/**
 * المستشار الذكي: يمرّر أسئلة الإدارة مع ملخص أرقام المنظومة إلى نموذج ذكاء اصطناعي ويعيد الإجابة كبث مباشر.
 *
 * المحركات (يختارها المدير):
 * - auto (افتراضي، مجاني): Google Gemini Flash، وعند تجاوز الحد المجاني أو تعطله → Cloudflare Workers AI
 * - gemini: Gemini ثم Workers AI كبديل
 * - workers: Cloudflare Workers AI فقط (بدون مفتاح، ضمن الحصة اليومية المجانية لحساب Cloudflare)
 * - claude: Claude Opus 5.5 (مدفوع حسب الاستخدام، أعلى جودة)
 *
 * - المفاتيح أسرار في Cloudflare (GEMINI_API_KEY, ANTHROPIC_API_KEY) ولا تصل للمتصفح
 * - الملخص المرسل أرقام تجارية فقط (أبراج، باقات، أسعار، ديون...) بدون أسماء أو هواتف أو كلمات مرور
 * - الخادم لا يحلل البث (حد وقت المعالج في الخطة المجانية)، بل يمرره كما هو للمتصفح
 */
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-opus-5-5';
// يمكن تغيير النماذج من إعدادات Cloudflare (متغيرات GEMINI_MODEL و WORKERS_AI_MODEL) دون تعديل الكود
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
const WORKERS_AI_MODELS = ['@cf/qwen/qwen3.8-27b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/openai/gpt-oss-120b'];
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

export type AdvisorProvider = 'auto' | 'gemini' | 'workers' | 'claude';

export interface AdvisorEnv {
  DB: D1Database;
  AI?: { run: (model: string, input: any) => Promise<any> };
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  WORKERS_AI_MODEL?: string;
}

/** فشل محرك واحد؛ يُجرَّب المحرك التالي */
class ProviderFailure extends Error {
  constructor(public provider: string, message: string, public status = 502) {
    super(message);
  }
}

function sseResponse(body: ReadableStream | null, provider: string, model: string, remaining: number) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-advisor-remaining': String(remaining),
      'x-advisor-provider': provider,
      'x-advisor-model': model,
      'access-control-expose-headers': 'x-advisor-remaining, x-advisor-provider, x-advisor-model',
    },
  });
}

function systemText(context: string) {
  return `${SYSTEM_PROMPT}\n\nلقطة أرقام المنظومة الآن:\n${context || '(لا توجد بيانات)'}`;
}

// ---------- Google Gemini ----------
async function runGemini(env: AdvisorEnv, messages: ChatMessage[], context: string) {
  if (!env.GEMINI_API_KEY) throw new ProviderFailure('gemini', 'مفتاح GEMINI_API_KEY غير مضبوط.', 503);
  const models = [env.GEMINI_MODEL, ...GEMINI_MODELS].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
  let last = '';
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText(context) }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: 8192 },
        }),
      },
    );
    if (res.ok && res.body) return { body: res.body, model };
    const detail = await res.text().catch(() => '');
    last = `${res.status} ${detail.slice(0, 200)}`;
    console.error('gemini failed', model, last);
    if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail)) {
      throw new ProviderFailure('gemini', 'مفتاح Gemini غير صحيح أو غير مفعّل.', 503);
    }
    if (res.status !== 404 && res.status !== 400) break; // 429/5xx: لا فائدة من نموذج آخر لدى Google، ننتقل لمحرك آخر
  }
  throw new ProviderFailure('gemini', `Gemini غير متاح الآن (${last.split(' ')[0]}).`);
}

// ---------- Cloudflare Workers AI ----------
async function runWorkersAI(env: AdvisorEnv, messages: ChatMessage[], context: string) {
  if (!env.AI) throw new ProviderFailure('workers', 'Workers AI غير مربوط بالخادم.', 503);
  const models = [env.WORKERS_AI_MODEL, ...WORKERS_AI_MODELS].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
  const chat = [{ role: 'system', content: systemText(context) }, ...messages];
  let last = '';
  for (const model of models) {
    try {
      const stream = await env.AI.run(model, { messages: chat, stream: true, max_tokens: 4096 });
      if (stream instanceof ReadableStream) return { body: stream, model };
      last = 'استجابة غير متوقعة';
    } catch (e) {
      last = (e as Error).message || String(e);
      console.error('workers ai failed', model, last);
      if (/neuron|limit|quota|429/i.test(last)) break; // انتهت الحصة اليومية المجانية
    }
  }
  const quota = /neuron|limit|quota|429/i.test(last);
  throw new ProviderFailure('workers', quota
    ? 'انتهت الحصة المجانية اليومية لـ Cloudflare AI. تتجدد يومياً (منتصف الليل UTC).'
    : 'Cloudflare AI غير متاح الآن.', quota ? 429 : 502);
}

// ---------- Anthropic Claude ----------
async function runClaude(env: AdvisorEnv, messages: ChatMessage[], context: string) {
  if (!env.ANTHROPIC_API_KEY) throw new ProviderFailure('claude', 'مفتاح ANTHROPIC_API_KEY غير مضبوط.', 503);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    // asResponse(): البث الخام (SSE) يُمرَّر للمتصفح بدون تحليل داخل الخادم
    const upstream = await client.beta.messages
      .create({
        model: CLAUDE_MODEL,
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
    return { body: upstream.body, model: CLAUDE_MODEL };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ProviderFailure('claude', 'مفتاح Anthropic غير صحيح.', 503);
    if (err instanceof Anthropic.RateLimitError) throw new ProviderFailure('claude', 'Claude مشغول الآن.', 429);
    if (err instanceof Anthropic.APIError) throw new ProviderFailure('claude', `تعذر الاتصال بـ Claude (${err.status ?? 'شبكة'}).`);
    throw err;
  }
}

const RUNNERS = { gemini: runGemini, workers: runWorkersAI, claude: runClaude } as const;

function providerChain(requested: AdvisorProvider, env: AdvisorEnv): (keyof typeof RUNNERS)[] {
  switch (requested) {
    case 'claude': return ['claude'];
    case 'workers': return ['workers'];
    case 'gemini': return ['gemini', 'workers'];
    default: return env.GEMINI_API_KEY ? ['gemini', 'workers'] : ['workers'];
  }
}

/** أي المحركات مضبوطة (لعرض الحالة في الإعدادات) */
export function advisorStatus(env: AdvisorEnv) {
  return { gemini: !!env.GEMINI_API_KEY, workers: !!env.AI, claude: !!env.ANTHROPIC_API_KEY };
}

export async function handleAdvisorChat(
  req: Request,
  env: AdvisorEnv,
  user: { id: string; role: string },
): Promise<Response> {
  let reserved = false;
  try {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new AdvisorError(403, 'المستشار الذكي متاح للمدير والمحاسب فقط.');
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new AdvisorError(400, 'طلب غير صالح.');
    }
    const { messages, context } = validate(body);
    const requested: AdvisorProvider = ['auto', 'gemini', 'workers', 'claude'].includes(body?.provider) ? body.provider : 'auto';
    const remaining = await reserveQuota(env.DB, user.id);
    reserved = true;

    const failures: ProviderFailure[] = [];
    for (const name of providerChain(requested, env)) {
      try {
        const out = await RUNNERS[name](env, messages, context);
        return sseResponse(out.body, name, out.model, remaining);
      } catch (e) {
        if (e instanceof ProviderFailure) failures.push(e);
        else { console.error('advisor provider crash', name, e); failures.push(new ProviderFailure(name, 'خطأ غير متوقع.')); }
      }
    }
    const status = failures.some(f => f.status === 429) ? 429 : failures.every(f => f.status === 503) ? 503 : 502;
    throw new AdvisorError(status, failures.map(f => f.message).join(' '));
  } catch (err) {
    // فشل الطلب لا يُحسب من حصة اليوم
    if (reserved) {
      await env.DB.prepare(`UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ? AND count > 0`)
        .bind(user.id, new Date().toISOString().slice(0, 10)).run().catch(() => undefined);
    }
    if (err instanceof AdvisorError) return json({ error: err.message }, err.status);
    console.error('advisor error', err);
    return json({ error: 'خطأ داخلي في المستشار الذكي.' }, 500);
  }
}
