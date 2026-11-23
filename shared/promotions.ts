/**
 * العروض (التسويق): قواعد واحدة يستخدمها المتصفح عند التجديد والخادم عند التحقق،
 * فلا يمكن تمرير خصم لا يطابق عرضاً فعالاً. دوال صرفة؛ لا تستورد شيئاً من src أو worker.
 *
 * تمثيل المال: الأشهر المجانية تُضاف إلى cycleMonths (تمدّد تاريخ الانتهاء)، وقيمتها تُسجَّل في cycleDiscount،
 * فيبقى الدين = السعر × الأشهر + الدين المرحّل − الخصم − المدفوع، دون أي «إسقاط» صامت للدين.
 */

// new_price: سعر خاص للمشتركين الجدد والمنتقلين من شبكة أخرى (الشهر الأول فقط، لكل باقة سعرها)
export type PromoKind = 'free_months' | 'discount_amount' | 'discount_percent' | 'new_price';

export interface Promotion {
  id: string;
  name: string;
  kind: PromoKind;
  minMonths: number;   // أقل عدد أشهر مدفوعة لتطبيق العرض
  value: number;       // أشهر مجانية / خصم بالدينار / نسبة مئوية
  startDate?: string;  // YYYY-MM-DD (شامل)
  endDate?: string;
  earlyOnly?: boolean; // فقط لمن يجدد قبل انتهاء اشتراكه
  planPrices?: Array<{ planName: string; price: number }>; // لـ new_price: سعر الشهر الأول لكل باقة
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
  if (p.kind === 'new_price') return false; // للمشتركين الجدد فقط، لا يظهر عند التجديد
  if (!p.active || !(p.value > 0)) return false;
  if (p.startDate && c.today < p.startDate) return false;
  if (p.endDate && c.today > p.endDate) return false;
  if (c.months < Math.max(1, p.minMonths || 1)) return false;
  if (p.earlyOnly && !(c.expiryDate >= c.today)) return false;
  return true;
}

export function promotionEffect(p: Promotion, c: PromoContext): PromoEffect {
  if (p.kind === 'new_price') return { freeMonths: 0, discount: 0 };
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

// ---------- المشتركون الجدد والمنتقلون ----------

const inDates = (p: Promotion, today: string) => !(p.startDate && today < p.startDate) && !(p.endDate && today > p.endDate);

export interface NewCustomerContext { planName: string; salePrice: number; today: string }

/** سعر الشهر الأول لمشترك جديد حسب عرض new_price (null إن لم ينطبق) */
export function newCustomerDiscount(p: Promotion, c: NewCustomerContext, ignoreActive = false): { price: number; discount: number } | null {
  if (p.kind !== 'new_price' || (!ignoreActive && !p.active) || !inDates(p, c.today)) return null;
  const row = (p.planPrices || []).find(r => r.planName.trim() === (c.planName || '').trim());
  const sale = Number(c.salePrice) || 0;
  if (!row || !(row.price > 0) || row.price >= sale) return null;
  return { price: row.price, discount: sale - row.price };
}

export function bestNewCustomerOffer(list: Promotion[] | undefined, c: NewCustomerContext): { promo: Promotion; price: number; discount: number } | null {
  let best: { promo: Promotion; price: number; discount: number } | null = null;
  for (const p of list || []) {
    const r = newCustomerDiscount(p, c);
    if (r && (!best || r.discount > best.discount)) best = { promo: p, ...r };
  }
  return best;
}

/** للخادم: خصم مشترك جديد يجب أن يساوي بالضبط ما يعطيه العرض (الإيقاف لا يُرفض حتى لا يضيع ما سُجّل دون إنترنت) */
export function verifyNewCustomerDiscount(p: Promotion, x: { planName: string; salePrice: number; cycleDiscount: number; today: string }): boolean {
  const r = newCustomerDiscount(p, { planName: x.planName, salePrice: x.salePrice, today: x.today }, true);
  return !!r && Math.abs(r.discount - (Number(x.cycleDiscount) || 0)) < 1;
}

/** وصف العرض بكلمات بسيطة */
export function describePromotion(p: Pick<Promotion, 'kind' | 'minMonths' | 'value' | 'earlyOnly' | 'planPrices'>, fmt: (n: number) => string = n => n.toLocaleString('en-US')): string {
  if (p.kind === 'new_price') {
    const rows = (p.planPrices || []).filter(r => r.price > 0);
    return `للمشتركين الجدد والمنتقلين من شبكة أخرى: ${rows.length ? rows.map(r => `${r.planName} بـ ${fmt(r.price)}`).join(' • ') + ' د.ع' : 'حدّد الأسعار'} (الشهر الأول)`;
  }
  const m = Math.max(1, p.minMonths || 1);
  const months = (n: number) => (n === 1 ? 'شهر' : n === 2 ? 'شهرين' : n <= 10 ? `${n} أشهر` : `${n} شهراً`);
  const early = p.earlyOnly ? ' (للتجديد قبل الانتهاء)' : '';
  if (p.kind === 'free_months') return `ادفع ${months(m)} واحصل على ${months(Math.floor(p.value))} مجاناً${early}`;
  if (p.kind === 'discount_amount') return `خصم ${fmt(p.value)} د.ع عند تجديد ${months(m)} أو أكثر${early}`;
  return `خصم ${p.value}% عند تجديد ${months(m)} أو أكثر${early}`;
}
