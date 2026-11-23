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
  offer?: Pick<Promotion, 'kind' | 'minMonths' | 'value' | 'earlyOnly'>;
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
    push({ id: `school-${y}`, name: 'بداية العام الدراسي', start: `${y}-09-20`, end: `${y}-10-05`, approx: true, leadDays: 7, suggested: ['upgrade', 'early-renewal'] });
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
    promotion = { id: uid('promo'), name: title, active: true, startDate: input.startDate, endDate: input.endDate, createdAt, ...idea.offer };
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

export { toLocalDateStr };
