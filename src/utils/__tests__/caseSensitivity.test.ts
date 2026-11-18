import { describe, expect, it } from 'vitest';
import { Subscriber } from '../../types/isp';
import { splitImportDuplicates } from '../importDedupe';
import { matchesSubscriber } from '../search';

const sub = (username: string, name = 'أحمد'): Subscriber => ({
  id: username, name, phone: '', username, upstreamProvider: 'E', planName: 'Basic', costPrice: 0, salePrice: 0, paidAmount: 0,
  startDate: '2026-01-01', expiryDate: '2026-02-01', status: 'active', paymentStatus: 'paid', towerName: '', createdAt: '2026-01-01',
});

describe('usernames are case-sensitive', () => {
  it('import keeps "Ali" and "ali" as two different users', () => {
    const { unique, skipped } = splitImportDuplicates(
      [{ name: 'مشترك 1', username: 'Ali' }, { name: 'مشترك 2', username: 'ali' }, { name: 'مشترك 3', username: 'ALI' }], []);
    expect(unique).toHaveLength(3);
    expect(skipped).toEqual([]);
  });

  it('import still skips the exact same username, in the file and against existing users', () => {
    const { unique, skipped } = splitImportDuplicates(
      [{ name: 'جديد 1', username: 'Ali' }, { name: 'جديد 2', username: 'Ali' }, { name: 'جديد 3', username: 'ahmed7' }],
      [sub('ahmed7', 'قديم')]);
    expect(unique.map(r => r.name)).toEqual(['جديد 1']);
    expect(skipped).toEqual(['جديد 2', 'جديد 3']);
  });

  it('import still skips the same name written with alef/hamza variants', () => {
    const { unique } = splitImportDuplicates([{ name: 'احمد', username: 'x1' }], [sub('y1', 'أحمد')]);
    expect(unique).toHaveLength(0);
  });

  it('search: lowercase finds both, a capital letter finds only the exact user', () => {
    const upper = sub('Ali99', 'س'), lower = sub('ali99', 'ص');
    expect(matchesSubscriber(upper, 'ali')).toBe(true);
    expect(matchesSubscriber(lower, 'ali')).toBe(true);
    expect(matchesSubscriber(upper, 'Ali')).toBe(true);
    expect(matchesSubscriber(lower, 'Ali')).toBe(false);
    expect(matchesSubscriber(upper, 'ALI')).toBe(false);
    expect(matchesSubscriber(upper, 'Ali99')).toBe(true);
  });

  it('search by name and phone is unaffected by the capital-letter rule', () => {
    const s = { ...sub('u1', 'أحمد كريم'), phone: '07801234567' };
    expect(matchesSubscriber(s, 'احمد')).toBe(true);
    expect(matchesSubscriber(s, '0780123')).toBe(true);
  });
});
