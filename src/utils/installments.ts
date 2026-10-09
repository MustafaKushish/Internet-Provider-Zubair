import { InstallmentPlan, PaymentRecord, Subscriber, SystemSettings } from '../types/isp';
import { addMonthsToDateStr, todayStr } from './dates';
import { formatCurrency, getRemainingDebt } from './storage';

export interface PlanProgress {
  plan: InstallmentPlan;
  paid: number;          // ما سُدد من الخطة (وصولات تسديد دين منذ إنشائها)
  remaining: number;
  paidInstallments: number;
  dueCount: number;      // عدد الأقساط التي حل موعدها حتى اليوم
  arrears: number;       // المتأخر عن جدول الأقساط
  nextDate: string | null;
  nextAmount: number;
  status: 'done' | 'late' | 'ok';
}

/** تقريب قيمة القسط لأعلى لأقرب 250 دينار */
export function suggestInstallment(total: number, count: number): number {
  return Math.ceil(total / Math.max(1, count) / 250) * 250;
}

export function createPlan(total: number, count: number, startDate: string, by: string, note?: string): InstallmentPlan {
  return {
    id: `plan_${Date.now().toString(36)}`,
    total: Math.round(total),
    count,
    amount: suggestInstallment(total, count),
    startDate,
    createdAt: new Date().toISOString(),
    createdBy: by,
    note: note?.trim() || undefined,
  };
}

export function planProgress(sub: Subscriber, payments: PaymentRecord[], today: string = todayStr()): PlanProgress | null {
  const plan = sub.installmentPlan;
  if (!plan) return null;
  const since = plan.createdAt.slice(0, 10);
  const paid = payments
    .filter(p => p.subscriberId === sub.id && p.paymentType === 'debt_installment' && (p.date || '') >= since)
    .reduce((a, p) => a + (p.amount || 0), 0);
  const remaining = Math.max(0, plan.total - paid);
  const done = remaining <= 0 || getRemainingDebt(sub) <= 0;
  let dueCount = 0;
  for (let i = 0; i < plan.count; i++) {
    if (addMonthsToDateStr(plan.startDate, i) <= today) dueCount++;
  }
  const expected = Math.min(plan.total, dueCount * plan.amount);
  const arrears = done ? 0 : Math.max(0, expected - paid);
  const paidInstallments = Math.min(plan.count, Math.floor(paid / plan.amount));
  const nextIndex = Math.min(plan.count - 1, paidInstallments);
  return {
    plan,
    paid,
    remaining: done ? 0 : remaining,
    paidInstallments: done ? plan.count : paidInstallments,
    dueCount,
    arrears,
    nextDate: done ? null : addMonthsToDateStr(plan.startDate, nextIndex),
    nextAmount: done ? 0 : Math.min(remaining, arrears > 0 ? arrears : plan.amount - (paid % plan.amount)),
    status: done ? 'done' : arrears > 0 ? 'late' : 'ok',
  };
}

/** رسالة واتساب لتذكير بالقسط المستحق */
export function installmentMessage(sub: Subscriber, pr: PlanProgress, settings: SystemSettings): string {
  const fmt = (n: number) => formatCurrency(n, settings.currency);
  return `مرحباً أخي العزيز ${sub.name} 🌹
نذكّرك بقسط الاتفاق على الدين السابق لدى (${settings.ispName}):
• القسط المستحق: ${fmt(pr.nextAmount)}${pr.nextDate ? ` (موعده ${pr.nextDate})` : ''}
• المسدد حتى الآن: ${fmt(pr.paid)} من ${fmt(pr.plan.total)} (${pr.paidInstallments} من ${pr.plan.count} أقساط)
• المتبقي: ${fmt(pr.remaining)}
شكراً لالتزامك 🙏
${settings.whatsappFooter || ''}`.trim();
}
