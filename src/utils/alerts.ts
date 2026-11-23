import type { PlanItem, Subscriber, SupportTicket } from '../types/isp';
import { activePromise } from './debtBoard';
import { planAlertCount } from './marketingPlan';
import { getDaysRemaining } from './storage';

/**
 * تنبيهات «الآن» في نافذة الجرس: مجمّعة (سطر لكل نوع، لا سطر لكل مشترك) حتى تبقى النافذة مرتبة.
 * دالة صرفة (مختبرة). المفتاح يتغير مع اليوم والعدد، فيظهر التنبيه «جديداً» عند تغيّره فقط.
 */
export type AlertKind = 'expired' | 'expiring' | 'promise' | 'ticket' | 'plan';
export type AlertTone = 'danger' | 'warning' | 'info';

export interface AlertGroup {
  key: string;
  kind: AlertKind;
  tone: AlertTone;
  title: string;
  /** أسماء أول المشتركين (معاينة) */
  detail?: string;
  count: number;
  tab: string;
}

/** عدد + معدود: 3-10 جمع، 11+ مفرد منصوب */
const nAr = (n: number, few: string, many: string) => `${n} ${n <= 10 ? few : many}`;

const preview = (names: string[]) => names.slice(0, 3).join('، ') + (names.length > 3 ? ` و${names.length - 3} آخرين` : '');

export function buildAlerts(
  subscribers: Subscriber[],
  tickets: SupportTicket[],
  opts: { today: string; warningDays: number; showMoney: boolean; planItems?: PlanItem[] },
): AlertGroup[] {
  const expired: string[] = [];
  const expiring: string[] = [];
  const promises: string[] = [];
  for (const s of subscribers) {
    if (s.archived) continue;
    const days = getDaysRemaining(s.expiryDate);
    if (days === -1) expired.push(s.name);
    else if (days >= 0 && days <= opts.warningDays) expiring.push(s.name);
    const p = opts.showMoney ? activePromise(s) : null;
    if (p && p <= opts.today) promises.push(s.name);
  }
  const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const urgent = open.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
  const plan = opts.showMoney ? planAlertCount(opts.planItems, opts.today) : 0;

  const out: AlertGroup[] = [];
  const k = (kind: string, n: number) => `${kind}:${opts.today}:${n}`;
  if (expired.length) out.push({ key: k('expired', expired.length), kind: 'expired', tone: 'danger', count: expired.length, tab: 'home',
    title: expired.length === 1 ? 'اشتراك انتهى أمس' : `${nAr(expired.length, 'اشتراكات', 'اشتراكاً')} انتهت أمس`, detail: preview(expired) });
  if (expiring.length) out.push({ key: k('expiring', expiring.length), kind: 'expiring', tone: 'warning', count: expiring.length, tab: 'home',
    title: expiring.length === 1 ? 'اشتراك ينتهي قريباً' : `${nAr(expiring.length, 'اشتراكات', 'اشتراكاً')} تنتهي قريباً`, detail: preview(expiring) });
  if (promises.length) out.push({ key: k('promise', promises.length), kind: 'promise', tone: 'warning', count: promises.length, tab: 'debts',
    title: promises.length === 1 ? 'موعد وعد بالتسديد حلّ' : `${nAr(promises.length, 'وعود', 'وعداً')} بالتسديد حلّ موعدها`, detail: preview(promises) });
  if (open.length) out.push({ key: k('ticket', open.length), kind: 'ticket', tone: urgent ? 'danger' : 'info', count: open.length, tab: 'tickets',
    title: open.length === 1 ? 'بلاغ مفتوح' : `${nAr(open.length, 'بلاغات', 'بلاغاً')} مفتوحة`, detail: urgent ? `منها ${urgent} عاجل` : undefined });
  if (plan) out.push({ key: k('plan', plan), kind: 'plan', tone: 'info', count: plan, tab: 'marketing',
    title: plan === 1 ? 'بند في خطة التسويق يبدأ قريباً' : `${nAr(plan, 'بنود', 'بنداً')} في خطة التسويق تبدأ قريباً` });
  return out;
}
