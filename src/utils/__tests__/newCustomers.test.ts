import { describe, expect, it } from 'vitest';
import { applicablePromotions, bestNewCustomerOffer, describePromotion, newCustomerDiscount, remainingDebtOf, verifyNewCustomerDiscount, type Promotion } from '../../../shared/promotions';
import { buildYearPlan, missingYearPlan } from '../marketingPlan';
import { getRemainingDebt } from '../storage';
import { Subscriber } from '../../types/isp';

const yearEnd: Promotion = {
  id: 'ny', name: 'عرض نهاية السنة', kind: 'new_price', minMonths: 1, value: 1, active: true,
  startDate: '2026-12-01', endDate: '2026-12-31',
  planPrices: [{ planName: 'Economy', price: 25000 }, { planName: 'Economy+', price: 35000 }],
};

describe('new-customer offer (first month price)', () => {
  it('gives the plan price in December only', () => {
    expect(newCustomerDiscount(yearEnd, { planName: 'Economy', salePrice: 35000, today: '2026-12-10' })).toEqual({ price: 25000, discount: 10000 });
    expect(newCustomerDiscount(yearEnd, { planName: 'Economy+', salePrice: 40000, today: '2026-12-31' })).toEqual({ price: 35000, discount: 5000 });
    expect(newCustomerDiscount(yearEnd, { planName: 'Economy', salePrice: 35000, today: '2026-11-30' })).toBeNull();
    expect(newCustomerDiscount(yearEnd, { planName: 'Economy', salePrice: 35000, today: '2027-01-01' })).toBeNull();
  });
  it('ignores other plans, prices that are not lower, and stopped offers', () => {
    expect(newCustomerDiscount(yearEnd, { planName: 'Super', salePrice: 50000, today: '2026-12-10' })).toBeNull();
    expect(newCustomerDiscount(yearEnd, { planName: 'Economy', salePrice: 25000, today: '2026-12-10' })).toBeNull();
    expect(bestNewCustomerOffer([{ ...yearEnd, active: false }], { planName: 'Economy', salePrice: 35000, today: '2026-12-10' })).toBeNull();
  });
  it('never shows up at renewal', () => {
    expect(applicablePromotions([yearEnd], { months: 1, salePrice: 35000, today: '2026-12-10', expiryDate: '2026-12-20' })).toHaveLength(0);
  });
  it('debt of a new subscriber who pays the offer price is zero; next month is full price', () => {
    const sub = { salePrice: 35000, cycleMonths: 1, carriedDebt: 0, cycleDiscount: 10000, paidAmount: 25000 } as Subscriber;
    expect(getRemainingDebt(sub)).toBe(0);
    expect(remainingDebtOf(sub)).toBe(0);
    expect(getRemainingDebt({ ...sub, paidAmount: 20000 })).toBe(5000);
  });
  it('server check: exact discount only, stopped offer still accepted (offline)', () => {
    const base = { planName: 'Economy', salePrice: 35000, today: '2026-12-05' };
    expect(verifyNewCustomerDiscount(yearEnd, { ...base, cycleDiscount: 10000 })).toBe(true);
    expect(verifyNewCustomerDiscount({ ...yearEnd, active: false }, { ...base, cycleDiscount: 10000 })).toBe(true);
    expect(verifyNewCustomerDiscount(yearEnd, { ...base, cycleDiscount: 20000 })).toBe(false);
    expect(verifyNewCustomerDiscount(yearEnd, { ...base, today: '2027-01-02', cycleDiscount: 10000 })).toBe(false);
  });
  it('describes the offer in Arabic', () => {
    expect(describePromotion(yearEnd)).toContain('Economy بـ 25,000');
    expect(describePromotion(yearEnd)).toContain('الشهر الأول');
  });
});

describe('year plan 2027', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  const plan = buildYearPlan(2027, now);
  const key = (k: string) => plan.find(e => e.item.templateKey === `y2027-${k}`)!;
  it('starts with the December 2026 offer for new and switching customers', () => {
    const dec = key('dec-new');
    expect(dec.item.startDate).toBe('2026-12-01');
    expect(dec.item.endDate).toBe('2026-12-31');
    expect(dec.promotion?.kind).toBe('new_price');
    expect(dec.promotion?.planPrices).toEqual([{ planName: 'Economy', price: 25000 }, { planName: 'Economy+', price: 35000 }]);
    expect(dec.promotion?.startDate).toBe('2026-12-01');
    expect(dec.item.promotionId).toBe(dec.promotion?.id);
  });
  it('covers the whole year: Ramadan, Eids, summer, school, reviews', () => {
    for (const k of ['jan-31', 'jan-winback', 'ram-31', 'ram-greet', 'fitr-greet', 'fitr-winback', 'apr-early', 'adha-greet', 'summer-62', 'school-new', 'nov-early', 'dec-new', 'review-q1', 'review-q4', 'referral']) {
      expect(key(k), k).toBeTruthy();
    }
    expect(key('ram-31').item.startDate >= '2027-02-01').toBe(true);
    expect(key('ram-31').item.endDate! <= '2027-03-12').toBe(true);
  });
  it('renewal offers never overlap with the same kind (no confusing double offers)', () => {
    const offers = plan.filter(e => e.promotion && e.promotion.kind !== 'new_price').map(e => e.promotion!);
    for (const a of offers) for (const b of offers) {
      if (a === b || a.kind !== b.kind) continue;
      expect(a.endDate! < b.startDate! || b.endDate! < a.startDate!, `${a.name} / ${b.name}`).toBe(true);
    }
  });
  it('adding twice adds nothing; past items are skipped', () => {
    const first = missingYearPlan(2027, [], '2026-11-23', now);
    expect(first.length).toBe(plan.length);
    expect(missingYearPlan(2027, first.map(e => e.item), '2026-11-23', now)).toHaveLength(0);
    expect(missingYearPlan(2027, [], '2027-05-01', now).some(e => e.item.templateKey === 'y2027-dec-new' && e.item.startDate === '2026-12-01')).toBe(false);
  });
});
