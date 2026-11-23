import { PaymentRecord, Subscriber, UpstreamProvider } from '../types/isp';
import { diffDays, parseLocalDate, toLocalDateStr } from './dates';
import { getRemainingDebt } from './storage';
import { normTower } from './towers';

/**
 * التسويق: مجموعات الاستهداف (حملات واتساب) ودعوة الأصدقاء. دوال صرفة.
 * من اختار «لا يرغب بالعروض» (noMarketing) لا يدخل مجموعات العروض، لكنه يبقى في إشعارات الخدمة (البرج).
 */

export type SegmentId = 'lost' | 'loyal' | 'upgrade' | 'tower';
export const LOST_AFTER_DAYS = 30;

export const addDays = (date: string, days: number): string => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
};

/** مجموع الأشهر التي جدّدها المشترك منذ تاريخ معيّن */
export function renewedMonthsSince(subId: string, payments: PaymentRecord[], since: string): number {
  return payments
    .filter(p => p.subscriberId === subId && p.paymentType === 'renewal' && p.date >= since)
    .reduce((a, p) => a + (p.cycleMonths && p.cycleMonths > 0 ? p.cycleMonths : 1), 0);
}

/** أقرب باقة أعلى سعراً لدى نفس المزود */
export function higherPlan(sub: Subscriber, providers: UpstreamProvider[]): { name: string; price: number } | null {
  const prov = providers.find(p => p.name === sub.upstreamProvider);
  const next = (prov?.plans || [])
    .filter(pl => pl.defaultSalePrice > (sub.salePrice || 0))
    .sort((a, b) => a.defaultSalePrice - b.defaultSalePrice)[0];
  return next ? { name: next.name, price: next.defaultSalePrice } : null;
}

export function segmentMembers(
  id: SegmentId, subs: Subscriber[], payments: PaymentRecord[], providers: UpstreamProvider[], today: string, tower = 'all',
): Subscriber[] {
  const live = subs.filter(s => !s.archived);
  const active = (s: Subscriber) => (s.expiryDate || '') >= today;
  const clean = (s: Subscriber) => getRemainingDebt(s) <= 0;
  switch (id) {
    case 'lost':
      return live.filter(s => !s.noMarketing && diffDays(s.expiryDate, today) > LOST_AFTER_DAYS);
    case 'loyal':
      return live.filter(s => !s.noMarketing && active(s) && clean(s) && renewedMonthsSince(s.id, payments, addDays(today, -365)) >= 6);
    case 'upgrade':
      return live.filter(s => !s.noMarketing && active(s) && clean(s) && renewedMonthsSince(s.id, payments, addDays(today, -180)) >= 3 && !!higherPlan(s, providers));
    case 'tower':
      // إشعار خدمة (عطل، صيانة، برج جديد): للمشتركين الحاليين أو المنتهين منذ أقل من شهر
      return live.filter(s => (s.expiryDate || '') >= addDays(today, -LOST_AFTER_DAYS) && (tower === 'all' || normTower(s.towerName) === tower));
  }
}

/** المدعوون الذين دفعوا ولم يحصل داعيهم على مكافأته بعد */
export function pendingReferrals(referrer: Subscriber, subs: Subscriber[]): Subscriber[] {
  return subs.filter(s => s.referredBy === referrer.id && !s.referralRewarded && !s.archived && ((s.paidAmount || 0) > 0 || !!s.lastPaymentDate));
}

export function referralBoard(subs: Subscriber[]): Array<{ sub: Subscriber; total: number; rewarded: number; pending: number }> {
  const byId = new Map(subs.map(s => [s.id, s]));
  const rows = new Map<string, { sub: Subscriber; total: number; rewarded: number; pending: number }>();
  for (const s of subs) {
    if (!s.referredBy || !byId.has(s.referredBy)) continue;
    const r = rows.get(s.referredBy) || { sub: byId.get(s.referredBy)!, total: 0, rewarded: 0, pending: 0 };
    r.total++;
    if (s.referralRewarded) r.rewarded++;
    else if ((s.paidAmount || 0) > 0 || s.lastPaymentDate) r.pending++;
    rows.set(s.referredBy, r);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.sub.name.localeCompare(b.sub.name, 'ar'));
}

/** يملأ {الاسم} و{العرض} … في نص الرسالة؛ المتغير غير المعروف يُحذف */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (_m, key: string) => vars[key.trim()] ?? '').replace(/[ \t]{2,}/g, ' ').trim();
}
