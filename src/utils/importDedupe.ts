import { Subscriber } from '../types/isp';
import { normalizeNameKey } from './storage';

/**
 * منع التكرار عند الاستيراد: يُتجاوز الصف إذا طابق مشتركاً موجوداً (أو صفاً سابقاً في الملف)
 * باليوزر تماماً (الحروف الكبيرة والصغيرة تُعدّ مختلفة: «Ali» غير «ali») أو بالاسم (مع توحيد الألف والتاء المربوطة…).
 */
export function splitImportDuplicates<T extends Partial<Subscriber>>(rows: T[], existing: Subscriber[]): { unique: T[]; skipped: string[] } {
  const seenUsernames = new Set<string>();
  const seenNames = new Set<string>();
  existing.forEach(s => {
    if (s.username) seenUsernames.add(s.username.trim());
    seenNames.add(normalizeNameKey(s.name));
  });
  const skipped: string[] = [];
  const unique = rows.filter(row => {
    const uname = row.username?.trim();
    const nameKey = normalizeNameKey(row.name || '');
    if ((uname && seenUsernames.has(uname)) || (nameKey && seenNames.has(nameKey))) {
      skipped.push(row.name || row.username || '');
      return false;
    }
    if (uname) seenUsernames.add(uname);
    if (nameKey) seenNames.add(nameKey);
    return true;
  });
  return { unique, skipped };
}
