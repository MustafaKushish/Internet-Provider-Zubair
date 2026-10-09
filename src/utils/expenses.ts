import { Expense, ExpenseCategory, PaymentRecord, Subscriber } from '../types/isp';
import { getPaymentCost } from './storage';
import { addMonthsToDateStr } from './dates';
import { normTower } from './towers';

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; color: string }[] = [
  { id: 'rent', label: 'إيجار', color: 'bg-sky-500' },
  { id: 'generator', label: 'مولد ووقود', color: 'bg-amber-500' },
  { id: 'electricity', label: 'كهرباء', color: 'bg-yellow-400' },
  { id: 'maintenance', label: 'صيانة وتصليح', color: 'bg-orange-500' },
  { id: 'equipment', label: 'أجهزة ومعدات', color: 'bg-violet-500' },
  { id: 'salaries', label: 'رواتب وأجور', color: 'bg-emerald-500' },
  { id: 'bandwidth', label: 'خط/سعة إنترنت', color: 'bg-cyan-500' },
  { id: 'marketing', label: 'تسويق وإعلان', color: 'bg-pink-500' },
  { id: 'transport', label: 'نقل ومواصلات', color: 'bg-lime-500' },
  { id: 'other', label: 'أخرى', color: 'bg-slate-400' },
];

export const categoryLabel = (c: string) => EXPENSE_CATEGORIES.find(x => x.id === c)?.label || c;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً', zain_cash: 'زين كاش', qi_card: 'كي كارد', transfer: 'تحويل',
};

export const monthOf = (date: string) => (date || '').slice(0, 7);

export function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter(e => monthOf(e.date) === month);
}

export const sumAmounts = (list: { amount: number }[]) => list.reduce((a, x) => a + (Number(x.amount) || 0), 0);

/** ربح الوصولات المقبوضة في الشهر (المقبوض ناقص كلفة الجملة) */
export function paymentsProfitInMonth(payments: PaymentRecord[], subscribers: Subscriber[], month: string) {
  const list = payments.filter(p => monthOf(p.date) === month);
  const collected = sumAmounts(list);
  const cost = list.reduce((a, p) => a + getPaymentCost(p, subscribers), 0);
  return { collected, cost, profit: collected - cost, count: list.length };
}

/** صافي الربح الحقيقي للشهر = ربح الوصولات − المصاريف التشغيلية */
export function netProfitInMonth(payments: PaymentRecord[], subscribers: Subscriber[], expenses: Expense[], month: string) {
  const p = paymentsProfitInMonth(payments, subscribers, month);
  const exp = sumAmounts(expensesInMonth(expenses, month));
  return { ...p, expenses: exp, net: p.profit - exp };
}

/** مصاريف كل برج في الشهر (المصاريف العامة تحت مفتاح فارغ) */
export function expensesByTower(expenses: Expense[], month: string): Map<string, number> {
  const m = new Map<string, number>();
  expensesInMonth(expenses, month).forEach(e => {
    const k = normTower(e.towerName);
    m.set(k, (m.get(k) || 0) + (Number(e.amount) || 0));
  });
  return m;
}

const recurringKey = (e: Expense) => `${e.category}|${normTower(e.towerName)}|${(e.note || '').trim()}`;

/**
 * المصاريف الثابتة في الشهر السابق التي لم تُسجل بعد في هذا الشهر،
 * بنفس اليوم من الشهر (مثلاً إيجار يوم 5 يُنسخ إلى يوم 5).
 */
export function pendingRecurring(expenses: Expense[], month: string): Expense[] {
  const prevMonth = addMonthsToDateStr(`${month}-01`, -1).slice(0, 7);
  const existing = new Set(expensesInMonth(expenses, month).map(recurringKey));
  return expensesInMonth(expenses, prevMonth).filter(e => e.recurring && !existing.has(recurringKey(e)));
}

/** نقل تاريخ المصروف لنفس اليوم في الشهر المطلوب (مع مراعاة أيام الشهر) */
export function sameDayInMonth(date: string, month: string): string {
  const day = Number((date || '').slice(8, 10)) || 1;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
