import { PaymentRecord, Subscriber } from '../types/isp';
import { diffDays, todayStr } from './dates';
import { NO_TOWER_LABEL, normTower } from './towers';

/** بعد كم يوم من الانتهاء بدون تجديد يُعتبر المشترك «مفقوداً» */
export const LOST_AFTER_DAYS = 30;
/** يوم أُضيف فيه أكثر من هذا العدد = استيراد جماعي (ليسوا مشتركين جدداً فعلاً) */
const BULK_IMPORT_PER_DAY = 15;

export interface MonthMovement {
  month: string;
  newCount: number;       // مشتركون جدد فعلاً (بدون الاستيراد الجماعي)
  renewedCount: number;   // مشتركون جددوا في الشهر (مرة واحدة لكل مشترك)
  returnedCount: number;  // جددوا بعد انقطاع أكثر من 30 يوماً (استرجاع)
  lostCount: number;      // انتهى اشتراكهم في الشهر ولم يجددوا خلال 30 يوماً
  pendingCount: number;   // انتهوا في الشهر ولم يمر 30 يوماً بعد (قد يجددون)
  net: number;            // الجدد + المسترجعون − المفقودون
  retention: number | null; // نسبة الاحتفاظ: المجددون ÷ (المجددون + المفقودون)
}

export function lastMonthKeys(count: number, today: string = todayStr()): string[] {
  const [y, m] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** معرّفات المشتركين المضافين باستيراد جماعي (حقل source أو يوم إضافة مزدحم) */
export function importedIds(subscribers: Subscriber[]): Set<string> {
  const perDay = new Map<string, number>();
  subscribers.forEach(s => {
    const d = (s.createdAt || '').slice(0, 10);
    perDay.set(d, (perDay.get(d) || 0) + 1);
  });
  return new Set(subscribers
    .filter(s => s.source === 'import' || (perDay.get((s.createdAt || '').slice(0, 10)) || 0) > BULK_IMPORT_PER_DAY)
    .map(s => s.id));
}

function isLost(s: Subscriber, today: string): boolean {
  return s.status !== 'suspended' && !!s.expiryDate && diffDays(s.expiryDate, today) > LOST_AFTER_DAYS;
}

export function subscriberMovement(
  subscribers: Subscriber[],
  payments: PaymentRecord[],
  months: string[],
  today: string = todayStr(),
): MonthMovement[] {
  const imported = importedIds(subscribers);
  return months.map(month => {
    const newCount = subscribers.filter(s => !imported.has(s.id) && (s.createdAt || '').slice(0, 7) === month).length;
    const renewals = payments.filter(p => p.paymentType === 'renewal' && (p.date || '').slice(0, 7) === month);
    const renewedCount = new Set(renewals.map(p => p.subscriberId)).size;
    const returnedCount = new Set(renewals.filter(p => (p.lateDays || 0) > LOST_AFTER_DAYS).map(p => p.subscriberId)).size;
    const expiredHere = subscribers.filter(s => s.status !== 'suspended' && (s.expiryDate || '').slice(0, 7) === month && s.expiryDate < today);
    const lostCount = expiredHere.filter(s => isLost(s, today)).length;
    const pendingCount = expiredHere.length - lostCount;
    const base = renewedCount + lostCount;
    return {
      month, newCount, renewedCount, returnedCount, lostCount, pendingCount,
      net: newCount + returnedCount - lostCount,
      retention: base ? Math.round((renewedCount / base) * 100) : null,
    };
  });
}

/** الجدد والمفقودون لكل برج خلال الأشهر المحددة */
export function movementByTower(subscribers: Subscriber[], months: string[], today: string = todayStr()) {
  const imported = importedIds(subscribers);
  const set = new Set(months);
  const map = new Map<string, { tower: string; newCount: number; lostCount: number; total: number }>();
  subscribers.forEach(s => {
    const tower = normTower(s.towerName) || NO_TOWER_LABEL;
    const row = map.get(tower) || { tower, newCount: 0, lostCount: 0, total: 0 };
    row.total++;
    if (!imported.has(s.id) && set.has((s.createdAt || '').slice(0, 7))) row.newCount++;
    if (set.has((s.expiryDate || '').slice(0, 7)) && isLost(s, today)) row.lostCount++;
    map.set(tower, row);
  });
  return [...map.values()].filter(r => r.newCount || r.lostCount).sort((a, b) => (a.newCount - a.lostCount) - (b.newCount - b.lostCount));
}
