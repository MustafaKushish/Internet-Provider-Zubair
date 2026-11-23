import type { Subscriber, SupportTicket } from '../types/isp';
import { getDaysRemaining, getRemainingDebt } from './storage';

/**
 * «ما يجب فعله اليوم»: قائمة واحدة مرتّبة بالأهمية، لكل سطر إجراء واحد. دالة صرفة (مختبرة).
 * - انتهى خلال آخر 30 يوماً → جدّد
 * - ينتهي خلال 3 أيام → ذكّره
 * - عليه دين (والاشتراك ساري) → طالِب (لا تظهر للفني)
 * - بلاغ مفتوح → افتح
 */
export type TaskKind = 'renew' | 'remind' | 'debt' | 'ticket';

export interface TodayTask {
  key: string;
  kind: TaskKind;
  title: string;
  /** للترتيب: الأصغر أولاً */
  rank: number;
  days?: number;
  amount?: number;
  subscriber?: Subscriber;
  ticket?: SupportTicket;
}

export function buildTodayTasks(
  subscribers: Subscriber[],
  tickets: SupportTicket[],
  opts: { showMoney: boolean; today?: Date },
): TodayTask[] {
  const out: TodayTask[] = [];
  for (const s of subscribers) {
    if (s.archived) continue;
    const days = getDaysRemaining(s.expiryDate);
    const debt = opts.showMoney ? getRemainingDebt(s) : 0;
    if (days < 0 && days >= -30) {
      out.push({ key: `r-${s.id}`, kind: 'renew', title: s.name, rank: 100 + days * -1, days, amount: debt || undefined, subscriber: s });
    } else if (days >= 0 && days <= 3) {
      out.push({ key: `m-${s.id}`, kind: 'remind', title: s.name, rank: 200 + days, days, amount: debt || undefined, subscriber: s });
    } else if (days > 3 && debt > 0) {
      out.push({ key: `d-${s.id}`, kind: 'debt', title: s.name, rank: 300 - Math.min(99, Math.round(debt / 1000)), days, amount: debt, subscriber: s });
    }
  }
  for (const t of tickets) {
    if (t.status !== 'open' && t.status !== 'in_progress') continue;
    const urgent = t.priority === 'urgent' || t.priority === 'high';
    out.push({ key: `t-${t.id}`, kind: 'ticket', title: t.title || t.subscriberName, rank: urgent ? 50 : 150, ticket: t });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

export function countByKind(tasks: TodayTask[]): Record<TaskKind | 'all', number> {
  const c = { all: tasks.length, renew: 0, remind: 0, debt: 0, ticket: 0 };
  for (const t of tasks) c[t.kind]++;
  return c;
}
