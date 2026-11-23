/**
 * العروض (التسويق): قواعد واحدة يستخدمها المتصفح عند التجديد والخادم عند التحقق،
 * فلا يمكن تمرير خصم لا يطابق عرضاً فعالاً. دوال صرفة؛ لا تستورد شيئاً من src أو worker.
 *
 * تمثيل المال: الأشهر المجانية تُضاف إلى cycleMonths (تمدّد تاريخ الانتهاء)، وقيمتها تُسجَّل في cycleDiscount،
 * فيبقى الدين = السعر × الأشهر + الدين المرحّل − الخصم − المدفوع، دون أي «إسقاط» صامت للدين.
 */

export type PromoKind = 'free_months' | 'discount_amount' | 'discount_percent';

export interface Promotion {
  id: string;
  name: string;
  kind: PromoKind;
  minMonths: number;   // أقل عدد أشهر مدفوعة لتطبيق العرض
  value: number;       // أشهر مجانية / خصم بالدينار / نسبة مئوية
  startDate?: string;  // YYYY-MM-DD (شامل)
  endDate?: string;
  earlyOnly?: boolean; // فقط لمن يجدد قبل انتهاء اشتراكه
  active: boolean;
  createdAt?: string;
}

export interface PromoContext {
  months: number;      // الأشهر المدفوعة
  salePrice: number;
  today: string;       // تاريخ التجديد
  expiryDate: string;  // تاريخ الانتهاء قبل التجديد
}

export interface PromoEffect {
  freeMonths: number;
  discount: number;    // قيمة التوفير بالدينار (للأشهر المجانية = سعرها)
}

const round250 = (n: number) => Math.round(n / 250) * 250;

export function isPromotionApplicable(p: Promotion, c: PromoContext): boolean {
  if (!p.active || !(p.value > 0)) return false;
  if (p.startDate && c.today < p.startDate) return false;
  if (p.endDate && c.today > p.endDate) return false;
  if (c.months < Math.max(1, p.minMonths || 1)) return false;
  if (p.earlyOnly && !(c.expiryDate >= c.today)) return false;
  return true;
}

export function promotionEffect(p: Promotion, c: PromoContext): PromoEffect {
  const base = Math.max(0, c.salePrice) * c.months;
  if (p.kind === 'free_months') {
    const free = Math.max(0, Math.floor(p.value));
    return { freeMonths: free, discount: Math.max(0, c.salePrice) * free };
  }
  if (p.kind === 'discount_amount') return { freeMonths: 0, discount: Math.min(base, Math.max(0, Math.round(p.value))) };
  return { freeMonths: 0, discount: Math.min(base, round250((base * Math.min(100, Math.max(0, p.value))) / 100)) };
}

/** العروض الصالحة لهذا التجديد، الأكثر توفيراً أولاً */
export function applicablePromotions(list: Promotion[] | undefined, c: PromoContext): Array<{ promo: Promotion; effect: PromoEffect }> {
  return (list || [])
    .filter(p => isPromotionApplicable(p, c))
    .map(promo => ({ promo, effect: promotionEffect(promo, c) }))
    .sort((a, b) => b.effect.discount - a.effect.discount);
}

/** للخادم: هل الخصم المسجّل في الدورة الجديدة هو بالضبط ما يعطيه هذا العرض؟ */
export function verifyCycleDiscount(p: Promotion, x: { cycleMonths: number; cycleDiscount: number; salePrice: number; renewedOn: string; prevExpiry: string }): boolean {
  const free = p.kind === 'free_months' ? Math.max(0, Math.floor(p.value)) : 0;
  const months = (Number(x.cycleMonths) || 0) - free;
  if (months < 1) return false;
  const ctx: PromoContext = { months, salePrice: Number(x.salePrice) || 0, today: x.renewedOn, expiryDate: x.prevExpiry };
  return isPromotionApplicable(p, ctx) && Math.abs(promotionEffect(p, ctx).discount - (Number(x.cycleDiscount) || 0)) < 1;
}

/** المتبقي بذمة المشترك (نفس معادلة التطبيق) — للخادم */
export function remainingDebtOf(s: { salePrice?: number; cycleMonths?: number; carriedDebt?: number; cycleDiscount?: number; paidAmount?: number }): number {
  const months = s.cycleMonths && s.cycleMonths > 0 ? s.cycleMonths : 1;
  return Math.max(0, (Number(s.salePrice) || 0) * months + (Number(s.carriedDebt) || 0) - (Number(s.cycleDiscount) || 0) - (Number(s.paidAmount) || 0));
}

/** وصف العرض بكلمات بسيطة */
export function describePromotion(p: Pick<Promotion, 'kind' | 'minMonths' | 'value' | 'earlyOnly'>, fmt: (n: number) => string = n => n.toLocaleString('en-US')): string {
  const m = Math.max(1, p.minMonths || 1);
  const months = (n: number) => (n === 1 ? 'شهر' : n === 2 ? 'شهرين' : n <= 10 ? `${n} أشهر` : `${n} شهراً`);
  const early = p.earlyOnly ? ' (للتجديد قبل الانتهاء)' : '';
  if (p.kind === 'free_months') return `ادفع ${months(m)} واحصل على ${months(Math.floor(p.value))} مجاناً${early}`;
  if (p.kind === 'discount_amount') return `خصم ${fmt(p.value)} د.ع عند تجديد ${months(m)} أو أكثر${early}`;
  return `خصم ${p.value}% عند تجديد ${months(m)} أو أكثر${early}`;
}
