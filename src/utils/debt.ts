import { Subscriber } from '../types/isp';
import { getAmountDue, getRemainingDebt, formatCurrency } from './storage';
import { addMonthsToDateStr, parseLocalDate, todayStr } from './dates';

/**
 * الديون بطريقة الحساب المعتمدة في العراق: الاشتراك = شهر، والدين = عدد الأشهر × سعر الباقة
 * (مثلاً: ×2 Economy+ (40,000) = 80,000)، والتأخير يُعدّ بالأشهر لا بالأيام.
 */

/** صياغة عدد الأشهر بالعربية: شهر، شهرين، 3 أشهر، 11 شهراً، 1.5 شهر */
export function formatMonthsAr(months: number): string {
  const m = Math.round(months * 10) / 10;
  if (m <= 0) return '0 شهر';
  if (!Number.isInteger(m)) return `${m} شهر`;
  if (m === 1) return 'شهر';
  if (m === 2) return 'شهرين';
  if (m <= 10) return `${m} أشهر`;
  return `${m} شهراً`;
}

/**
 * عدد الأشهر المتأخرة منذ انتهاء الاشتراك: كل شهر بدأ ولم يُدفع يُحسب شهراً كاملاً
 * (انتهى منذ 3 أيام = شهر، منذ 35 يوماً = شهرين). 0 إذا لم ينتهِ بعد.
 */
export function monthsLate(expiryDate: string, today: string = todayStr()): number {
  if (!expiryDate) return 0;
  const end = parseLocalDate(today).getTime();
  if (parseLocalDate(expiryDate).getTime() >= end) return 0;
  let months = 0;
  while (months < 600 && parseLocalDate(addMonthsToDateStr(expiryDate, months)).getTime() < end) months++;
  return months;
}

/** الدين معبراً عنه بعدد الأشهر حسب سعر باقة المشترك (قد يكون كسراً مثل 1.5) */
export function debtInMonths(sub: Subscriber): number {
  const debt = getRemainingDebt(sub);
  if (debt <= 0 || !sub.salePrice) return 0;
  return Math.round((debt / sub.salePrice) * 10) / 10;
}

/** نص الدين المختصر: ×2 Economy+ (40,000) = 80,000 د.ع */
export function describeDebt(sub: Subscriber, currency: 'IQD' | 'USD' = 'IQD'): string {
  const debt = getRemainingDebt(sub);
  if (debt <= 0) return 'لا يوجد دين';
  const months = debtInMonths(sub);
  if (!sub.salePrice) return formatCurrency(debt, currency);
  return `×${months} ${sub.planName} (${formatCurrency(sub.salePrice, currency)}) = ${formatCurrency(debt, currency)}`;
}

/**
 * حالة جديدة للمشترك بحيث يصبح المتبقي بذمته = target بالضبط،
 * مع إبقاء رسوم الدورة الحالية كما هي (يُعدَّل الدين المرحّل أولاً، ثم المدفوع في الدورة).
 */
export function withRemainingDebt(sub: Subscriber, target: number): Pick<Subscriber, 'carriedDebt' | 'paidAmount'> {
  const t = Math.max(0, Math.round(target));
  const cycleDue = getAmountDue({ ...sub, carriedDebt: 0 });
  if (t >= cycleDue) return { carriedDebt: t - cycleDue, paidAmount: 0 };
  return { carriedDebt: 0, paidAmount: cycleDue - t };
}
