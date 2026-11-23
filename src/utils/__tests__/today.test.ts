import { describe, expect, it } from 'vitest';
import { buildTodayTasks, countByKind } from '../today';
import { NAV_GROUPS, TAB_ORDER, firstTab, groupOf, tabsFor, visibleGroups } from '../../components/nav';
import { TAB_ACCESS } from '../../../shared/access';
import type { Subscriber, SupportTicket } from '../../types/isp';

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const sub = (id: string, expiryOff: number, paid = 35000, over: Partial<Subscriber> = {}): Subscriber => ({
  id, name: id, phone: '', username: id, upstreamProvider: 'E', planName: 'Economy', costPrice: 25000, salePrice: 35000, paidAmount: paid,
  startDate: day(expiryOff - 30), expiryDate: day(expiryOff), status: 'active', paymentStatus: 'paid', towerName: '', createdAt: day(-100), cycleMonths: 1, carriedDebt: 0, ...over,
} as Subscriber);

describe('today tasks', () => {
  const subs = [sub('expired2', -2), sub('old', -60), sub('soon', 1), sub('debtor', 20, 10000), sub('fine', 20), sub('arch', -1, 35000, { archived: true })];
  const tickets = [{ id: 't1', status: 'open', priority: 'urgent', title: 'برج 2 بطيء', subscriberName: 'x' }, { id: 't2', status: 'resolved', priority: 'low', title: 'done', subscriberName: 'y' }] as SupportTicket[];
  it('one list: recent expired, ending soon, debts, open tickets; nothing else', () => {
    const t = buildTodayTasks(subs, tickets, { showMoney: true });
    expect(t.map(x => x.key)).toEqual(['t-t1', 'r-expired2', 'm-soon', 'd-debtor']);
    expect(countByKind(t)).toEqual({ all: 4, renew: 1, remind: 1, debt: 1, ticket: 1 });
  });
  it('technicians see no debts', () => {
    expect(buildTodayTasks(subs, tickets, { showMoney: false }).some(x => x.kind === 'debt')).toBe(false);
  });
  it('bigger debts first', () => {
    const t = buildTodayTasks([sub('small', 20, 30000), sub('big', 20, 0)], [], { showMoney: true });
    expect(t.map(x => x.title)).toEqual(['big', 'small']);
  });
});

describe('navigation: 5 sections', () => {
  it('every page lives in exactly one section and has access rules', () => {
    expect(NAV_GROUPS).toHaveLength(5);
    expect(new Set(TAB_ORDER).size).toBe(TAB_ORDER.length);
    for (const t of TAB_ORDER) expect(TAB_ACCESS[t], t).toBeTruthy();
    for (const t of Object.keys(TAB_ACCESS)) expect(TAB_ORDER, t).toContain(t);
  });
  it('technician: no money section, marketing shows only renewal reminders', () => {
    const g = visibleGroups('technician').map(x => x.id);
    expect(g).not.toContain('money');
    expect(tabsFor(groupOf('reminders'), 'technician')).toEqual(['reminders']);
    expect(firstTab(groupOf('marketing'), 'technician')).toBe('reminders');
  });
  it('admin: money opens debts first', () => {
    expect(firstTab(groupOf('cash'), 'admin')).toBe('debts');
    expect(visibleGroups('admin')).toHaveLength(5);
  });
});
