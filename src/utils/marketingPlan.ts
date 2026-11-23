import { PaymentRecord, PlanItem } from '../types/isp';
import type { Promotion } from '../../shared/promotions';
import { toLocalDateStr, uid } from './dates';
import { addDays } from './marketing';

/**
 * خطة التسويق: مكتبة أفكار جاهزة (للقراءة)، مناسبات قادمة، وبنود الخطة. دوال صرفة بلا React.
 * البنود تُحفظ في settings.marketingPlan (يعدّلها المدير فقط، يقرؤها المكتب).
 */

export type IdeaKind = 'offer' | 'campaign' | 'program';
export type SegmentKey = NonNullable<PlanItem['segment']>;

export interface ActionIdea {
  id: string;
  title: string;
  kind: IdeaKind;
  goal: string;        // ماذا تحقق
  whenToUse: string;   // متى تستعملها
  howInApp: string;    // ماذا يفعل التطبيق
  effect: string;      // الأثر المتوقع
  effort: 'سهل' | 'متوسط';
  defaultDays: number; // مدة مقترحة (0 = دائم)
  offer?: Pick<Promotion, 'kind' | 'minMonths' | 'value' | 'earlyOnly' | 'planPrices'>;
  segment?: SegmentKey;
}

export const KIND_LABEL: Record<IdeaKind, string> = { offer: 'عرض', campaign: 'حملة واتساب', program: 'برنامج دائم' };

export const ACTION_IDEAS: ActionIdea[] = [
  {
    id: 'free-3-1', title: 'ادفع 3 أشهر واحصل على شهر مجاناً', kind: 'offer', effort: 'سهل', defaultDays: 30,
    offer: { kind: 'free_months', minMonths: 3, value: 1 },
    goal: 'تحصيل عدة أشهر دفعة واحدة وتثبيت المشترك لمدة أطول.',
    whenToUse: 'في بداية الشهر، أو قبل موسم تقل فيه الاشتراكات.',
    howInApp: 'يُنشأ عرض «3+1» يظهر تلقائياً في نافذة التجديد. الشهر المجاني يمدّد الاشتراك ولا يُسجَّل ديناً.',
    effect: 'يرتفع المبلغ المحصَّل مقدّماً ويقلّ الانقطاع. كلفته شهر مجاني واحد عن كل 4 أشهر.',
  },
  {
    id: 'free-6-2', title: 'ادفع 6 أشهر واحصل على شهرين مجاناً', kind: 'offer', effort: 'سهل', defaultDays: 30,
    offer: { kind: 'free_months', minMonths: 6, value: 2 },
    goal: 'تثبيت المشترك نصف سنة وتحصيل مبلغ كبير مقدّماً.',
    whenToUse: 'مع العملاء الأوفياء، أو عند الحاجة إلى سيولة قبل مصاريف كبيرة.',
    howInApp: 'يُنشأ عرض «6+2» يظهر في نافذة التجديد عند اختيار 6 أشهر أو أكثر.',
    effect: 'تحصيل مقدّم كبير، وانقطاع أقل بكثير خلال الأشهر الثمانية.',
  },
  {
    id: 'early-renewal', title: 'تجديد مبكر: خصم 5,000 د.ع', kind: 'offer', effort: 'سهل', defaultDays: 30,
    offer: { kind: 'discount_amount', minMonths: 1, value: 5000, earlyOnly: true },
    goal: 'تقليل التأخر في التجديد والديون.',
    whenToUse: 'عندما يتأخر كثيرون في الدفع بعد انتهاء اشتراكهم.',
    howInApp: 'يُنشأ عرض يظهر فقط لمن يجدّد قبل انتهاء اشتراكه.',
    effect: 'يجدّد المشترك قبل الانقطاع، فتقلّ المتابعة والديون ويقلّ الانقطاع.',
  },
  {
    id: 'percent-6', title: 'خصم 10% عند تجديد 6 أشهر', kind: 'offer', effort: 'سهل', defaultDays: 30,
    offer: { kind: 'discount_percent', minMonths: 6, value: 10 },
    goal: 'تشجيع التجديد الطويل بدون إعطاء أشهر مجانية.',
    whenToUse: 'إذا كنت تفضّل الخصم على الأشهر المجانية.',
    howInApp: 'يُنشأ عرض بنسبة 10% يُحسب على أشهر التجديد ويُقرَّب لأقرب 250 د.ع.',
    effect: 'تحصيل مقدّم أعلى مقابل خصم محدود.',
  },
  {
    id: 'new-customers', title: 'عرض المشتركين الجدد والمنتقلين', kind: 'offer', effort: 'سهل', defaultDays: 31,
    offer: { kind: 'new_price', minMonths: 1, value: 1, planPrices: [{ planName: 'Economy', price: 25000 }, { planName: 'Economy+', price: 35000 }] },
    goal: 'كسب مشتركين جدد، خاصة من يريد الانتقال إلينا من شبكة أخرى.',
    whenToUse: 'نهاية السنة، بداية العام الدراسي، أو عندما تريد ملء برج فيه مكان فارغ.',
    howInApp: 'عند «إضافة مشترك» يظهر العرض تلقائياً: الشهر الأول بسعر خاص (Economy بـ 25,000 وEconomy+ بـ 35,000). اختر «انتقل إلينا من شبكة أخرى» لتعرف لاحقاً كم كسبت من المنافسين.',
    effect: 'مشتركون جدد بسرعة. الربح يأتي من الشهر الثاني فصاعداً، لذلك تابع تجديدهم بعد الشهر الأول.',
  },
  {
    id: 'winback', title: 'حملة استرجاع المنقطعين', kind: 'campaign', segment: 'lost', effort: 'متوسط', defaultDays: 14,
    goal: 'إعادة من انتهى اشتراكه منذ أكثر من 30 يوماً.',
    whenToUse: 'بعد تحديث الاشتراكات الحالية، ويُفضّل مع عرض مغرٍ فعّال في الفترة نفسها.',
    howInApp: 'في «حملات واتساب» اختر «استرجاع المنقطعين» وأرسل واحداً بعد الآخر. التطبيق يحصي من عاد وجدّد.',
    effect: 'أرخص طريقة لزيادة المشتركين: عودة زبون سابق أسهل بكثير من كسب زبون جديد.',
  },
  {
    id: 'loyalty', title: 'شكر العملاء الأوفياء', kind: 'campaign', segment: 'loyal', effort: 'سهل', defaultDays: 7,
    goal: 'تقوية الولاء ودفع الأوفياء إلى دعوة أصدقائهم.',
    whenToUse: 'في المناسبات، أو في مواسم الأعياد.',
    howInApp: 'الفئة «شكر العملاء الأوفياء»: من جدّد 6 أشهر أو أكثر خلال سنة وليس عليه دين.',
    effect: 'يبقى العملاء الجيدون معك، ويأتيك بعضهم بأصدقاء.',
  },
  {
    id: 'upgrade', title: 'عرض ترقية الباقة', kind: 'campaign', segment: 'upgrade', effort: 'متوسط', defaultDays: 14,
    goal: 'رفع ما يدفعه المشترك الجيد مقابل سرعة أعلى.',
    whenToUse: 'عند بداية العام الدراسي أو حين يزداد استعمال الإنترنت في البيوت.',
    howInApp: 'الفئة «عرض الترقية»: منتظمون في الدفع ولهم باقة أعلى لدى المزود نفسه.',
    effect: 'زيادة في دخل كل مشترك بدون مشتركين جدد.',
  },
  {
    id: 'referral', title: 'ادعُ صديقاً', kind: 'program', effort: 'سهل', defaultDays: 0,
    goal: 'مشتركون جدد عن طريق مشتركيك الحاليين.',
    whenToUse: 'دائماً. يعمل بصمت ولا يكلّف إلا بعد أن يدفع المشترك الجديد.',
    howInApp: 'عند إضافة مشترك جديد اختر «جاء عن طريق». يحصل الداعي على أيام مجانية تلقائياً في تجديده القادم (عددها من تبويب «ادعُ صديقاً»).',
    effect: 'مشتركون موثوقون بكلفة أيام مجانية فقط.',
  },
  {
    id: 'tower-notice', title: 'إشعار صيانة أو عطل لبرج', kind: 'campaign', segment: 'tower', effort: 'سهل', defaultDays: 1,
    goal: 'إبلاغ المشتركين قبل أن يشتكوا، وتقليل المكالمات والبلاغات.',
    whenToUse: 'قبل صيانة مخططة، أو عند عطل في برج.',
    howInApp: 'الفئة «إشعار حسب البرج»: رسالة خدمة تصل حتى لمن اختار «لا يرغب بالعروض».',
    effect: 'ثقة أعلى وبلاغات أقل.',
  },
];

export const ideaById = (id: string): ActionIdea | undefined => ACTION_IDEAS.find(i => i.id === id);

// ---------------- المناسبات ----------------

export interface Occasion {
  id: string;
  name: string;
  start: string;          // بداية المناسبة
  end: string;
  approx: boolean;        // الهجري تقريبي (يختلف يوماً حسب رؤية الهلال)
  leadDays: number;       // نبدأ الخطة قبلها بهذه الأيام
  suggested: string[];    // معرّفات أفكار من المكتبة
}

const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };

/** المناسبات خلال الأيام القادمة (الهجرية بتقويم أم القرى؛ قد تختلف يوماً عن الرؤية في العراق) */
export function upcomingOccasions(today: string, horizonDays = 400): Occasion[] {
  const out: Occasion[] = [];
  const end = addDays(today, horizonDays);
  const push = (o: Occasion) => { if (o.end >= today && o.start <= end) out.push(o); };

  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const hijri = (dateStr: string) => {
      const parts = fmt.formatToParts(parseDay(dateStr));
      const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
      return { m: get('month'), d: get('day') };
    };
    for (let i = -35; i <= horizonDays; i++) {
      const day = addDays(today, i);
      const h = hijri(day);
      if (h.m === 9 && h.d === 1) push({ id: `ramadan-${day}`, name: 'شهر رمضان', start: day, end: addDays(day, 29), approx: true, leadDays: 7, suggested: ['free-3-1', 'loyalty', 'referral'] });
      if (h.m === 10 && h.d === 1) push({ id: `fitr-${day}`, name: 'عيد الفطر', start: day, end: addDays(day, 2), approx: true, leadDays: 5, suggested: ['loyalty', 'winback', 'free-6-2'] });
      if (h.m === 12 && h.d === 10) push({ id: `adha-${day}`, name: 'عيد الأضحى', start: day, end: addDays(day, 3), approx: true, leadDays: 5, suggested: ['loyalty', 'winback'] });
    }
  } catch { /* المتصفح بلا تقويم هجري: نكتفي بالمناسبات الثابتة */ }

  const year = Number(today.slice(0, 4));
  for (let y = year - 1; y <= year + 2; y++) {
    push({ id: `school-${y}`, name: 'بداية العام الدراسي', start: `${y}-09-20`, end: `${y}-10-05`, approx: true, leadDays: 7, suggested: ['new-customers', 'upgrade', 'early-renewal'] });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// ---------------- بنود الخطة ----------------

export type PlanStatus = 'upcoming' | 'running' | 'done' | 'skipped';

export function planStatus(item: PlanItem, today: string): PlanStatus {
  if (item.skipped) return 'skipped';
  if (item.startDate > today) return 'upcoming';
  if (item.endDate && item.endDate < today) return 'done';
  return 'running';
}

export const STATUS_LABEL: Record<PlanStatus, string> = { upcoming: 'قادم', running: 'جارٍ الآن', done: 'انتهى', skipped: 'ملغى' };

export function groupPlan(items: PlanItem[], today: string): Record<PlanStatus, PlanItem[]> {
  const g: Record<PlanStatus, PlanItem[]> = { upcoming: [], running: [], done: [], skipped: [] };
  for (const it of items) g[planStatus(it, today)].push(it);
  g.upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  g.running.sort((a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999'));
  g.done.sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate));
  return g;
}

/** عدد البنود التي تبدأ خلال أيام قليلة (تنبيه على أيقونة التسويق) */
export function planAlertCount(items: PlanItem[] | undefined, today: string, withinDays = 3): number {
  const limit = addDays(today, withinDays);
  return (items || []).filter(it => !it.skipped && it.startDate > today && it.startDate <= limit).length;
}

export interface NewPlanInput { title: string; startDate: string; endDate?: string; note?: string; createOffer?: boolean }

/** يبني بند الخطة، وعند الطلب عرضاً مرتبطاً به (فعّال في الفترة نفسها) */
export function buildPlanItem(idea: ActionIdea | null, input: NewPlanInput, now: Date = new Date()): { item: PlanItem; promotion?: Promotion } {
  const createdAt = now.toISOString();
  const title = input.title.trim() || idea?.title || 'بند في الخطة';
  let promotion: Promotion | undefined;
  if (idea?.offer && input.createOffer) {
    promotion = { id: uid('promo'), name: title, active: true, startDate: input.startDate, endDate: input.endDate, createdAt, ...idea.offer, ...(idea.offer.planPrices ? { planPrices: idea.offer.planPrices.map(r => ({ ...r })) } : {}) };
  }
  const item: PlanItem = {
    id: uid('plan'), ideaId: idea?.id || 'custom', title, startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(promotion ? { promotionId: promotion.id } : {}),
    ...(idea?.segment ? { segment: idea.segment } : {}),
    createdAt,
  };
  return { item, promotion };
}

export function validatePlanInput(i: NewPlanInput): string | null {
  if (!i.title.trim()) return 'اكتب اسم البند.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.startDate)) return 'اختر تاريخ البدء.';
  if (i.endDate && i.endDate < i.startDate) return 'تاريخ الانتهاء قبل تاريخ البدء.';
  return null;
}

/** نتائج بند مرتبط بعرض: الاستعمالات والإيراد وكلفة الخصم (من الوصولات) */
export function planResults(item: PlanItem, payments: PaymentRecord[]): { uses: number; revenue: number; cost: number } | null {
  if (!item.promotionId) return null;
  const used = payments.filter(p => p.promotionId === item.promotionId);
  return { uses: used.length, revenue: used.reduce((a, p) => a + (p.amount || 0), 0), cost: used.reduce((a, p) => a + (p.discount || 0), 0) };
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000);
}

// ---------------- الخطة السنوية الجاهزة ----------------

export const YEAR_PLAN_GOALS = [
  '50 مشتركاً جديداً أو منتقلاً من شبكة أخرى خلال السنة (عرض الجدد في ديسمبر وبداية الدراسة + ادعُ صديقاً).',
  'استرجاع ثلث المنقطعين (حملات بعد العطل والأعياد مع عرض 3+1).',
  '8 من كل 10 مشتركين يجدّدون في وقتهم (التجديد المبكر في نيسان وتشرين الثاني).',
  'تحصيل مقدّم أكبر: 3+1 في الشتاء ورمضان، و6+2 في الصيف.',
];

export interface YearPlanEntry { item: PlanItem; promotion?: Promotion }

/**
 * خطة سنة كاملة لكسب المشتركين وزيادة الدخل: تبدأ بعرض نهاية السنة السابقة (ديسمبر) وتنتهي بديسمبر السنة نفسها.
 * المناسبات الهجرية تُحسب تلقائياً (تقريبية). كل بند له templateKey حتى لا يُضاف مرتين.
 */
export function buildYearPlan(year: number, now: Date = new Date()): YearPlanEntry[] {
  const prev = year - 1;
  const out: YearPlanEntry[] = [];
  const add = (key: string, ideaId: string, title: string, start: string, end?: string, note?: string, createOffer = true) => {
    const idea = ideaId === 'custom' ? null : ideaById(ideaId)!;
    const { item, promotion } = buildPlanItem(idea, { title, startDate: start, endDate: end, note, createOffer }, now);
    out.push({ item: { ...item, templateKey: `y${year}-${key}` }, promotion });
  };
  const newNote = 'Economy بـ 25,000 يساوي سعر الجملة تقريباً (بلا ربح في الشهر الأول)، وEconomy+ بـ 35,000 يترك ربحاً. الربح الحقيقي من التجديد بعد الشهر الأول: اتصل بهم قبل انتهاء الشهر.';

  // ديسمبر (نهاية السنة السابقة): كسب الجدد والمنتقلين
  add('flyers', 'custom', 'منشورات وإعلان في الحي والفيسبوك: عرض نهاية السنة', `${prev}-11-25`, `${prev}-12-05`, 'وزّع المنشورات قرب الأبراج التي فيها مكان، واكتب السعرين بوضوح.');
  add('dec-new', 'new-customers', `عرض نهاية السنة ${prev}: للجدد والمنتقلين`, `${prev}-12-01`, `${prev}-12-31`, newNote);
  add('dec-share', 'loyalty', 'اطلب من الأوفياء إخبار جيرانهم بعرض نهاية السنة', `${prev}-12-01`, `${prev}-12-10`, 'ذكّرهم أن «ادعُ صديقاً» يعطيهم أياماً مجانية.');
  add('referral', 'referral', 'ادعُ صديقاً طوال السنة', `${prev}-12-01`, undefined, 'سجّل «جاء عن طريق» لكل مشترك جديد.');

  // كانون الثاني: من جاء في ديسمبر يجدّد، والمنقطعون يعودون
  add('jan-31', 'free-3-1', 'عرض العودة والتثبيت: 3 أشهر + شهر مجاناً', `${year}-01-05`, `${year}-01-31`, 'اعرضه خاصة على مشتركي ديسمبر الجدد عند أول تجديد.');
  add('jan-winback', 'winback', 'استرجاع المنقطعين بعد العطلة', `${year}-01-05`, `${year}-01-25`);

  // رمضان والأعياد (هجري تقريبي)
  const occ = upcomingOccasions(`${year}-01-01`, 366).filter(o => o.start.startsWith(String(year)));
  const ramadan = occ.find(o => o.name === 'شهر رمضان');
  const fitr = occ.find(o => o.name === 'عيد الفطر');
  const adha = occ.find(o => o.name === 'عيد الأضحى');
  const approx = (n: string) => `${n}: التاريخ تقريبي وقد يختلف يوماً حسب رؤية الهلال.`;
  if (ramadan) {
    const offerStart = addDays(ramadan.start, -7) > `${year}-01-31` ? addDays(ramadan.start, -7) : `${year}-02-01`;
    add('ram-31', 'free-3-1', 'عرض رمضان: 3 أشهر + شهر مجاناً', offerStart, ramadan.end, approx('رمضان'));
    add('ram-greet', 'loyalty', 'تهنئة رمضان للعملاء الأوفياء', addDays(ramadan.start, -2), addDays(ramadan.start, 5), approx('رمضان'));
  }
  if (fitr) {
    add('fitr-greet', 'loyalty', 'تهنئة عيد الفطر', addDays(fitr.start, -2), fitr.end, approx('عيد الفطر'));
    add('fitr-winback', 'winback', 'استرجاع المنقطعين بعد عيد الفطر', addDays(fitr.end, 3), addDays(fitr.end, 17));
  }
  add('apr-early', 'early-renewal', 'تجديد مبكر في الربيع: خصم 5,000', `${year}-04-01`, `${year}-04-30`);
  if (adha) add('adha-greet', 'loyalty', 'تهنئة عيد الأضحى', addDays(adha.start, -3), adha.end, approx('عيد الأضحى'));

  // الصيف: البيت مليء والإنترنت يُستعمل أكثر
  add('summer-62', 'free-6-2', 'عرض الصيف: 6 أشهر + شهرين مجاناً', `${year}-06-01`, `${year}-07-15`);
  add('jun-upgrade', 'upgrade', 'ترقية الباقة لعطلة الصيف', `${year}-06-10`, `${year}-06-24`);

  // بداية الدراسة
  add('school-new', 'new-customers', 'عرض بداية الدراسة: للجدد والمنتقلين', `${year}-09-15`, `${year}-10-15`, newNote);
  add('school-upgrade', 'upgrade', 'ترقية الباقة لبداية الدراسة', `${year}-09-15`, `${year}-09-30`);

  // نهاية السنة
  add('nov-early', 'early-renewal', 'تجديد مبكر قبل الشتاء: خصم 5,000', `${year}-11-01`, `${year}-11-30`);
  add('dec-new', 'new-customers', `عرض نهاية السنة ${year}: للجدد والمنتقلين`, `${year}-12-01`, `${year}-12-31`, newNote);

  // مراجعة كل ربع سنة
  const review = 'كم مشتركاً جديداً ومنتقلاً؟ كم عاد من المنقطعين؟ هل نزلت الديون؟ أي عرض نجح (تبويب العروض يعرض الاستعمال والدخل)؟';
  for (const [k, d] of [['q1', `${year}-03-31`], ['q2', `${year}-06-30`], ['q3', `${year}-09-30`], ['q4', `${year}-12-28`]] as const) {
    add(`review-${k}`, 'custom', `مراجعة الربع ${({ q1: 'الأول', q2: 'الثاني', q3: 'الثالث', q4: 'الرابع' })[k]}`, d, d, review);
  }
  return out.sort((a, b) => a.item.startDate.localeCompare(b.item.startDate));
}

/** البنود الناقصة فقط (لم تُضف من قبل). البنود المنتهية تُترك. */
export function missingYearPlan(year: number, existing: PlanItem[] | undefined, today: string, now: Date = new Date()): YearPlanEntry[] {
  const have = new Set((existing || []).map(i => i.templateKey).filter(Boolean));
  return buildYearPlan(year, now).filter(e => !have.has(e.item.templateKey) && (e.item.endDate || e.item.startDate) >= today);
}

export { toLocalDateStr };
