import { PaymentRecord, Subscriber, TowerPoint } from '../types/isp';
import { getPaymentCost, getRemainingDebt } from './storage';
import { todayStr } from './dates';

/** اسم يظهر للمشتركين غير المربوطين بأي برج */
export const NO_TOWER_LABEL = 'بدون برج';

export interface TowerStats {
  name: string;
  tower?: TowerPoint;          // غير موجود = اسم مستخدم عند مشتركين لكنه غير مسجل كبرج
  registered: boolean;
  subscribers: number;
  active: number;              // نشط أو ينتهي قريباً
  expired: number;
  monthlyRevenue: number;      // الإيراد الشهري المتوقع: رسوم كل المشتركين غير الموقوفين
  monthlyProfit: number;       // الربح الشهري المتوقع: الرسوم ناقص كلفة الجملة لنفس المشتركين
  debts: number;               // المتبقي بذمة المشتركين
  collectedThisMonth: number;  // الوصولات المقبوضة هذا الشهر
  profitThisMonth: number;     // المقبوض هذا الشهر ناقص كلفته
}

export const normTower = (name?: string) => (name || '').trim();

/**
 * إحصائيات كل برج. تشمل الأبراج المسجلة (حتى لو بدون مشتركين)،
 * والأسماء المستخدمة عند مشتركين دون تسجيل، ومجموعة "بدون برج".
 */
export function computeTowerStats(
  subscribers: Subscriber[],
  payments: PaymentRecord[],
  towers: TowerPoint[],
  month: string = todayStr().slice(0, 7),
): TowerStats[] {
  const map = new Map<string, TowerStats>();
  const ensure = (name: string, tower?: TowerPoint): TowerStats => {
    let s = map.get(name);
    if (!s) {
      s = {
        name, tower, registered: !!tower,
        subscribers: 0, active: 0, expired: 0,
        monthlyRevenue: 0, monthlyProfit: 0, debts: 0,
        collectedThisMonth: 0, profitThisMonth: 0,
      };
      map.set(name, s);
    }
    return s;
  };

  towers.forEach(t => ensure(normTower(t.name), t));

  const towerOfSub = new Map<string, string>();
  subscribers.forEach(sub => {
    const name = normTower(sub.towerName) || NO_TOWER_LABEL;
    towerOfSub.set(sub.id, name);
    const s = ensure(name);
    s.subscribers++;
    if (sub.status === 'expired' || sub.status === 'suspended') s.expired++;
    else s.active++;
    // المنتهي غالباً يجدد، لذلك يُحسب في المتوقع؛ الموقوف لا يُحسب
    if (sub.status !== 'suspended') {
      s.monthlyRevenue += sub.salePrice || 0;
      s.monthlyProfit += (sub.salePrice || 0) - (sub.costPrice || 0);
    }
    s.debts += getRemainingDebt(sub);
  });

  payments
    .filter(p => (p.date || '').startsWith(month))
    .forEach(p => {
      // البرج وقت الدفع، وإلا البرج الحالي للمشترك
      const name = normTower(p.towerName) || towerOfSub.get(p.subscriberId) || NO_TOWER_LABEL;
      const s = ensure(name);
      s.collectedThisMonth += p.amount || 0;
      s.profitThisMonth += (p.amount || 0) - getPaymentCost(p, subscribers);
    });

  return [...map.values()];
}

export type TowerSortKey = 'subscribers' | 'monthlyProfit' | 'collectedThisMonth' | 'debts';

export function sortTowerStats(list: TowerStats[], key: TowerSortKey): TowerStats[] {
  return [...list].sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name, 'ar'));
}
