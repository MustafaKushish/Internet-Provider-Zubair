import { describe, expect, it } from 'vitest';
import { InstallmentPlan, PaymentRecord, Subscriber } from '../../types/isp';
import { activePromise, buildDebtRows, summarizeDebts, suggestedAmount } from '../debtBoard';

const TODAY = '2026-06-15';
const sub = (over: Partial<Subscriber> = {}): Subscriber => ({
  id: 's1', name: 'أحمد', phone: '0780', username: 'u', upstreamProvider: 'E', planName: 'Basic', costPrice: 28000, salePrice: 40000,
  paidAmount: 0, startDate: '2026-05-10', expiryDate: '2026-06-10', status: 'expired', paymentStatus: 'overdue', towerName: 'T', createdAt: '2026-01-01', ...over,
});
const rows = (subs: Subscriber[], reminded: Record<string, string> = {}, pays: PaymentRecord[] = []) => buildDebtRows(subs, pays, { today: TODAY, reminded });

describe('debt board', () => {
  it('skips subscribers without debt and archived ones', () => {
    expect(rows([sub({ paidAmount: 40000 }), sub({ id: 'b', archived: true })])).toHaveLength(0);
  });

  it('bigger and older debts come first', () => {
    const r = rows([sub({ id: 'small', paidAmount: 30000 }), sub({ id: 'big', carriedDebt: 120000 }), sub({ id: 'mid', carriedDebt: 40000, expiryDate: '2026-02-01' })]);
    expect(r[0].sub.id).toBe('big');
    expect(r.map(x => x.sub.id)).toEqual(['big', 'mid', 'small']);
  });

  it('a pending promise or a plan not yet due waits; a broken promise jumps to the top', () => {
    const waiting = sub({ id: 'w', promiseDate: '2026-06-20', promiseSetAt: '2026-06-14' });
    const broken = sub({ id: 'b', promiseDate: '2026-06-12', promiseSetAt: '2026-06-01', paidAmount: 30000 });
    const r = rows([waiting, broken, sub({ id: 'n', carriedDebt: 200000 })]);
    expect(r[0].sub.id).toBe('b');
    expect(r[0].state).toBe('broken');
    expect(r.find(x => x.sub.id === 'w')!.state).toBe('waiting');
  });

  it('a payment after the promise cancels it', () => {
    expect(activePromise(sub({ promiseDate: '2026-06-01', promiseSetAt: '2026-05-20', lastPaymentDate: '2026-05-25' }))).toBeNull();
    expect(activePromise(sub({ promiseDate: '2026-06-01', promiseSetAt: '2026-05-20', lastPaymentDate: '2026-05-10' }))).toBe('2026-06-01');
  });

  it('cools down for 3 days after a reminder', () => {
    expect(rows([sub()], { s1: '2026-06-15' })[0].state).toBe('cooldown');
    expect(rows([sub()], { s1: '2026-06-13' })[0].state).toBe('cooldown');
    expect(rows([sub()], { s1: '2026-06-12' })[0].state).toBe('today');
  });

  it('a plan that is on schedule waits, a late plan does not', () => {
    const plan = (startDate: string): InstallmentPlan => ({ id: 'p', total: 80000, count: 4, amount: 20000, startDate, createdAt: '2026-05-01T00:00:00Z', createdBy: 'a' });
    const ok = rows([sub({ carriedDebt: 40000, installmentPlan: plan('2026-07-01') })])[0];
    expect(ok.state).toBe('waiting');
    const late = rows([sub({ carriedDebt: 40000, installmentPlan: plan('2026-05-01') })])[0];
    expect(late.state).toBe('today');
    expect(late.suggested).toBe(late.plan!.arrears);
  });

  it('suggests one month, or the whole debt when it is small', () => {
    expect(suggestedAmount(sub(), 100000, null)).toBe(40000);
    expect(suggestedAmount(sub(), 25000, null)).toBe(25000);
    expect(suggestedAmount(sub({ salePrice: 0 }), 90000, null)).toBe(90000);
    expect(suggestedAmount(sub(), 0, null)).toBe(0);
  });

  it('summarizes totals, at-risk debt and recent collections', () => {
    const list = rows([sub({ id: 'a', expiryDate: '2026-02-01' }), sub({ id: 'b', carriedDebt: 10000, expiryDate: '2026-06-14' })]);
    const pays = [
      { id: '1', paymentType: 'debt_installment', amount: 15000, date: '2026-06-01' },
      { id: '2', paymentType: 'debt_installment', amount: 99999, date: '2026-04-01' },
      { id: '3', paymentType: 'renewal', amount: 40000, date: '2026-06-02' },
    ] as PaymentRecord[];
    const s = summarizeDebts(list, pays, TODAY);
    expect(s.total).toBe(90000);
    expect(s.count).toBe(2);
    expect(s.atRisk).toBe(40000);
    expect(s.atRiskCount).toBe(1);
    expect(s.collected30).toBe(15000);
  });
});
