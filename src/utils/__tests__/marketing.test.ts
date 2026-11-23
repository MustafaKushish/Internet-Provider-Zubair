import { describe, expect, it } from 'vitest';
import { PaymentRecord, Subscriber, UpstreamProvider } from '../../types/isp';
import { applicablePromotions, describePromotion, isPromotionApplicable, promotionEffect, remainingDebtOf, verifyCycleDiscount, type Promotion } from '../../../shared/promotions';
import { buildRenewal } from '../ledger';
import { getRemainingDebt } from '../storage';
import { fillTemplate, higherPlan, pendingReferrals, referralBoard, segmentMembers } from '../marketing';

const T = '2026-06-15';
const sub = (over: Partial<Subscriber> = {}): Subscriber => ({
  id: 's1', name: 'أحمد', phone: '0780', username: 'u', upstreamProvider: 'E', planName: 'Economy+', costPrice: 28000, salePrice: 40000,
  paidAmount: 40000, startDate: '2026-05-20', expiryDate: '2026-06-20', status: 'active', paymentStatus: 'paid', towerName: 'برج 1', createdAt: '2026-01-01', ...over,
});
const promo = (over: Partial<Promotion> = {}): Promotion => ({ id: 'p1', name: '3+1', kind: 'free_months', minMonths: 3, value: 1, active: true, ...over });
const ctx = { months: 3, salePrice: 40000, today: T, expiryDate: '2026-06-20' };
const ledgerCtx = { warningDays: 3, collectedBy: 'test', today: T };

describe('promotions: rules', () => {
  it('checks active, dates, minimum months and early renewal', () => {
    expect(isPromotionApplicable(promo(), ctx)).toBe(true);
    expect(isPromotionApplicable(promo({ active: false }), ctx)).toBe(false);
    expect(isPromotionApplicable(promo(), { ...ctx, months: 2 })).toBe(false);
    expect(isPromotionApplicable(promo({ startDate: '2026-06-16' }), ctx)).toBe(false);
    expect(isPromotionApplicable(promo({ endDate: '2026-06-14' }), ctx)).toBe(false);
    expect(isPromotionApplicable(promo({ endDate: T }), ctx)).toBe(true); // end date inclusive
    expect(isPromotionApplicable(promo({ earlyOnly: true }), ctx)).toBe(true);
    expect(isPromotionApplicable(promo({ earlyOnly: true }), { ...ctx, expiryDate: '2026-06-10' })).toBe(false);
  });

  it('computes effects: free months, fixed and percent discounts (capped, rounded to 250)', () => {
    expect(promotionEffect(promo(), ctx)).toEqual({ freeMonths: 1, discount: 40000 });
    expect(promotionEffect(promo({ kind: 'discount_amount', value: 5000 }), ctx)).toEqual({ freeMonths: 0, discount: 5000 });
    expect(promotionEffect(promo({ kind: 'discount_amount', value: 999999 }), ctx).discount).toBe(120000);
    expect(promotionEffect(promo({ kind: 'discount_percent', value: 7 }), ctx).discount).toBe(8500); // 8,400 → 8,500
  });

  it('sorts applicable offers by savings and describes them in plain words', () => {
    const list = applicablePromotions([promo({ id: 'a', kind: 'discount_amount', value: 5000 }), promo({ id: 'b' }), promo({ id: 'c', minMonths: 6 })], ctx);
    expect(list.map(x => x.promo.id)).toEqual(['b', 'a']);
    expect(describePromotion(promo())).toBe('ادفع 3 أشهر واحصل على شهر مجاناً');
    expect(describePromotion(promo({ kind: 'discount_percent', value: 10, minMonths: 6, earlyOnly: true }))).toBe('خصم 10% عند تجديد 6 أشهر أو أكثر (للتجديد قبل الانتهاء)');
  });

  it('server check accepts only the exact discount of a valid offer', () => {
    const x = { cycleMonths: 4, cycleDiscount: 40000, salePrice: 40000, renewedOn: T, prevExpiry: '2026-06-20' };
    expect(verifyCycleDiscount(promo(), x)).toBe(true);
    expect(verifyCycleDiscount(promo(), { ...x, cycleDiscount: 80000 })).toBe(false);     // inflated
    expect(verifyCycleDiscount(promo(), { ...x, cycleMonths: 3 })).toBe(false);           // only 2 paid months
    expect(verifyCycleDiscount(promo({ endDate: '2026-06-01' }), x)).toBe(false);         // expired offer
    expect(verifyCycleDiscount(promo({ kind: 'discount_amount', value: 5000 }), { ...x, cycleMonths: 3, cycleDiscount: 5000 })).toBe(true);
  });
});

describe('renewal with an offer', () => {
  it('3+1: charges 3 months, extends 4, keeps the money formula honest', () => {
    const { updatedSub, payment } = buildRenewal(sub(), [], { durationMonths: 3, amountPaid: 120000, paymentMethod: 'cash', notes: '', promotion: promo() }, ledgerCtx);
    expect(updatedSub.expiryDate).toBe('2026-10-20');   // from the old expiry + 4 months
    expect(updatedSub.cycleMonths).toBe(4);
    expect(updatedSub.cycleDiscount).toBe(40000);
    expect(getRemainingDebt(updatedSub)).toBe(0);
    expect(remainingDebtOf(updatedSub)).toBe(0);         // server formula agrees
    expect(payment).toMatchObject({ promotionId: 'p1', promotionName: '3+1', discount: 40000, freeMonths: 1, costAmount: 28000 * 4, cycleMonths: 4 });
  });

  it('a discount with partial payment leaves the right debt', () => {
    const { updatedSub } = buildRenewal(sub(), [], { durationMonths: 3, amountPaid: 100000, paymentMethod: 'cash', notes: '', promotion: promo({ kind: 'discount_amount', value: 5000 }) }, ledgerCtx);
    expect(getRemainingDebt(updatedSub)).toBe(15000); // 120,000 − 5,000 − 100,000
  });

  it('an offer that does not apply is ignored (no discount)', () => {
    const { updatedSub, payment } = buildRenewal(sub(), [], { durationMonths: 1, amountPaid: 40000, paymentMethod: 'cash', notes: '', promotion: promo() }, ledgerCtx);
    expect(updatedSub.cycleDiscount).toBeUndefined();
    expect(payment.promotionId).toBeUndefined();
    expect(updatedSub.expiryDate).toBe('2026-07-20');
  });

  it('the next renewal clears the old discount', () => {
    const first = buildRenewal(sub(), [], { durationMonths: 3, amountPaid: 120000, paymentMethod: 'cash', notes: '', promotion: promo() }, ledgerCtx).updatedSub;
    const second = buildRenewal(first, [], { durationMonths: 1, amountPaid: 40000, paymentMethod: 'cash', notes: '' }, ledgerCtx).updatedSub;
    expect(second.cycleDiscount).toBeUndefined();
    expect(getRemainingDebt(second)).toBe(0);
  });

  it('referral bonus days extend the expiry without touching money', () => {
    const { updatedSub, payment } = buildRenewal(sub(), [], { durationMonths: 1, amountPaid: 40000, paymentMethod: 'cash', notes: '', bonusDays: 10 }, ledgerCtx);
    expect(updatedSub.expiryDate).toBe('2026-07-30');
    expect(getRemainingDebt(updatedSub)).toBe(0);
    expect(payment.bonusDays).toBe(10);
  });
});

describe('segments and referrals', () => {
  const renewal = (subscriberId: string, date: string, cycleMonths = 1) => ({ id: `${subscriberId}${date}`, subscriberId, date, paymentType: 'renewal', cycleMonths, amount: 40000 }) as PaymentRecord;
  const providers = [{ id: 'e', name: 'E', plans: [{ id: '1', name: 'Economy+', defaultCost: 0, defaultSalePrice: 40000 }, { id: '2', name: 'Standard', defaultCost: 0, defaultSalePrice: 50000 }] }] as UpstreamProvider[];

  it('lost = expired more than 30 days, respects "no offers"', () => {
    const list = [sub({ id: 'a', expiryDate: '2026-05-01' }), sub({ id: 'b', expiryDate: '2026-06-01' }), sub({ id: 'c', expiryDate: '2026-04-01', noMarketing: true })];
    expect(segmentMembers('lost', list, [], providers, T).map(s => s.id)).toEqual(['a']);
  });

  it('loyal = active, no debt, 6+ months renewed in a year', () => {
    const pays = [renewal('a', '2025-08-01', 3), renewal('a', '2026-03-01', 3), renewal('b', '2026-01-01', 3)];
    const list = [sub({ id: 'a' }), sub({ id: 'b' }), sub({ id: 'c', paidAmount: 0 })];
    expect(segmentMembers('loyal', list, [...pays, renewal('c', '2026-01-01', 6)], providers, T).map(s => s.id)).toEqual(['a']);
  });

  it('upgrade = reliable payer with a higher plan available', () => {
    expect(higherPlan(sub(), providers)).toEqual({ name: 'Standard', price: 50000 });
    expect(higherPlan(sub({ salePrice: 50000 }), providers)).toBeNull();
    const pays = [renewal('a', '2026-03-01', 3)];
    expect(segmentMembers('upgrade', [sub({ id: 'a' }), sub({ id: 'b', salePrice: 50000 })], [...pays, renewal('b', '2026-03-01', 3)], providers, T).map(s => s.id)).toEqual(['a']);
  });

  it('tower notice reaches current customers of that tower, even with "no offers"', () => {
    const list = [sub({ id: 'a', noMarketing: true }), sub({ id: 'b', towerName: 'برج 2' }), sub({ id: 'c', expiryDate: '2026-01-01' })];
    expect(segmentMembers('tower', list, [], providers, T, 'برج 1').map(s => s.id)).toEqual(['a']);
  });

  it('referrals: pending only after the new subscriber paid; board counts', () => {
    const referrer = sub({ id: 'r', name: 'الداعي' });
    const list = [referrer, sub({ id: 'n1', referredBy: 'r' }), sub({ id: 'n2', referredBy: 'r', paidAmount: 0 }), sub({ id: 'n3', referredBy: 'r', referralRewarded: true })];
    expect(pendingReferrals(referrer, list).map(s => s.id)).toEqual(['n1']);
    expect(referralBoard(list)).toEqual([{ sub: referrer, total: 3, rewarded: 1, pending: 1 }]);
  });

  it('fills message templates', () => {
    expect(fillTemplate('مرحباً {الاسم}، عرض {العرض} {غير_موجود}!', { 'الاسم': 'علي', 'العرض': '3+1' })).toBe('مرحباً علي، عرض 3+1 !');
  });
});
