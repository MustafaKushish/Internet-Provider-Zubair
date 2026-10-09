import React from 'react';
import { Expense, PaymentRecord, Subscriber, SystemSettings, TowerPoint } from '../../types/isp';
import { netProfitInMonth } from '../../utils/expenses';
import { planProgress } from '../../utils/installments';
import { computeTowerStats, sortTowerStats, NO_TOWER_LABEL } from '../../utils/towers';
import { debtInMonths, formatMonthsAr, monthsLate } from '../../utils/debt';
import { formatCurrency, getDaysRemaining, getAmountDue, getRemainingDebt, getPaymentCost } from '../../utils/storage';
import { todayStr } from '../../utils/dates';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  Server,
  TowerControl,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  RefreshCw,
  PieChart,
  ShieldAlert
} from 'lucide-react';

interface DashboardViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  towerPoints: TowerPoint[];
  settings: SystemSettings;
  onOpenTowers?: () => void;
  onOpenDebt?: (sub: Subscriber) => void;
  onRenew: (sub: Subscriber) => void;
  onSendWhatsApp: (sub: Subscriber, defaultTab?: any) => void;
  expenses?: Expense[];
  onOpenCash?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  subscribers,
  payments,
  towerPoints,
  settings,
  onOpenTowers,
  onOpenDebt,
  onRenew,
  onSendWhatsApp,
  expenses = [],
  onOpenCash,
}) => {
  // Financial metrics
  // المبيعات المتوقعة = المستحق الفعلي لكل مشترك في دورته الحالية
  const totalSales = subscribers.reduce((acc, s) => acc + getAmountDue(s), 0);
  const totalWholesaleCost = subscribers.reduce((acc, s) => acc + s.costPrice * (s.cycleMonths || 1), 0);
  const totalNetProfit = totalSales - totalWholesaleCost;
  const profitMargin = totalSales > 0 ? Math.round((totalNetProfit / totalSales) * 100) : 0;

  const totalCollected = subscribers.reduce((acc, s) => acc + s.paidAmount, 0);
  const totalDebts = subscribers.reduce((acc, s) => acc + getRemainingDebt(s), 0);
  const collectionRate = totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 0;

  // Status metrics
  const activeCount = subscribers.filter(s => s.status === 'active').length;
  const expiringSoonCount = subscribers.filter(s => s.status === 'expiring_soon').length;
  const expiredCount = subscribers.filter(s => s.status === 'expired').length;

  // Urgent subscribers needing attention (expiring within 2 days or expired)
  const urgentSubscribers = subscribers
    .filter(s => {
      const days = getDaysRemaining(s.expiryDate);
      return days <= 2;
    })
    .sort((a, b) => getDaysRemaining(a.expiryDate) - getDaysRemaining(b.expiryDate));

  // Top Debtors
  const topDebtors = subscribers
    .filter(s => getRemainingDebt(s) > 0)
    .sort((a, b) => getRemainingDebt(b) - getRemainingDebt(a))
    .slice(0, 5);

  // Group by Provider
  const providerStats = subscribers.reduce((acc, s) => {
    acc[s.upstreamProvider] = (acc[s.upstreamProvider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // إحصائيات الأبراج: الأعلى ربحاً شهرياً أولاً
  const towerRanking = sortTowerStats(
    computeTowerStats(subscribers, payments, towerPoints).filter(t => t.subscribers > 0),
    'monthlyProfit',
  );
  const maxTowerProfit = Math.max(1, ...towerRanking.map(t => t.monthlyProfit));

  // ---------- ملخص اليوم ----------
  const today = todayStr();
  const todaysPayments = payments.filter(p => (p.date || '').slice(0, 10) === today);
  const collectedToday = todaysPayments.reduce((a, p) => a + (p.amount || 0), 0);
  const profitToday = todaysPayments.reduce((a, p) => a + (p.amount || 0) - getPaymentCost(p, subscribers), 0);
  const renewalsToday = todaysPayments.filter(p => p.paymentType === 'renewal' || p.paymentType === 'initial').length;
  const debtPaymentsToday = todaysPayments.filter(p => p.paymentType === 'debt_installment').length;
  const expiresToday = subscribers.filter(s => getDaysRemaining(s.expiryDate) === 0).length;
  const expiresTomorrow = subscribers.filter(s => getDaysRemaining(s.expiryDate) === 1).length;
  const byMethod = todaysPayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + (p.amount || 0);
    return acc;
  }, {});
  const plans = subscribers.map(s => ({ sub: s, pr: planProgress(s, payments) })).filter(x => x.pr && x.pr.status !== 'done');
  const latePlans = plans.filter(x => x.pr!.status === 'late');
  const arrearsTotal = latePlans.reduce((a, x) => a + x.pr!.arrears, 0);
  const monthNet = netProfitInMonth(payments, subscribers, expenses, today.slice(0, 7));
  const METHOD: Record<string, string> = { cash: 'نقداً', zain_cash: 'زين كاش', qi_card: 'كي كارد', transfer: 'تحويل' };

  return (
    <div className="space-y-6">
      {/* ملخص اليوم: أول ما يحتاجه صاحب الشبكة كل يوم */}
      {subscribers.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> ملخص اليوم
              <span className="text-[11px] font-normal text-slate-500 font-mono" dir="ltr">{today}</span>
            </h2>
            {Object.keys(byMethod).length > 0 && (
              <span className="text-[11px] text-slate-400">
                {Object.entries(byMethod).map(([k, v]) => `${METHOD[k] || k}: ${formatCurrency(v, settings.currency)}`).join(' • ')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenCash}
            className="w-full mb-2.5 text-right rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800/60 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs cursor-pointer"
          >
            <span className="text-slate-300">
              هذا الشهر: ربح الوصولات <b className="text-emerald-400">{formatCurrency(monthNet.profit, settings.currency)}</b>
              {' − '}المصاريف <b className="text-rose-300">{formatCurrency(monthNet.expenses, settings.currency)}</b>
            </span>
            <span className="font-bold">
              الصافي الحقيقي: <span className={monthNet.net >= 0 ? 'text-white' : 'text-rose-400'}>{formatCurrency(monthNet.net, settings.currency)}</span>
              {monthNet.expenses === 0 && <span className="block text-[10px] font-normal text-amber-400">سجّل مصاريفك في «الصندوق والمصاريف» لترى الصافي الحقيقي</span>}
            </span>
          </button>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3">
              <div className="text-emerald-300">المقبوض اليوم</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{formatCurrency(collectedToday, settings.currency)}</div>
              <div className="text-[11px] text-slate-400">{todaysPayments.length} وصل • ربح {formatCurrency(profitToday, settings.currency)}</div>
            </div>
            <div className="bg-cyan-950/40 border border-cyan-800/50 rounded-xl p-3">
              <div className="text-cyan-300">تجديدات اليوم</div>
              <div className="text-lg font-bold text-cyan-300 mt-0.5">{renewalsToday}</div>
              <div className="text-[11px] text-slate-400">تسديد ديون: {debtPaymentsToday}</div>
            </div>
            <div className={`rounded-xl p-3 border ${expiresToday ? 'bg-amber-950/40 border-amber-700/60' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="text-amber-300">ينتهي اليوم</div>
              <div className="text-lg font-bold text-amber-300 mt-0.5">{expiresToday}</div>
              <div className="text-[11px] text-slate-400">وغداً: {expiresTomorrow}</div>
            </div>
            <div className={`rounded-xl p-3 border ${expiredCount ? 'bg-rose-950/40 border-rose-800/60' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="text-rose-300">منتهي ولم يجدد</div>
              <div className="text-lg font-bold text-rose-400 mt-0.5">{expiredCount}</div>
              <div className="text-[11px] text-slate-400">ديون: {formatCurrency(totalDebts, settings.currency)}</div>
            </div>
          </div>
          {plans.length > 0 && (
            <div className="mt-2.5 rounded-xl border border-indigo-900/70 bg-indigo-950/30 px-3 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="text-indigo-200">
                خطط التقسيط النشطة: <b>{plans.length}</b>
                {latePlans.length > 0 && <> • متأخرة: <b className="text-rose-300">{latePlans.length}</b> بمبلغ <b className="text-rose-300">{formatCurrency(arrearsTotal, settings.currency)}</b></>}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {latePlans.slice(0, 4).map(x => (
                  <button key={x.sub.id} type="button" onClick={() => onOpenDebt?.(x.sub)}
                    className="px-2 py-1 rounded-lg bg-rose-900/60 border border-rose-800 text-rose-100 cursor-pointer">
                    {x.sub.name.split(' ').slice(0, 2).join(' ')} ({formatCurrency(x.pr!.arrears, settings.currency)})
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Clean Slate Alert when no subscribers yet */}
      {subscribers.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">منظومة شبكة أولاد كشيش جاهزة للعمل الفعلي</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            تم مسح وتفريغ كافة البيانات التجريبية بنجاح. يمكنك الآن البدء بإضافة المشتركين الحقيقيين عبر زر (إضافة مشترك) أو (استيراد من إكسل) لعرض الإحصائيات والأرباح في هذه اللوحة.
          </p>
        </div>
      )}

      {/* 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit Card */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">صافي أرباح المنظومة شهرياً</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-300">
            {formatCurrency(totalNetProfit, settings.currency)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-emerald-900/40 pt-2">
            <span>هامش الربح: <strong className="text-emerald-400">{profitMargin}%</strong></span>
            <span>من إجمالي {subscribers.length} خط</span>
          </div>
        </div>

        {/* Total Wholesale Cost */}
        <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">كلفة المزودين (سعر الجملة)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-300">
            {formatCurrency(totalWholesaleCost, settings.currency)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-amber-900/40 pt-2">
            <span>المبلغ الذي تدفعه للشركات</span>
            <span>شهرياً</span>
          </div>
        </div>

        {/* Total Debts in Market */}
        <div className="bg-gradient-to-br from-rose-950/40 to-slate-900 border border-rose-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">إجمالي الديون في السوق</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-300">
            {formatCurrency(totalDebts, settings.currency)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-rose-900/40 pt-2">
            <span>نسبة التحصيل: <strong className="text-slate-200">{collectionRate}%</strong></span>
            <span>{subscribers.filter(s => getRemainingDebt(s) > 0).length} مشتركين مدينين</span>
          </div>
        </div>

        {/* Total Expected Gross Revenue */}
        <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">إجمالي مبيعات المشتركين</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-cyan-300">
            {formatCurrency(totalSales, settings.currency)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-cyan-900/40 pt-2">
            <span>المحصل فعلياً:</span>
            <span className="font-bold text-slate-200">{formatCurrency(totalCollected, settings.currency)}</span>
          </div>
        </div>
      </div>

      {/* Grid: Urgent Subscriptions & Top Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Subscriptions Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-sm">مشتركون يحتاجون للمتابعة الفورية (منتهي أو ينتهي قريباً)</h3>
            </div>
            <span className="text-xs bg-amber-950 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-800 font-bold">
              {urgentSubscribers.length} مشترك
            </span>
          </div>

          <div className="space-y-2.5">
            {urgentSubscribers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-xs">رائع! لا يوجد مشتركين منتهين أو قريبين من الانتهاء في اليومين القادمين.</p>
              </div>
            ) : (
              urgentSubscribers.slice(0, 6).map((sub) => {
                const days = getDaysRemaining(sub.expiryDate);
                return (
                  <div key={sub.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{sub.name}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {sub.planName} • {sub.towerName}
                      </div>
                      <div className="mt-1">
                        {days <= 0 ? (
                          <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900">
                            متأخر {formatMonthsAr(monthsLate(sub.expiryDate))} ({sub.expiryDate})
                          </span>
                        ) : (
                          <span className="text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900">
                            ينتهي خلال {days} يوم ({sub.expiryDate})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onRenew(sub)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>تجديد</span>
                      </button>
                      <button
                        onClick={() => onSendWhatsApp(sub, days <= 0 ? 'expired' : 'expiry')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Debtors Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h3 className="font-bold text-white text-sm">أعلى المشتركين المدينين (ديون متأخرة)</h3>
            </div>
            <span className="text-xs bg-rose-950 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-800 font-bold">
              {topDebtors.length} مدينين
            </span>
          </div>

          <div className="space-y-2.5">
            {topDebtors.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-xs">ممتاز! كافة المشتركين مسددين بالكامل ولا توجد أي ديون متأخرة.</p>
              </div>
            ) : (
              topDebtors.map((sub) => {
                const debt = getRemainingDebt(sub);
                return (
                  <div key={sub.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{sub.name}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        هاتف: <span className="font-mono text-slate-300" dir="ltr">{sub.phone}</span> • {sub.towerName}
                      </div>
                      <div className="text-rose-400 font-bold mt-1">
                        المبلغ المطلوب: {formatCurrency(debt, settings.currency)}
                        {sub.salePrice > 0 && <span className="font-normal text-rose-300/80"> (×{debtInMonths(sub)} {sub.planName})</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {onOpenDebt && (
                        <button
                          onClick={() => onOpenDebt(sub)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-bold transition cursor-pointer text-xs"
                        >
                          إدارة الدين
                        </button>
                      )}
                      <button
                        onClick={() => onSendWhatsApp(sub, 'debt')}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>مطالبة بالدين</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Distribution Cards: Providers & Towers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Provider */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">توزيع الخطوط حسب المزود الرئيسي</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(providerStats).map(([prov, count]) => {
              const pct = subscribers.length > 0 ? Math.round((count / subscribers.length) * 100) : 0;
              return (
                <div key={prov} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-200">{prov}</span>
                    <span className="text-indigo-400">{count} خط ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Tower: count, monthly profit and debts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <TowerControl className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">الأبراج حسب الربح الشهري</h3>
            </div>
            {onOpenTowers && (
              <button type="button" onClick={onOpenTowers} className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer">
                كل الأبراج ←
              </button>
            )}
          </div>
          {towerRanking.length === 0 ? (
            <p className="text-xs text-slate-500">لا يوجد مشتركون مربوطون بأبراج بعد.</p>
          ) : (
            <div className="space-y-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {towerRanking.slice(0, 8).map((t, idx) => (
                <div key={t.name} className="space-y-1">
                  <div className="flex justify-between gap-2 text-xs font-semibold">
                    <span className={`truncate ${t.name === NO_TOWER_LABEL ? 'text-amber-300' : 'text-slate-200'}`}>
                      <span className="text-slate-500 ml-1">{idx + 1}.</span>{t.name}
                      <span className="text-slate-500 font-normal"> • {t.subscribers} مشترك</span>
                    </span>
                    <span className="text-emerald-400 whitespace-nowrap">{formatCurrency(t.monthlyProfit, settings.currency)}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.max(2, Math.round((t.monthlyProfit / maxTowerProfit) * 100))}%` }} />
                  </div>
                  {t.debts > 0 && (
                    <div className="text-[10px] text-rose-400">ديون: {formatCurrency(t.debts, settings.currency)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
