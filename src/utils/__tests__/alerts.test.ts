import { beforeEach, describe, expect, it } from 'vitest';
import { buildAlerts } from '../alerts';
import { clearNotices, getNoticeState, logNotice, markAllSeen, timeAgoAr, unseenCount } from '../notificationCenter';
import { toLocalDateStr } from '../dates';
import type { Subscriber, SupportTicket } from '../../types/isp';

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return toLocalDateStr(d); };
const sub = (id: string, expiryOff: number, over: Partial<Subscriber> = {}): Subscriber => ({
  id, name: id, phone: '', username: id, upstreamProvider: 'E', planName: 'Economy', costPrice: 25000, salePrice: 35000, paidAmount: 35000,
  startDate: day(expiryOff - 30), expiryDate: day(expiryOff), status: 'active', paymentStatus: 'paid', towerName: '', createdAt: day(-100), cycleMonths: 1, carriedDebt: 0, ...over,
} as Subscriber);

describe('bell alerts', () => {
  const today = day(0);
  const subs = [
    sub('a', 0), sub('b', 2), sub('c', 1), sub('d', 3), sub('e', 9), sub('x', -1), sub('old', -20), sub('arch', 1, { archived: true }),
    sub('p', 30, { promiseDate: day(0), promiseSetAt: day(-3) }),
  ];
  const tickets = [{ id: 't', status: 'open', priority: 'urgent', title: 'برج', subscriberName: 'x' }] as SupportTicket[];

  it('groups instead of one line per subscriber', () => {
    const a = buildAlerts(subs, tickets, { today, warningDays: 3, showMoney: true });
    expect(a.map(x => [x.kind, x.count])).toEqual([['expired', 1], ['expiring', 4], ['promise', 1], ['ticket', 1]]);
    expect(a[1].detail).toBe('a، b، c و1 آخرين');
    expect(a[3]).toMatchObject({ tone: 'danger', detail: 'منها 1 عاجل' });
  });
  it('technicians: no money alerts', () => {
    expect(buildAlerts(subs, tickets, { today, warningDays: 3, showMoney: false }).some(x => x.kind === 'promise')).toBe(false);
  });
  it('key changes with the count, so a new case shows as new', () => {
    const k1 = buildAlerts([sub('a', 1)], [], { today, warningDays: 3, showMoney: true })[0].key;
    const k2 = buildAlerts([sub('a', 1), sub('b', 2)], [], { today, warningDays: 3, showMoney: true })[0].key;
    expect(k1).not.toBe(k2);
  });
});

describe('notice log', () => {
  beforeEach(() => clearNotices());
  it('merges the same message within a minute and counts unseen', () => {
    logNotice('تم الحفظ', 'success', 1000);
    logNotice('تم الحفظ', 'success', 20_000);
    logNotice('خطأ', 'error', 30_000);
    const s = getNoticeState();
    expect(s.notices.map(n => [n.message, n.times || 1])).toEqual([['خطأ', 1], ['تم الحفظ', 2]]);
    expect(unseenCount(s, ['k1'])).toBe(3);
    markAllSeen(['k1']);
    expect(unseenCount(getNoticeState(), ['k1'])).toBe(0);
    expect(unseenCount(getNoticeState(), ['k1', 'k2'])).toBe(1);
  });
  it('Arabic relative time', () => {
    const now = 100 * 86_400_000;
    expect([0, 5, 60, 120, 180, 660, 1440, 2880, 4320].map(m => timeAgoAr(now - m * 60_000, now)))
      .toEqual(['الآن', 'قبل 5 د', 'قبل ساعة', 'قبل ساعتين', 'قبل 3 ساعات', 'قبل 11 ساعة', 'أمس', 'قبل يومين', 'قبل 3 أيام']);
  });
});
