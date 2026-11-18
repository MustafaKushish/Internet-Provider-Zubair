import { describe, expect, it } from 'vitest';
import { PaymentRecord, Subscriber } from '../../types/isp';
import { addMonthsToDateStr, diffDays } from '../dates';
import { debtInMonths, formatMonthsAr, monthsLate, withRemainingDebt } from '../debt';
import { applyDebtAdjustment, buildPayment, buildRenewal, reversePayment } from '../ledger';
import { suggestInstallment } from '../installments';
import { matchesSubscriber, phoneDigits } from '../search';
import { getAmountDue, getRemainingDebt } from '../storage';

const TODAY = '2026-06-15';
const ctx = { warningDays: 3, collectedBy: 'اختبار', today: TODAY };

const sub = (over: Partial<Subscriber> = {}): Subscriber => ({
  id: 's1', name: 'أحمد علي', phone: '07801234567', username: 'u1', upstreamProvider: 'Earthlink', planName: 'Basic',
  costPrice: 28000, salePrice: 40000, paidAmount: 0, startDate: '2026-05-10', expiryDate: '2026-06-10',
  status: 'expired', paymentStatus: 'overdue', towerName: 'برج 1', createdAt: '2026-01-01', ...over,
});

describe('debt math', () => {
  it('debt = price × months + carried − paid', () => {
    expect(getAmountDue(sub({ cycleMonths: 2, carriedDebt: 10000 }))).toBe(90000);
    expect(getRemainingDebt(sub({ paidAmount: 15000 }))).toBe(25000);
    expect(getRemainingDebt(sub({ paidAmount: 99999 }))).toBe(0);
  });
  it('expresses debt in months', () => {
    expect(debtInMonths(sub({ paidAmount: 0 }))).toBe(1);
    expect(debtInMonths(sub({ carriedDebt: 40000 }))).toBe(2);
    expect(debtInMonths(sub({ paidAmount: 20000 }))).toBe(0.5);
  });
  it('withRemainingDebt hits the target exactly', () => {
    for (const target of [0, 15000, 40000, 100000]) {
      const s = sub();
      expect(getRemainingDebt({ ...s, ...withRemainingDebt(s, target) })).toBe(target);
    }
  });
  it('late months count every started month', () => {
    expect(monthsLate('2026-06-12', TODAY)).toBe(1);
    expect(monthsLate('2026-05-10', TODAY)).toBe(2);
    expect(monthsLate('2026-06-20', TODAY)).toBe(0);
  });
  it('Arabic month forms', () => {
    expect([1, 2, 3, 11].map(formatMonthsAr)).toEqual(['شهر', 'شهرين', '3 أشهر', '11 شهراً']);
  });
});

describe('dates', () => {
  it('clamps month end', () => {
    expect(addMonthsToDateStr('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDateStr('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('diffDays', () => expect(diffDays('2026-06-10', '2026-06-15')).toBe(5));
});

describe('renewal', () => {
  it('expired subscriber renews from today and carries unpaid debt', () => {
    const { updatedSub, payment } = buildRenewal(sub({ paidAmount: 10000 }), [], { durationMonths: 1, amountPaid: 40000, paymentMethod: 'cash', notes: '' }, ctx);
    expect(updatedSub.startDate).toBe(TODAY);
    expect(updatedSub.expiryDate).toBe('2026-07-15');
    expect(updatedSub.carriedDebt).toBe(30000);
    expect(updatedSub.paidAmount).toBe(40000);
    expect(getRemainingDebt(updatedSub)).toBe(30000);
    expect(payment.paymentType).toBe('renewal');
    expect(payment.costAmount).toBe(28000);
    expect(payment.remainingBalanceAfter).toBe(30000);
    expect(payment.lateDays).toBe(5);
  });
  it('active subscriber extends from the expiry date', () => {
    const { updatedSub } = buildRenewal(sub({ expiryDate: '2026-06-20', paidAmount: 40000 }), [], { durationMonths: 2, amountPaid: 80000, paymentMethod: 'cash', notes: '' }, ctx);
    expect(updatedSub.expiryDate).toBe('2026-08-20');
    expect(updatedSub.cycleMonths).toBe(2);
    expect(getRemainingDebt(updatedSub)).toBe(0);
  });
  it('applies the scheduled price and un-archives', () => {
    const { updatedSub, payment } = buildRenewal(
      sub({ archived: true, archivedAt: 'x', pendingPrice: { salePrice: 50000, costPrice: 30000, from: TODAY, by: 'a' } }),
      [], { durationMonths: 1, amountPaid: 0, paymentMethod: 'cash', notes: '' }, ctx);
    expect(updatedSub.salePrice).toBe(50000);
    expect(updatedSub.pendingPrice).toBeUndefined();
    expect(updatedSub.archived).toBeUndefined();
    expect(payment.costAmount).toBe(30000);
  });
});

describe('partial debt payments', () => {
  it('adds to paidAmount, leaves the rest as debt, writes a receipt', () => {
    const s = sub({ carriedDebt: 20000 }); // owes 60,000
    const r = buildPayment(s, [], { amount: 25000, paymentMethod: 'zain_cash', notes: 'جزئي' }, ctx)!;
    expect(r.updatedSub.paidAmount).toBe(25000);
    expect(getRemainingDebt(r.updatedSub)).toBe(35000);
    expect(r.payment.remainingBalanceAfter).toBe(35000);
    expect(r.payment.costAmount).toBe(0);
    expect(r.payment.paymentType).toBe('debt_installment');
    expect(r.payment.receiptNumber).toMatch(/2026/);
  });
  it('two partial payments equal one full payment', () => {
    const s = sub();
    const a = buildPayment(s, [], { amount: 15000 }, ctx)!;
    const b = buildPayment(a.updatedSub, [a.payment], { amount: 25000 }, ctx)!;
    expect(getRemainingDebt(b.updatedSub)).toBe(0);
    expect(new Set([a.payment.receiptNumber, b.payment.receiptNumber]).size).toBe(2);
  });
  it('ignores zero or negative amounts', () => {
    expect(buildPayment(sub(), [], { amount: 0 }, ctx)).toBeNull();
    expect(buildPayment(sub(), [], { amount: -5 }, ctx)).toBeNull();
  });
});

describe('debt adjustment and receipt deletion', () => {
  it('adjusts to the exact target and logs it', () => {
    const u = applyDebtAdjustment(sub({ carriedDebt: 40000 }), 10000, 'اتفاق', 'المدير', 3, new Date('2026-06-15T10:00:00Z'));
    expect(getRemainingDebt(u)).toBe(10000);
    expect(u.debtLog).toEqual([{ at: '2026-06-15T10:00:00.000Z', by: 'المدير', from: 80000, to: 10000, reason: 'اتفاق' }]);
  });
  it('deleting a current-cycle receipt returns its amount to the debt', () => {
    const s = sub({ paidAmount: 40000, currentCycleId: 'c1' });
    const pay = { id: 'p', amount: 15000, date: TODAY, cycleId: 'c1' } as PaymentRecord;
    expect(reversePayment(s, pay, 3)!.paidAmount).toBe(25000);
  });
  it('deleting an old-cycle receipt leaves the balance alone', () => {
    const s = sub({ paidAmount: 40000, currentCycleId: 'c2' });
    const pay = { id: 'p', amount: 15000, date: '2026-01-01', cycleId: 'c1' } as PaymentRecord;
    expect(reversePayment(s, pay, 3)).toBeNull();
  });
});

describe('installments and search', () => {
  it('rounds installments up to 250', () => {
    expect(suggestInstallment(100000, 3)).toBe(33500);
    expect(suggestInstallment(60000, 4)).toBe(15000);
  });
  it('Arabic-tolerant search', () => {
    const s = sub({ name: 'أحمد كريم' });
    expect(matchesSubscriber(s, 'احمد')).toBe(true);
    expect(matchesSubscriber(s, '٠٧٨٠١٢٣')).toBe(true);
    expect(matchesSubscriber(s, '+964 780 123')).toBe(true);
    expect(matchesSubscriber(s, 'زيد')).toBe(false);
    expect(phoneDigits('00964 780 123 4567')).toBe('7801234567');
  });
});
