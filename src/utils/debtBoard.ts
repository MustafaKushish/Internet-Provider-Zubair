import { PaymentRecord, Subscriber } from '../types/isp';
import { addMonthsToDateStr, diffDays, todayStr } from './dates';
import { monthsLate } from './debt';
import { PlanProgress, planProgress } from './installments';
import { getRemainingDebt } from './storage';

/**
 * لوحة الديون الذكية: من نطالبه اليوم؟ ومن نترك له وقتاً؟ وكم نطلب منه؟
 * دوال صرفة (بلا React) لسهولة الاختبار.
 */

/** بعد مطالبة أحدهم لا نعيد مطالبته قبل مرور هذه الأيام */
export const COOLDOWN_DAYS = 3;
/** تأخر هذا العدد من الأشهر أو أكثر = دين في خطر */
export const AT_RISK_MONTHS = 3;

export type DebtState =
  | 'broken'   // أخلف وعده: الأولوية القصوى
  | 'today'    // يُطالَب اليوم
  | 'cooldown' // طُولب قبل أيام قليلة
  | 'waiting'; // وعد بالدفع لاحقاً أو له قسط قادم لم يحل موعده

export interface DebtRow {
  sub: Subscriber;
  debt: number;
  lateMonths: number;
  plan: PlanProgress | null;
  promiseDate: string | null;
  state: DebtState;
  suggested: number;
  lastReminded: string | null;
  remindedDaysAgo: number | null;
  score: number;
}

export interface DebtOptions {
  today?: string;
  /** subscriberId → تاريخ آخر مطالبة (من هذا الجهاز) */
  reminded?: Record<string, string>;
}

/** الوعد ساري ما لم يدفع المشترك بعد تسجيله (أي دفعة = وفى أو بدأ يفي) */
export function activePromise(sub: Subscriber): string | null {
  if (!sub.promiseDate) return null;
  if (sub.lastPaymentDate && sub.promiseSetAt && sub.lastPaymentDate > sub.promiseSetAt) return null;
  return sub.promiseDate;
}

/** المبلغ المقترح مطالبته الآن: القسط المستحق، أو شهر واحد، أو الدين كله إن كان صغيراً */
export function suggestedAmount(sub: Subscriber, debt: number, plan: PlanProgress | null): number {
  if (debt <= 0) return 0;
  if (plan && plan.status !== 'done') {
    const due = plan.status === 'late' ? plan.arrears : plan.nextAmount;
    if (due > 0) return Math.min(debt, due);
  }
  const price = sub.salePrice || 0;
  return !price || debt <= price ? debt : price;
}

export function buildDebtRows(subs: Subscriber[], payments: PaymentRecord[], opts: DebtOptions = {}): DebtRow[] {
  const today = opts.today || todayStr();
  const rows: DebtRow[] = [];
  for (const sub of subs) {
    const debt = getRemainingDebt(sub);
    if (debt <= 0 || sub.archived) continue;

    const plan = planProgress(sub, payments, today);
    const lateMonths = monthsLate(sub.expiryDate, today);
    const promiseDate = activePromise(sub);
    const lastReminded = opts.reminded?.[sub.id] || null;
    const remindedDaysAgo = lastReminded ? diffDays(lastReminded, today) : null;

    let state: DebtState;
    if (promiseDate && promiseDate < today) state = 'broken';
    else if (promiseDate) state = 'waiting';
    else if (plan && plan.status === 'ok') state = 'waiting';
    else if (remindedDaysAgo !== null && remindedDaysAgo >= 0 && remindedDaysAgo < COOLDOWN_DAYS) state = 'cooldown';
    else state = 'today';

    let score = Math.min(debt, 400000) / 1000 + Math.min(lateMonths, 12) * 15;
    if (state === 'broken') score += 1000;
    if (plan?.status === 'late') score += 500;
    if (!sub.phone) score -= 50;

    rows.push({
      sub, debt, lateMonths, plan, promiseDate, state, lastReminded, remindedDaysAgo, score,
      suggested: suggestedAmount(sub, debt, plan),
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}

export interface DebtSummary {
  total: number;
  count: number;
  atRisk: number;       // مجموع الديون المتأخرة AT_RISK_MONTHS أشهر فأكثر
  atRiskCount: number;
  collected30: number;  // ما سُدّد من الديون خلال 30 يوماً
  today: number;
  waiting: number;
  broken: number;
}

export function summarizeDebts(rows: DebtRow[], payments: PaymentRecord[], today: string = todayStr()): DebtSummary {
  const since = addMonthsToDateStr(today, -1);
  const late = rows.filter(r => r.lateMonths >= AT_RISK_MONTHS);
  return {
    total: rows.reduce((a, r) => a + r.debt, 0),
    count: rows.length,
    atRisk: late.reduce((a, r) => a + r.debt, 0),
    atRiskCount: late.length,
    collected30: payments.filter(p => p.paymentType === 'debt_installment' && p.date >= since && p.date <= today).reduce((a, p) => a + (p.amount || 0), 0),
    today: rows.filter(r => r.state === 'today' || r.state === 'broken').length,
    waiting: rows.filter(r => r.state === 'waiting').length,
    broken: rows.filter(r => r.state === 'broken').length,
  };
}
