import { PaymentRecord, Subscriber } from '../types/isp';
import { addMonthsToDateStr, diffDays, parseLocalDate, todayStr, uid } from './dates';
import { withRemainingDebt } from './debt';
import { getRemainingDebt, nextReceiptNumber, refreshSubscriberStatus } from './storage';

/**
 * حسابات الدفتر المالي كدوال صرفة (بدون حالة React): تأخذ المشترك والوصولات وتعيد النتيجة الجديدة.
 * App.tsx يستدعيها ثم يحفظ النتيجة ويعرض الإشعارات، فيمكن اختبار الأرقام وحدها.
 */

export interface LedgerContext {
  warningDays: number;
  collectedBy: string;
  today?: string;
}

export type PaymentMethod = PaymentRecord['paymentMethod'];

export interface RenewalInput {
  durationMonths: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  notes: string;
}

export interface LedgerResult {
  updatedSub: Subscriber;
  payment: PaymentRecord;
}

/** تجديد: الدين غير المسدد يُرحَّل، والسعر المجدول يبدأ، والتجديد يعيد المشترك من الأرشيف */
export function buildRenewal(sub: Subscriber, payments: PaymentRecord[], input: RenewalInput, ctx: LedgerContext): LedgerResult {
  const today = ctx.today || todayStr();
  const months = Math.max(1, Math.round(input.durationMonths || 1));
  const amountPaid = Math.max(0, Number(input.amountPaid) || 0);

  // الاشتراك ما زال سارياً: نمدّد من تاريخ الانتهاء، وإلا من اليوم — بأشهر تقويمية
  const baseDate = parseLocalDate(sub.expiryDate) > parseLocalDate(today) ? sub.expiryDate : today;
  const newExpiry = addMonthsToDateStr(baseDate, months);
  const previousDebt = getRemainingDebt(sub);
  const cycleId = uid('cycle');

  const { pendingPrice, archived: _a, archivedAt: _b, archivedBy: _c, archiveReason: _d, ...base } = sub;
  const newSale = pendingPrice?.salePrice ?? sub.salePrice;
  const newCost = pendingPrice?.costPrice ?? sub.costPrice;
  const updatedSub = refreshSubscriberStatus({
    ...base,
    salePrice: newSale,
    costPrice: newCost,
    startDate: baseDate,
    expiryDate: newExpiry,
    paidAmount: amountPaid,
    cycleMonths: months,
    carriedDebt: previousDebt,
    currentCycleId: cycleId,
    status: sub.status === 'suspended' ? 'active' : sub.status,
    lastPaymentDate: amountPaid > 0 ? today : sub.lastPaymentDate,
  }, ctx.warningDays);

  const payment: PaymentRecord = {
    id: uid('pay'),
    receiptNumber: nextReceiptNumber(payments, today),
    subscriberId: sub.id,
    subscriberName: sub.name,
    amount: amountPaid,
    date: today,
    paymentMethod: input.paymentMethod,
    paymentType: 'renewal',
    cycleMonths: months,
    lateDays: Math.max(0, diffDays(sub.expiryDate, today)) || undefined,
    notes: input.notes,
    collectedBy: ctx.collectedBy,
    remainingBalanceAfter: getRemainingDebt(updatedSub),
    costAmount: newCost * months,
    provider: sub.upstreamProvider,
    towerName: sub.towerName,
    cycleId,
  };
  return { updatedSub, payment };
}

/** دفعة على الحساب الحالي (تسديد دين كلي أو جزئي، قسط، إضافة). null إذا كان المبلغ صفراً */
export function buildPayment(sub: Subscriber, payments: PaymentRecord[], data: Partial<PaymentRecord>, ctx: LedgerContext): LedgerResult | null {
  const amount = Math.max(0, Number(data.amount) || 0);
  if (amount <= 0) return null;
  const date = data.date || ctx.today || todayStr();
  const updatedSub = refreshSubscriberStatus({ ...sub, paidAmount: sub.paidAmount + amount, lastPaymentDate: date }, ctx.warningDays);
  const payment: PaymentRecord = {
    id: uid('pay'),
    receiptNumber: nextReceiptNumber(payments, date),
    subscriberId: sub.id,
    subscriberName: sub.name,
    amount,
    date,
    paymentMethod: data.paymentMethod || 'cash',
    paymentType: data.paymentType || 'debt_installment',
    notes: data.notes || '',
    collectedBy: ctx.collectedBy,
    remainingBalanceAfter: getRemainingDebt(updatedSub),
    // الأقساط والإضافات لا تحمل كلفة جملة جديدة (الكلفة سُجّلت مع التجديد)
    costAmount: 0,
    provider: sub.upstreamProvider,
    towerName: sub.towerName,
    cycleId: sub.currentCycleId,
  };
  return { updatedSub, payment };
}

/** تعديل الدين إلى مبلغ محدد مع تسجيله في debtLog (الصلاحية تُفحص في الاستدعاء) */
export function applyDebtAdjustment(sub: Subscriber, newDebt: number, reason: string, by: string, warningDays: number, now = new Date()): Subscriber {
  const from = getRemainingDebt(sub);
  return refreshSubscriberStatus({
    ...sub,
    ...withRemainingDebt(sub, newDebt),
    debtLog: [...(sub.debtLog || []), { at: now.toISOString(), by, from, to: Math.max(0, Math.round(newDebt)), reason }],
  }, warningDays);
}

/** هل الوصل تابع للدورة الحالية للمشترك؟ (وصولات قديمة بلا معرّف دورة: نعتمد التاريخ) */
export function paymentBelongsToCurrentCycle(pay: PaymentRecord, sub: Subscriber): boolean {
  if (pay.cycleId && sub.currentCycleId) return pay.cycleId === sub.currentCycleId;
  return pay.date >= sub.startDate;
}

/** حذف وصل: يُخصم من رصيد المشترك فقط إذا كان من الدورة الحالية، وإلا تُعاد null */
export function reversePayment(sub: Subscriber, pay: PaymentRecord, warningDays: number): Subscriber | null {
  if (!paymentBelongsToCurrentCycle(pay, sub)) return null;
  return refreshSubscriberStatus({ ...sub, paidAmount: Math.max(0, sub.paidAmount - pay.amount) }, warningDays);
}
