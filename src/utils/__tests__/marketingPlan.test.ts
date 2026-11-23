import { describe, expect, it } from 'vitest';
import { PaymentRecord, PlanItem } from '../../types/isp';
import { ACTION_IDEAS, buildPlanItem, daysBetween, groupPlan, ideaById, planAlertCount, planResults, planStatus, upcomingOccasions, validatePlanInput } from '../marketingPlan';
import { applicablePromotions } from '../../../shared/promotions';

const T = '2026-11-23';
const item = (over: Partial<PlanItem> = {}): PlanItem => ({ id: 'i', ideaId: 'x', title: 't', startDate: '2026-12-01', createdAt: '2026-11-01', ...over });

describe('idea library', () => {
  it('every idea is readable: title, goal, when, how, effect', () => {
    for (const i of ACTION_IDEAS) {
      for (const f of [i.title, i.goal, i.whenToUse, i.howInApp, i.effect]) expect(f.trim().length).toBeGreaterThan(10);
      expect(/[؀-ۿ]/.test(i.title)).toBe(true); // Arabic
    }
    expect(new Set(ACTION_IDEAS.map(i => i.id)).size).toBe(ACTION_IDEAS.length);
  });
  it('offers carry a template, campaigns a segment', () => {
    for (const i of ACTION_IDEAS) {
      if (i.kind === 'offer') expect(i.offer && i.offer.value > 0).toBeTruthy();
      if (i.kind === 'campaign') expect(i.segment).toBeTruthy();
    }
  });
});

describe('occasions', () => {
  const occ = upcomingOccasions(T);
  const find = (p: string) => occ.find(o => o.id.startsWith(p));
  it('finds Ramadan, both Eids and school start with sensible dates (Umm al-Qura, ±2 days)', () => {
    const near = (d: string, a: string, b: string) => expect(d >= a && d <= b).toBe(true);
    near(find('ramadan')!.start, '2027-02-07', '2027-02-10');
    near(find('fitr')!.start, '2027-03-08', '2027-03-12');
    near(find('adha')!.start, '2027-05-15', '2027-05-19');
    expect(find('school')!.start).toBe('2027-09-20');
  });
  it('is sorted, in range, and every suggestion exists in the library', () => {
    expect([...occ].sort((a, b) => a.start.localeCompare(b.start))).toEqual(occ);
    for (const o of occ) { expect(o.end >= T).toBe(true); o.suggested.forEach(id => expect(ideaById(id)).toBeTruthy()); }
  });
  it('includes an occasion that is running today', () => {
    const during = upcomingOccasions('2027-02-20'); // inside Ramadan
    expect(during.some(o => o.id.startsWith('ramadan') && o.start <= '2027-02-20' && o.end >= '2027-02-20')).toBe(true);
  });
});

describe('plan items', () => {
  it('status by dates', () => {
    expect(planStatus(item(), T)).toBe('upcoming');
    expect(planStatus(item({ startDate: '2026-11-20' }), T)).toBe('running');
    expect(planStatus(item({ startDate: '2026-11-01', endDate: '2026-11-22' }), T)).toBe('done');
    expect(planStatus(item({ startDate: '2026-11-01', endDate: T }), T)).toBe('running'); // end day inclusive
    expect(planStatus(item({ skipped: true }), T)).toBe('skipped');
  });
  it('groups and sorts', () => {
    const g = groupPlan([item({ id: 'b', startDate: '2026-12-10' }), item({ id: 'a', startDate: '2026-12-01' }), item({ id: 'r', startDate: '2026-11-20' })], T);
    expect(g.upcoming.map(i => i.id)).toEqual(['a', 'b']);
    expect(g.running.map(i => i.id)).toEqual(['r']);
  });
  it('alerts only for items starting within 3 days', () => {
    const list = [item({ startDate: '2026-11-24' }), item({ startDate: '2026-11-26' }), item({ startDate: '2026-11-27' }), item({ startDate: '2026-11-25', skipped: true }), item({ startDate: T })];
    expect(planAlertCount(list, T)).toBe(2);
    expect(planAlertCount(undefined, T)).toBe(0);
  });
  it('validates input', () => {
    expect(validatePlanInput({ title: ' ', startDate: '2026-12-01' })).toBeTruthy();
    expect(validatePlanInput({ title: 'x', startDate: '' })).toBeTruthy();
    expect(validatePlanInput({ title: 'x', startDate: '2026-12-05', endDate: '2026-12-01' })).toBeTruthy();
    expect(validatePlanInput({ title: 'x', startDate: '2026-12-01', endDate: '2026-12-31' })).toBeNull();
  });
  it('daysBetween', () => expect(daysBetween('2026-11-23', '2026-12-03')).toBe(10));
});

describe('plan creates a working offer', () => {
  it('3+1 idea with "create offer": linked, dated, and applicable in the renewal dialog only during the period', () => {
    const { item: it, promotion } = buildPlanItem(ideaById('free-3-1')!, { title: 'عرض رمضان', startDate: '2026-12-01', endDate: '2026-12-31', createOffer: true }, new Date('2026-11-23T10:00:00Z'));
    expect(promotion).toMatchObject({ name: 'عرض رمضان', kind: 'free_months', minMonths: 3, value: 1, active: true, startDate: '2026-12-01', endDate: '2026-12-31' });
    expect(it.promotionId).toBe(promotion!.id);
    const ctx = (today: string) => ({ months: 3, salePrice: 40000, today, expiryDate: '2026-12-20' });
    expect(applicablePromotions([promotion!], ctx('2026-11-30'))).toHaveLength(0);
    expect(applicablePromotions([promotion!], ctx('2026-12-15'))).toHaveLength(1);
    expect(applicablePromotions([promotion!], ctx('2027-01-01'))).toHaveLength(0);
  });
  it('without the checkbox, or for campaigns, no offer is created; campaigns remember their segment', () => {
    expect(buildPlanItem(ideaById('free-3-1')!, { title: 'x', startDate: '2026-12-01' }).promotion).toBeUndefined();
    const c = buildPlanItem(ideaById('winback')!, { title: '', startDate: '2026-12-01', createOffer: true });
    expect(c.promotion).toBeUndefined();
    expect(c.item).toMatchObject({ ideaId: 'winback', segment: 'lost', title: 'حملة استرجاع المنقطعين' });
  });
  it('results come from receipts that used the linked offer', () => {
    const pays = [{ promotionId: 'p1', amount: 120000, discount: 40000 }, { promotionId: 'p1', amount: 80000, discount: 40000 }, { promotionId: 'other', amount: 5, discount: 5 }] as PaymentRecord[];
    expect(planResults(item({ promotionId: 'p1' }), pays)).toEqual({ uses: 2, revenue: 200000, cost: 80000 });
    expect(planResults(item(), pays)).toBeNull();
  });
});
