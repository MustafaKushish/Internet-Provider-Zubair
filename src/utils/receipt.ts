import type { PaymentRecord, Subscriber, SystemSettings } from '../types/isp';
import type { Promotion } from '../../shared/promotions';
import { formatMonthsAr } from './debt';
import { formatCurrency, getRemainingDebt } from './storage';

/**
 * بيانات بون الطابعة الحرارية (وصل قبض، ليس فاتورة). دالة صرفة (مختبرة): الواجهة ترسم فقط.
 * المصدر الأول هو سجل الدفعة (المبلغ، الطريقة، العرض، المتبقي بعدها)، والمشترك للبيانات الثابتة.
 */
export const METHOD_LABEL: Record<PaymentRecord['paymentMethod'], string> = {
  cash: 'نقداً',
  zain_cash: 'زين كاش',
  qi_card: 'كي كارد',
  transfer: 'تحويل',
};

export const PURPOSE_LABEL: Record<PaymentRecord['paymentType'], string> = {
  renewal: 'تجديد اشتراك',
  debt_installment: 'تسديد دين / قسط',
  initial: 'اشتراك جديد',
  addon: 'خدمة إضافية',
};

export interface ReceiptData {
  number: string;
  date: string;
  time: string;
  customer: { name: string; phone: string; username: string; tower: string };
  purpose: string;
  plan: string;
  provider: string;
  months?: string;
  freeMonths?: string;
  bonusDays?: string;
  validUntil: string;
  unitPrice: string;
  promoName?: string;
  discount?: string;
  paid: string;
  method?: string;
  remaining: number;
  remainingText: string;
  collectedBy?: string;
  notes?: string;
  /** سطور الإعلان أسفل البون (العروض السارية، دعوة صديق) */
  ads: string[];
}

/** 1 يوم، يومين، 3-10 أيام، 11+ يوماً */
export function daysCountAr(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}

const inRange = (p: Promotion, today: string) =>
  p.active && (!p.startDate || today >= p.startDate) && (!p.endDate || today <= p.endDate);

/** نص إعلاني قصير لعرض ساري اليوم، أو null */
export function promoAdLine(p: Promotion, currency: SystemSettings['currency'], today: string): string | null {
  if (!inRange(p, today)) return null;
  const until = p.endDate ? ` (حتى ${p.endDate})` : '';
  const min = Math.max(1, p.minMonths || 1);
  const forMonths = min > 1 ? ` عند تجديد ${formatMonthsAr(min)}` : ' عند التجديد';
  if (p.kind === 'new_price') {
    const prices = (p.planPrices || []).map(x => x.price).filter(x => x > 0);
    if (!prices.length) return null;
    return `${p.name}: اشتراك جديد لصديقك من ${formatCurrency(Math.min(...prices), currency)} للشهر الأول${until}`;
  }
  if (!(p.value > 0)) return null;
  if (p.kind === 'free_months') return `${p.name}: ${formatMonthsAr(Math.floor(p.value))} مجاناً${forMonths}${until}`;
  if (p.kind === 'discount_amount') return `${p.name}: خصم ${formatCurrency(Math.round(p.value), currency)}${forMonths}${until}`;
  return `${p.name}: خصم ${p.value}%${forMonths}${until}`;
}

export function buildReceipt(
  sub: Subscriber,
  payment: PaymentRecord | undefined,
  settings: SystemSettings,
  opts: { today: string; now?: Date; customAmount?: number; showAds?: boolean },
): ReceiptData {
  const cur = settings.currency;
  const now = opts.now ?? new Date();
  const paid = payment ? payment.amount : opts.customAmount ?? sub.paidAmount ?? 0;
  const remaining = Math.max(0, payment?.remainingBalanceAfter ?? getRemainingDebt(sub));
  const months = payment?.cycleMonths;
  const ads: string[] = [];
  if (opts.showAds !== false) {
    for (const p of settings.promotions || []) {
      const line = promoAdLine(p, cur, opts.today);
      if (line && ads.length < 3) ads.push(line);
    }
    const reward = settings.referralRewardDays ?? 10;
    if (reward > 0) ads.push(`عرّف صديقاً على شبكتنا واحصل على ${daysCountAr(reward)} مجاناً عن كل مشترك جديد يسدد.`);
  }
  return {
    number: payment?.receiptNumber || '—',
    date: payment?.date || opts.today,
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    customer: { name: sub.name, phone: sub.phone, username: sub.username, tower: sub.towerName || '' },
    purpose: payment ? PURPOSE_LABEL[payment.paymentType] : 'تسديد اشتراك',
    plan: sub.planName,
    provider: payment?.provider || sub.upstreamProvider,
    months: months && months > 0 && payment?.paymentType !== 'debt_installment' ? formatMonthsAr(months) : undefined,
    freeMonths: payment?.freeMonths ? formatMonthsAr(payment.freeMonths) : undefined,
    bonusDays: payment?.bonusDays ? daysCountAr(payment.bonusDays) : undefined,
    validUntil: sub.expiryDate,
    unitPrice: formatCurrency(sub.salePrice, cur),
    promoName: payment?.promotionName,
    discount: payment?.discount ? formatCurrency(payment.discount, cur) : undefined,
    paid: formatCurrency(paid, cur),
    method: payment ? METHOD_LABEL[payment.paymentMethod] : undefined,
    remaining,
    remainingText: remaining > 0 ? formatCurrency(remaining, cur) : 'لا شيء (خالص)',
    collectedBy: payment?.collectedBy,
    notes: payment?.notes?.trim() || undefined,
    ads,
  };
}
