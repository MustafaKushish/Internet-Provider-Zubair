import { Expense, PaymentRecord, Subscriber, SupportTicket, SystemSettings, TowerPoint, UpstreamProvider } from '../types/isp';
import { EXPENSE_CATEGORIES, expensesByTower, expensesInMonth, netProfitInMonth, sumAmounts } from '../utils/expenses';
import { LOST_AFTER_DAYS, lastMonthKeys, movementByTower, subscriberMovement } from '../utils/growth';
import { planProgress } from '../utils/installments';
import { getDaysRemaining, getPaymentCost, getRemainingDebt } from '../utils/storage';
import { computeTowerStats, sortTowerStats, NO_TOWER_LABEL, normTower } from '../utils/towers';
import { todayStr } from '../utils/dates';

/**
 * لقطة أرقام تجارية للمستشار الذكي.
 * لا تحتوي أي بيانات شخصية: لا أسماء، لا هواتف، لا أسماء مستخدمين، لا كلمات مرور، لا عناوين، لا IP.
 */

/** الحد الأقصى لنص «معلومات عملي» المرسل للمستشار */
export const ADVISOR_NOTES_MAX = 3000;

const n = (x: number) => Math.round(x).toLocaleString('en-US');

function monthKey(date: string): string {
  return (date || '').slice(0, 7);
}

function lastMonths(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    out.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

const ISSUE_LABELS: Record<string, string> = {
  connection_problem: 'انقطاع الاتصال',
  billing_dispute: 'نزاع مالي',
  slow_speed: 'بطء السرعة',
  router_config: 'إعدادات الراوتر',
  nanostation_signal: 'ضعف إشارة النانو',
  cable_fiber_cut: 'قطع كيبل/فايبر',
  other: 'أخرى',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً', zain_cash: 'زين كاش', qi_card: 'كي كارد', transfer: 'تحويل',
};

export function buildBusinessSnapshot(input: {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  tickets: SupportTicket[];
  providers: UpstreamProvider[];
  towers: TowerPoint[];
  settings: SystemSettings;
  expenses?: Expense[];
}): string {
  const { subscribers, payments, tickets, providers, towers, settings } = input;
  const expenses = input.expenses || [];
  const today = todayStr();
  const lines: string[] = [];
  const cur = settings.currency === 'USD' ? 'دولار' : 'دينار عراقي';

  lines.push(`التاريخ: ${today} | العملة: ${cur} | منطقة العمل: الزبير - البصرة | تنبيه قبل الانتهاء: ${settings.warningDaysBeforeExpiry} أيام`);

  const notes = (settings.advisorNotes || '').trim();
  if (notes) {
    lines.push('');
    lines.push('## معلومات من صاحب الشبكة (كلف، منافسون، سعة الأبراج، أهداف)');
    lines.push(notes.slice(0, ADVISOR_NOTES_MAX));
  }

  // ---------- المشتركون ----------
  const active = subscribers.filter(s => s.status === 'active').length;
  const soon = subscribers.filter(s => s.status === 'expiring_soon').length;
  const expired = subscribers.filter(s => s.status === 'expired').length;
  const suspended = subscribers.filter(s => s.status === 'suspended').length;
  const totalDebt = subscribers.reduce((a, s) => a + getRemainingDebt(s), 0);
  const debtors = subscribers.filter(s => getRemainingDebt(s) > 0).length;
  const noPhone = subscribers.filter(s => !(s.phone || '').trim()).length;
  const noTower = subscribers.filter(s => !(s.towerName || '').trim()).length;
  lines.push('');
  lines.push('## المشتركون');
  lines.push(`الإجمالي ${subscribers.length} | نشط ${active} | ينتهي قريباً ${soon} | منتهي ${expired} | موقوف ${suspended}`);
  lines.push(`مدينون ${debtors} بمجموع ${n(totalDebt)} | بدون رقم هاتف ${noPhone} | بدون برج ${noTower}`);

  // أعمار الاشتراكات المنتهية (منذ كم يوم انتهت)
  const buckets = { '1-7': 0, '8-30': 0, '31-90': 0, '>90': 0 };
  subscribers.forEach(s => {
    const d = -getDaysRemaining(s.expiryDate);
    if (d <= 0) return;
    if (d <= 7) buckets['1-7']++;
    else if (d <= 30) buckets['8-30']++;
    else if (d <= 90) buckets['31-90']++;
    else buckets['>90']++;
  });
  lines.push(`منتهون منذ (أيام): 1-7: ${buckets['1-7']} | 8-30: ${buckets['8-30']} | 31-90: ${buckets['31-90']} | أكثر من 90: ${buckets['>90']}`);
  const next7 = subscribers.filter(s => { const d = getDaysRemaining(s.expiryDate); return d >= 0 && d <= 7; }).length;
  const next30 = subscribers.filter(s => { const d = getDaysRemaining(s.expiryDate); return d >= 0 && d <= 30; }).length;
  lines.push(`ينتهي خلال 7 أيام: ${next7} | خلال 30 يوماً: ${next30}`);

  // ---------- الباقات والأسعار ----------
  const plans = new Map<string, { count: number; sale: number; cost: number; active: number }>();
  subscribers.forEach(s => {
    const key = `${s.upstreamProvider} / ${s.planName}`;
    const p = plans.get(key) || { count: 0, sale: 0, cost: 0, active: 0 };
    p.count++;
    p.sale += s.salePrice || 0;
    p.cost += s.costPrice || 0;
    if (s.status !== 'expired' && s.status !== 'suspended') p.active++;
    plans.set(key, p);
  });
  lines.push('');
  lines.push('## الباقات المستخدمة (متوسط سعر البيع / متوسط كلفة الجملة / الهامش)');
  [...plans.entries()].sort((a, b) => b[1].count - a[1].count).forEach(([k, p]) => {
    const sale = p.sale / p.count, cost = p.cost / p.count;
    lines.push(`- ${k}: ${p.count} مشترك (غير منتهٍ ${p.active}) | بيع ${n(sale)} | كلفة ${n(cost)} | هامش ${n(sale - cost)} (${sale ? Math.round(((sale - cost) / sale) * 100) : 0}%)`);
  });
  lines.push('أسعار الجملة والبيع المعرّفة لدى المزودين:');
  providers.forEach(pr => {
    lines.push(`- ${pr.name}: ${pr.plans.map(pl => `${pl.name}${pl.speed ? ` (${pl.speed})` : ''} كلفة ${n(pl.defaultCost)} بيع ${n(pl.defaultSalePrice)}`).join('، ')}`);
  });

  // ---------- الأبراج ----------
  const towerStats = sortTowerStats(computeTowerStats(subscribers, payments, towers), 'monthlyProfit');
  lines.push('');
  lines.push('## الأبراج (الربح الشهري المتوقع = رسوم شهر لكل مشترك غير موقوف ناقص الكلفة)');
  towerStats.forEach(t => {
    const meta = t.tower ? [t.tower.location, t.tower.ipRange].filter(Boolean).join(' | ') : (t.name === NO_TOWER_LABEL ? '' : 'غير مسجل كبرج');
    lines.push(`- ${t.name}${meta ? ` [${meta}]` : ''}: مشتركون ${t.subscribers} (نشط ${t.active}، منتهٍ ${t.expired}) | إيراد متوقع ${n(t.monthlyRevenue)} | ربح متوقع ${n(t.monthlyProfit)} | مقبوض هذا الشهر ${n(t.collectedThisMonth)} | ديون ${n(t.debts)}`);
  });

  // ---------- مؤشرات النمو لكل برج ----------
  const totalProfit = towerStats.reduce((a, t) => a + Math.max(0, t.monthlyProfit), 0);
  const ticketSince = new Date();
  ticketSince.setDate(ticketSince.getDate() - 90);
  const ticketSinceStr = ticketSince.toISOString().slice(0, 10);
  const recentMonths = new Set(lastMonths(3));
  const towerOf = (name?: string) => normTower(name) || NO_TOWER_LABEL;
  lines.push('');
  lines.push('## مؤشرات النمو لكل برج');
  lines.push('(حصة الربح | متوسط سعر المشترك ARPU | هامش المشترك | نسبة التجديد = غير المنتهين ÷ الكل | مجمع الاسترجاع = منتهون خلال 90 يوماً وقيمتهم الشهرية | مفقودون أكثر من 90 يوماً | الديون ÷ الإيراد الشهري | بلاغات 90 يوماً لكل 10 مشتركين | جدد آخر 3 أشهر)');
  let winBackCount = 0, winBackValue = 0;
  towerStats.forEach(t => {
    const subs = subscribers.filter(s => towerOf(s.towerName) === t.name);
    if (!subs.length) {
      lines.push(`- ${t.name}: لا مشتركين بعد (برج مسجل بدون استغلال)`);
      return;
    }
    const arpu = subs.reduce((a, s) => a + (s.salePrice || 0), 0) / subs.length;
    const margin = subs.reduce((a, s) => a + (s.salePrice || 0) - (s.costPrice || 0), 0) / subs.length;
    const renewal = Math.round((t.active / subs.length) * 100);
    const pool = subs.filter(s => { const d = -getDaysRemaining(s.expiryDate); return d > 0 && d <= 90 && s.status !== 'suspended'; });
    const poolValue = pool.reduce((a, s) => a + (s.salePrice || 0) - (s.costPrice || 0), 0);
    winBackCount += pool.length; winBackValue += poolValue;
    const lost = subs.filter(s => -getDaysRemaining(s.expiryDate) > 90).length;
    const debtRatio = t.monthlyRevenue ? Math.round((t.debts / t.monthlyRevenue) * 100) : 0;
    const tk = tickets.filter(x => (x.createdAt || '') >= ticketSinceStr && towerOf(x.towerName) === t.name).length;
    const fresh = subs.filter(s => recentMonths.has(monthKey(s.createdAt))).length;
    const share = totalProfit ? Math.round((Math.max(0, t.monthlyProfit) / totalProfit) * 100) : 0;
    lines.push(`- ${t.name}: حصة ${share}% | ARPU ${n(arpu)} | هامش ${n(margin)} | تجديد ${renewal}% | استرجاع ${pool.length} بقيمة ربح ${n(poolValue)} شهرياً | مفقود ${lost} | ديون/إيراد ${debtRatio}% | بلاغات ${(tk / subs.length * 10).toFixed(1)} | جدد ${fresh}`);
  });

  // ---------- مؤشرات الشبكة ----------
  const expectedRevenue = towerStats.reduce((a, t) => a + t.monthlyRevenue, 0);
  const collectedNow = towerStats.reduce((a, t) => a + t.collectedThisMonth, 0);
  const allMargin = subscribers.length ? subscribers.reduce((a, s) => a + (s.salePrice || 0) - (s.costPrice || 0), 0) / subscribers.length : 0;
  lines.push('');
  lines.push('## مؤشرات الشبكة');
  lines.push(`الإيراد الشهري المتوقع ${n(expectedRevenue)} | المقبوض هذا الشهر حتى اليوم ${n(collectedNow)} (${expectedRevenue ? Math.round((collectedNow / expectedRevenue) * 100) : 0}%) | متوسط هامش المشترك ${n(allMargin)}`);
  lines.push(`مجمع الاسترجاع الكلي: ${winBackCount} مشترك منتهٍ خلال 90 يوماً = ربح ${n(winBackValue)} شهرياً إذا عادوا | الديون الكلية = ${expectedRevenue ? (totalDebt / expectedRevenue).toFixed(1) : 0} شهر من الإيراد`);

  // ---------- المقبوضات ----------
  const months = lastMonths(6);
  lines.push('');
  lines.push('## المقبوضات الفعلية آخر 6 أشهر (المبلغ / عدد الوصولات / الربح بعد كلفة الجملة)');
  months.forEach(m => {
    const ps = payments.filter(p => monthKey(p.date) === m);
    const sum = ps.reduce((a, p) => a + (p.amount || 0), 0);
    const profit = ps.reduce((a, p) => a + (p.amount || 0) - getPaymentCost(p, subscribers), 0);
    lines.push(`- ${m}: ${n(sum)} / ${ps.length} / ${n(profit)}`);
  });
  const methodCounts: Record<string, number> = {};
  payments.forEach(p => { methodCounts[p.paymentMethod] = (methodCounts[p.paymentMethod] || 0) + 1; });
  if (payments.length) {
    lines.push(`طرق الدفع (كل الوصولات): ${Object.entries(methodCounts).map(([k, v]) => `${METHOD_LABELS[k] || k} ${v}`).join('، ')}`);
  }
  const newPerMonth = months.map(m => `${m}: ${subscribers.filter(s => monthKey(s.createdAt) === m).length}`);
  lines.push(`مشتركون جدد مسجلون في المنظومة حسب الشهر: ${newPerMonth.join(' | ')}`);

  // ---------- المصاريف وصافي الربح الحقيقي ----------
  const exMonths = lastMonths(3);
  lines.push('');
  lines.push('## المصاريف التشغيلية وصافي الربح الحقيقي (ربح الوصولات بعد كلفة الجملة − المصاريف)');
  if (!expenses.length) {
    lines.push('لم تُسجل أي مصاريف تشغيلية في المنظومة بعد (إيجار، مولد، رواتب…)، لذلك الربح أعلاه قبل المصاريف.');
  } else {
    exMonths.forEach(m => {
      const r = netProfitInMonth(payments, subscribers, expenses, m);
      lines.push(`- ${m}: ربح الوصولات ${n(r.profit)} | المصاريف ${n(r.expenses)} | الصافي ${n(r.net)}`);
    });
    const recent = exMonths.flatMap(m => expensesInMonth(expenses, m));
    const cats = EXPENSE_CATEGORIES.map(c => [c.label, sumAmounts(recent.filter(e => e.category === c.id))] as const).filter(([, t]) => t > 0);
    if (cats.length) lines.push(`المصاريف حسب النوع (آخر 3 أشهر): ${cats.map(([l, t]) => `${l} ${n(t)}`).join('، ')}`);
    const byTower = [...expensesByTower(expenses, exMonths[exMonths.length - 1]).entries()];
    if (byTower.length) lines.push(`مصاريف هذا الشهر حسب البرج: ${byTower.map(([t, v]) => `${t || 'عامة'} ${n(v)}`).join('، ')}`);
  }

  // ---------- حركة المشتركين ----------
  lines.push('');
  lines.push(`## حركة المشتركين (جدد / جددوا / مسترجعون / مفقودون = انتهى ولم يجدد خلال ${LOST_AFTER_DAYS} يوماً / صافي / الاحتفاظ)`);
  subscriberMovement(subscribers, payments, lastMonthKeys(6)).forEach(m => {
    lines.push(`- ${m.month}: ${m.newCount} / ${m.renewedCount} / ${m.returnedCount} / ${m.lostCount} / ${m.net >= 0 ? '+' : ''}${m.net} / ${m.retention === null ? '—' : `${m.retention}%`}`);
  });
  const tm = movementByTower(subscribers, lastMonthKeys(3));
  if (tm.length) lines.push(`حسب البرج آخر 3 أشهر (جدد/مفقودون): ${tm.map(t => `${t.tower} +${t.newCount}/−${t.lostCount}`).join('، ')}`);
  const activePlans = subscribers.map(s => planProgress(s, payments)).filter(p => p && p.status !== 'done');
  if (activePlans.length) {
    const late = activePlans.filter(p => p!.status === 'late');
    lines.push(`خطط تقسيط الديون النشطة: ${activePlans.length} (متأخرة ${late.length} بمبلغ ${n(late.reduce((a, p) => a + p!.arrears, 0))})`);
  }

  // ---------- الدعم الفني ----------
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().slice(0, 10);
  const recent = tickets.filter(t => (t.createdAt || '') >= sinceStr);
  lines.push('');
  lines.push(`## بلاغات الدعم آخر 90 يوماً: ${recent.length} (مفتوحة الآن ${tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length})`);
  if (recent.length) {
    const byType: Record<string, number> = {};
    const byTower: Record<string, number> = {};
    recent.forEach(t => {
      byType[ISSUE_LABELS[t.issueType] || t.issueType] = (byType[ISSUE_LABELS[t.issueType] || t.issueType] || 0) + 1;
      const tw = (t.towerName || '').trim() || NO_TOWER_LABEL;
      byTower[tw] = (byTower[tw] || 0) + 1;
    });
    lines.push(`حسب النوع: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join('، ')}`);
    lines.push(`حسب البرج: ${Object.entries(byTower).map(([k, v]) => `${k} ${v}`).join('، ')}`);
  }

  return lines.join('\n');
}
