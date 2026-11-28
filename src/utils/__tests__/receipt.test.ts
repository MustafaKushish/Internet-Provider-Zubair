import { describe, expect, it } from 'vitest';
import { buildReceipt, daysCountAr, promoAdLine } from '../receipt';
import type { PaymentRecord, Subscriber, SystemSettings } from '../../types/isp';
import type { Promotion } from '../../../shared/promotions';

const today = '2026-11-28';
const sub = {
  id: 's1', name: 'علي حسن', phone: '07700000000', username: 'Ali', upstreamProvider: 'Earthlink', planName: 'Economy', costPrice: 25000,
  salePrice: 35000, paidAmount: 70000, startDate: '2026-11-01', expiryDate: '2027-02-01', status: 'active', paymentStatus: 'paid',
  towerName: 'برج 1', createdAt: '2026-01-01', cycleMonths: 3, carriedDebt: 0,
} as Subscriber;
const settings = { ispName: 'شبكة', agentName: '', contactPhone: '+964', address: 'الزبير', currency: 'IQD', warningDaysBeforeExpiry: 3, whatsappFooter: '', referralRewardDays: 10 } as SystemSettings;
const pay: PaymentRecord = {
  id: 'p1', receiptNumber: 'R-2611-0007', subscriberId: 's1', subscriberName: 'علي حسن', amount: 70000, date: '2026-11-27',
  paymentMethod: 'zain_cash', paymentType: 'renewal', cycleMonths: 3, remainingBalanceAfter: 35000, promotionName: 'عرض الشتاء', discount: 0, freeMonths: 1,
};
const promo = (over: Partial<Promotion>): Promotion => ({ id: 'x', name: 'عرض', kind: 'free_months', minMonths: 3, value: 1, active: true, ...over });

describe('thermal receipt', () => {
  it('takes amount, method, months and remaining from the payment record', () => {
    const r = buildReceipt(sub, pay, settings, { today, now: new Date(2026, 10, 28, 14, 5) });
    expect(r).toMatchObject({ number: 'R-2611-0007', date: '2026-11-27', time: '14:05', purpose: 'تجديد اشتراك', method: 'زين كاش',
      months: '3 أشهر', freeMonths: 'شهر', paid: '70,000 د.ع', remaining: 35000, remainingText: '35,000 د.ع', validUntil: '2027-02-01' });
    expect(r.discount).toBeUndefined();
  });
  it('without a payment record uses the custom amount and current debt', () => {
    const r = buildReceipt({ ...sub, paidAmount: 105000 }, undefined, settings, { today, customAmount: 5000 });
    expect(r).toMatchObject({ number: '—', paid: '5,000 د.ع', remaining: 0, remainingText: 'لا شيء (خالص)' });
  });
  it('ads: only running offers (max 3) plus the referral line; can be switched off', () => {
    const s = { ...settings, promotions: [
      promo({ name: 'شتاء', endDate: '2026-12-31' }),
      promo({ name: 'منتهي', endDate: '2026-10-01' }),
      promo({ name: 'موقوف', active: false }),
      promo({ name: 'جديد', kind: 'new_price', value: 0, planPrices: [{ planName: 'Economy', price: 20000 }, { planName: 'Pro', price: 30000 }] }),
    ] };
    const r = buildReceipt(sub, pay, s, { today });
    expect(r.ads).toEqual([
      'شتاء: شهر مجاناً عند تجديد 3 أشهر (حتى 2026-12-31)',
      'جديد: اشتراك جديد لصديقك من 20,000 د.ع للشهر الأول',
      'عرّف صديقاً على شبكتنا واحصل على 10 أيام مجاناً عن كل مشترك جديد يسدد.',
    ]);
    expect(buildReceipt(sub, pay, s, { today, showAds: false }).ads).toEqual([]);
  });
  it('offer texts and Arabic day counts', () => {
    expect(promoAdLine(promo({ name: 'خصم', kind: 'discount_amount', value: 5000, minMonths: 1 }), 'IQD', today)).toBe('خصم: خصم 5,000 د.ع عند التجديد');
    expect(promoAdLine(promo({ name: 'نسبة', kind: 'discount_percent', value: 10, minMonths: 6 }), 'IQD', today)).toBe('نسبة: خصم 10% عند تجديد 6 أشهر');
    expect(promoAdLine(promo({ startDate: '2026-12-01' }), 'IQD', today)).toBeNull();
    expect([1, 2, 7, 15].map(daysCountAr)).toEqual(['يوم واحد', 'يومين', '7 أيام', '15 يوماً']);
  });
});
