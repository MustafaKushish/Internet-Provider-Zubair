import React, { useState, useMemo } from 'react';
import { Subscriber, PaymentRecord, SystemSettings, ReportPeriod, Expense } from '../../types/isp';
import { EXPENSE_CATEGORIES, sumAmounts } from '../../utils/expenses';
import { LOST_AFTER_DAYS, lastMonthKeys, movementByTower, subscriberMovement } from '../../utils/growth';
import { generatePeriodReport, formatCurrency, exportReportToExcel, getPaymentCost } from '../../utils/storage';
import { toLocalDateStr, todayStr } from '../../utils/dates';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  Server,
  TowerControl,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  Trash2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { StaffUser } from '../../types/isp';
import { appConfirm } from '../ui/Dialogs';

interface ReportsViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  settings: SystemSettings;
  currentUser?: StaffUser;
  onDeletePayment?: (paymentId: string) => void;
  expenses?: Expense[];
  /** كل المشتركين مع المؤرشفين (لحركة المشتركين) */
  allSubscribers?: Subscriber[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  subscribers,
  payments,
  settings,
  currentUser,
  onDeletePayment,
  expenses = [],
  allSubscribers,
}) => {
  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toLocalDateStr(d);
  });
  const [customEnd, setCustomEnd] = useState(() => todayStr());

  const report = useMemo(() => {
    return generatePeriodReport(subscribers, payments, period, customStart, customEnd);
  }, [subscribers, payments, period, customStart, customEnd]);

  // Calculate 6-month historical monthly revenue comparison
  const last6MonthsData = useMemo(() => {
    const result: { monthKey: string; monthName: string; fullLabel: string; revenue: number; netProfit: number; transactionsCount: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      const monthName = d.toLocaleDateString('ar-IQ', { month: 'short' });
      const fullLabel = `${monthName} ${year}`;

      const monthPayments = payments.filter(p => p.date.startsWith(monthKey));
      const revenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);

      // نفس طريقة الحساب في التقرير الرئيسي، بدون تقدير وهمي، والخسارة تظهر كقيمة سالبة
      const wholesaleCost = monthPayments.reduce((sum, p) => sum + getPaymentCost(p, subscribers), 0);
      const netProfit = revenue - wholesaleCost;

      result.push({
        monthKey,
        monthName: `${monthName} ${year.toString().slice(-2)}'`,
        fullLabel,
        revenue,
        netProfit,
        transactionsCount: monthPayments.length,
      });
    }

    return result;
  }, [payments, subscribers]);

  const sixMonthsTotalRevenue = useMemo(() => {
    return last6MonthsData.reduce((acc, m) => acc + m.revenue, 0);
  }, [last6MonthsData]);

  const bestMonth = useMemo(() => {
    if (last6MonthsData.length === 0) return null;
    return [...last6MonthsData].sort((a, b) => b.revenue - a.revenue)[0];
  }, [last6MonthsData]);

  const avgMonthlyRevenue = useMemo(() => {
    return Math.round(sixMonthsTotalRevenue / 6);
  }, [sixMonthsTotalRevenue]);

  const filteredTransactions = useMemo(() => {
    return payments
      .filter(p => p.date >= report.startDate && p.date <= report.endDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, report]);

  // المصاريف التشغيلية للفترة وصافي الربح الحقيقي بعدها
  const periodExpenses = useMemo(
    () => expenses.filter(e => e.date >= report.startDate && e.date <= report.endDate),
    [expenses, report],
  );
  const periodExpensesTotal = sumAmounts(periodExpenses);
  const realNet = report.totalNetProfit - periodExpensesTotal;

  // حركة المشتركين: جدد، مجددون، مسترجعون، مفقودون (آخر 6 أشهر)
  const movement = useMemo(() => subscriberMovement(allSubscribers || subscribers, payments, lastMonthKeys(6)), [allSubscribers, subscribers, payments]);
  const towerMovement = useMemo(() => movementByTower(allSubscribers || subscribers, lastMonthKeys(3)), [allSubscribers, subscribers]);
  const MONTHS_SHORT = ['ك2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'ت1', 'ت2', 'ك1'];
  const movementChart = movement.map(m => ({ ...m, label: MONTHS_SHORT[Number(m.month.slice(5, 7)) - 1] }));

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportReportToExcel(report, `تقرير_مالي_${report.periodLabel.replace(/\s+/g, '_')}.xlsx`);
  };

  // Custom Tooltip for Recharts
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rev = payload.find((p: any) => p.dataKey === 'revenue')?.value || 0;
      const prof = payload.find((p: any) => p.dataKey === 'netProfit')?.value || 0;
      const monthObj = last6MonthsData.find(m => m.monthName === label);

      return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-1 text-right" dir="rtl">
          <p className="font-bold text-white border-b border-slate-800 pb-1">
            {monthObj ? monthObj.fullLabel : label}
          </p>
          <p className="text-cyan-400 font-semibold flex justify-between gap-4">
            <span>إجمالي الإيرادات:</span>
            <span className="font-mono font-bold">{formatCurrency(rev, settings.currency)}</span>
          </p>
          <p className="text-emerald-400 font-semibold flex justify-between gap-4">
            <span>صافي الربح:</span>
            <span className="font-mono font-bold">+{formatCurrency(prof, settings.currency)}</span>
          </p>
          {monthObj && (
            <p className="text-[10px] text-slate-400 pt-0.5">
              عدد الوصولات: {monthObj.transactionsCount}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Period Selector (Hidden on print) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <span>التقارير المالية والجرد الدوري للمنظومة</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              كشف تفصيلي بالإيرادات، الأرباح، عدد المشتركين النشطين، والحسابات المتأخرة لفترات دورية
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReport}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير إكسل (XLSX)</span>
            </button>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-800 text-xs">
          <span className="text-slate-400 ms-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>الفترة الزمنية:</span>
          </span>

          <button
            onClick={() => setPeriod('this_month')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              period === 'this_month'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            هذا الشهر (شهري)
          </button>

          <button
            onClick={() => setPeriod('last_month')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              period === 'last_month'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            الشهر السابق
          </button>

          <button
            onClick={() => setPeriod('this_quarter')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              period === 'this_quarter'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            الربع الحالي (فصلي)
          </button>

          <button
            onClick={() => setPeriod('last_quarter')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              period === 'last_quarter'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            الربع السابق
          </button>

          <button
            onClick={() => setPeriod('this_year')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              period === 'this_year'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            جرد سنوي (العام الحالي)
          </button>

          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              period === 'custom'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            نطاق مخصص
          </button>

          {period === 'custom' && (
            <div className="flex items-center gap-2 ms-2 bg-slate-950 p-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400">من:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white"
              />
              <span className="text-slate-400">إلى:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Official Report Document Body (styled for both screen and print) */}
      <div className="bg-slate-900 print:bg-white print:text-slate-900 border border-slate-800 print:border-none rounded-2xl p-6 shadow-xl space-y-6">
        {/* Report Header for Print / Official Display */}
        <div className="border-b border-slate-800 print:border-slate-300 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white print:text-slate-900">{settings.ispName}</span>
              <span className="text-xs bg-cyan-950 print:bg-slate-100 text-cyan-300 print:text-slate-800 px-2 py-0.5 rounded font-bold border border-cyan-800 print:border-slate-300">
                تقرير مالي رسمي
              </span>
            </div>
            <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              المسؤول: {settings.agentName} • الهاتف: {settings.contactPhone}
            </p>
          </div>

          <div className="text-left" dir="ltr">
            <span className="font-bold text-sm text-cyan-400 print:text-slate-900 font-sans block text-right">
              {report.periodLabel}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({report.startDate} - {report.endDate})
            </span>
          </div>
        </div>

        {/* 4 Primary Highlight Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 print:text-slate-600 text-xs mb-1">
              <span>إجمالي الإيرادات المحصلة</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 print:text-emerald-700 font-mono">
              {formatCurrency(report.totalRevenue, settings.currency)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              من {report.totalTransactionsCount} وصل قبض مسجل
            </span>
          </div>

          {/* Net Profit */}
          <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 print:text-slate-600 text-xs mb-1">
              <span>صافي الأرباح المحققة</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-cyan-400 print:text-cyan-700 font-mono">
              {formatCurrency(report.totalNetProfit, settings.currency)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              بعد خصم كلفة الجملة ({formatCurrency(report.totalWholesaleCost, settings.currency)})
            </span>
          </div>

          {/* Active Users */}
          <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 print:text-slate-600 text-xs mb-1">
              <span>عدد المشتركين النشطين</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-black text-blue-400 print:text-blue-700 font-mono">
              {report.activeUsersCount} مشترك
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              خطوط مفعّلة وتعمل بكفاءة
            </span>
          </div>

          {/* Overdue Accounts */}
          <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 print:text-slate-600 text-xs mb-1">
              <span>الحسابات المتأخرة (Overdue)</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400 print:text-rose-700 font-mono">
              {report.overdueUsersCount} حساب
            </div>
            <span className="text-[10px] text-rose-400 font-semibold block mt-1">
              إجمالي المتأخرات: {formatCurrency(report.overdueTotalAmount, settings.currency)}
            </span>
          </div>
        </div>

        {/* المصاريف التشغيلية وصافي الربح الحقيقي */}
        <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div>
            <div className="text-slate-400 print:text-slate-600">المصاريف التشغيلية للفترة ({periodExpenses.length})</div>
            <div className="text-lg font-black text-rose-300 print:text-rose-700 font-mono">{formatCurrency(periodExpensesTotal, settings.currency)}</div>
            {periodExpenses.length > 0 && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                {EXPENSE_CATEGORIES.map(c => ({ c, t: sumAmounts(periodExpenses.filter(e => e.category === c.id)) })).filter(x => x.t > 0).map(x => `${x.c.label} ${formatCurrency(x.t, settings.currency)}`).join(' • ')}
              </div>
            )}
          </div>
          <div className="md:text-left">
            <div className="text-slate-400 print:text-slate-600">صافي الربح الحقيقي (بعد كلفة الجملة والمصاريف)</div>
            <div className={`text-2xl font-black font-mono ${realNet >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>{formatCurrency(realNet, settings.currency)}</div>
            {periodExpenses.length === 0 && <div className="text-[10px] text-amber-400 no-print">لم تُسجل مصاريف لهذه الفترة (قسم «الصندوق والمصاريف»).</div>}
          </div>
        </div>

        {/* NEW SECTION: Recharts 6-Month Revenue Comparison Bar Chart */}
        <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-300 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 print:border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400 print:text-cyan-600" />
                <span>مقارنة الإيرادات وصافي الأرباح لآخر 6 أشهر</span>
              </h3>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                رسم بياني تفاعلي يوضح اتجاهات التحصيل ونمو الدخل الشهري للمنظومة
              </p>
            </div>

            {/* Trend Summary Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="bg-slate-900 print:bg-slate-100 px-3 py-1 rounded-lg border border-slate-700 print:border-slate-300">
                <span className="text-slate-400 block text-[10px]">مجموع الـ 6 أشهر</span>
                <span className="font-bold text-cyan-400 print:text-cyan-800 font-mono">
                  {formatCurrency(sixMonthsTotalRevenue, settings.currency)}
                </span>
              </div>

              <div className="bg-slate-900 print:bg-slate-100 px-3 py-1 rounded-lg border border-slate-700 print:border-slate-300">
                <span className="text-slate-400 block text-[10px]">متوسط الإيراد الشهري</span>
                <span className="font-bold text-emerald-400 print:text-emerald-800 font-mono">
                  {formatCurrency(avgMonthlyRevenue, settings.currency)}
                </span>
              </div>

              {bestMonth && (
                <div className="bg-slate-900 print:bg-slate-100 px-3 py-1 rounded-lg border border-slate-700 print:border-slate-300 hidden md:block">
                  <span className="text-slate-400 block text-[10px]">أعلى شهر إيراداً</span>
                  <span className="font-bold text-amber-300 print:text-amber-800 font-mono">
                    {bestMonth.fullLabel} ({formatCurrency(bestMonth.revenue, settings.currency)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* The Recharts Bar Chart */}
          <div className="h-72 w-full pt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={last6MonthsData}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="monthName"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${Math.round(val / 1000)}k`;
                    return val;
                  }}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  formatter={(value) => {
                    if (value === 'revenue') return 'إجمالي الإيرادات المحصلة';
                    if (value === 'netProfit') return 'صافي الأرباح المحققة';
                    return value;
                  }}
                />
                <Bar
                  dataKey="revenue"
                  name="revenue"
                  fill="#06b6d4"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
                <Bar
                  dataKey="netProfit"
                  name="netProfit"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* حركة المشتركين */}
        <div className="bg-slate-950/70 print:bg-slate-50 border border-slate-800 print:border-slate-300 rounded-2xl p-5 shadow-lg space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" /> حركة المشتركين: الجدد والمفقودون (آخر 6 أشهر)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              «مفقود» = انتهى اشتراكه في ذلك الشهر ولم يجدد خلال {LOST_AFTER_DAYS} يوماً • «مسترجع» = جدد بعد انقطاع أطول من {LOST_AFTER_DAYS} يوماً • المستوردون من إكسل لا يُحسبون جدداً
            </p>
          </div>
          <div className="h-56 no-print" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="newCount" name="جدد" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="returnedCount" name="مسترجعون" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="lostCount" name="مفقودون" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-800/60 print:bg-slate-100 text-slate-400 print:text-slate-700">
                <tr>
                  <th className="p-2">الشهر</th><th className="p-2">جدد</th><th className="p-2">جددوا</th><th className="p-2">مسترجعون</th>
                  <th className="p-2">مفقودون</th><th className="p-2">بانتظار التجديد</th><th className="p-2">صافي النمو</th><th className="p-2">نسبة الاحتفاظ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-200 text-slate-200 print:text-slate-800">
                {[...movement].reverse().map(m => (
                  <tr key={m.month}>
                    <td className="p-2 font-mono" dir="ltr">{m.month}</td>
                    <td className="p-2 text-emerald-400 font-bold">{m.newCount}</td>
                    <td className="p-2">{m.renewedCount}</td>
                    <td className="p-2 text-cyan-300">{m.returnedCount}</td>
                    <td className="p-2 text-rose-400 font-bold">{m.lostCount}</td>
                    <td className="p-2 text-amber-300">{m.pendingCount || '—'}</td>
                    <td className={`p-2 font-bold ${m.net > 0 ? 'text-emerald-400' : m.net < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{m.net > 0 ? `+${m.net}` : m.net}</td>
                    <td className="p-2">{m.retention === null ? '—' : `${m.retention}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {towerMovement.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-1.5">حسب البرج (آخر 3 أشهر) — الأكثر خسارة أولاً</h4>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {towerMovement.map(t => (
                  <span key={t.tower} className={`px-2 py-1 rounded-lg border ${t.newCount - t.lostCount < 0 ? 'bg-rose-950/40 border-rose-900 text-rose-200' : 'bg-emerald-950/40 border-emerald-900 text-emerald-200'}`}>
                    {t.tower}: +{t.newCount} / −{t.lostCount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Breakdown Sections: Providers & Towers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Provider */}
          <div className="bg-slate-950/50 print:bg-white border border-slate-800 print:border-slate-300 rounded-xl p-4">
            <h3 className="text-xs font-bold text-indigo-400 print:text-indigo-900 mb-3 flex items-center gap-1.5">
              <Server className="w-4 h-4" />
              <span>الإيرادات والأرباح حسب المزود الرئيسي</span>
            </h3>
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-800/60 print:bg-slate-100 text-slate-400 print:text-slate-700">
                <tr>
                  <th className="p-2">المزود</th>
                  <th className="p-2">الخطوط</th>
                  <th className="p-2">الإيراد</th>
                  <th className="p-2">كلفة الجملة</th>
                  <th className="p-2">صافي الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                {report.providerBreakdown.map((pb, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-2 font-bold text-white print:text-slate-900">{pb.provider}</td>
                    <td className="p-2 font-mono">{pb.count}</td>
                    <td className="p-2 font-mono text-emerald-400 print:text-emerald-700">{formatCurrency(pb.revenue, settings.currency)}</td>
                    <td className="p-2 font-mono text-amber-400 print:text-amber-700">{formatCurrency(pb.cost, settings.currency)}</td>
                    <td className="p-2 font-mono font-bold text-cyan-400 print:text-cyan-700">+{formatCurrency(pb.profit, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Tower */}
          <div className="bg-slate-950/50 print:bg-white border border-slate-800 print:border-slate-300 rounded-xl p-4">
            <h3 className="text-xs font-bold text-cyan-400 print:text-cyan-900 mb-3 flex items-center gap-1.5">
              <TowerControl className="w-4 h-4" />
              <span>توزيع المشتركين والإيرادات حسب الأبراج والسكترات</span>
            </h3>
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-800/60 print:bg-slate-100 text-slate-400 print:text-slate-700">
                <tr>
                  <th className="p-2">البرج / النقطة</th>
                  <th className="p-2">عدد المشتركين</th>
                  <th className="p-2">الإيراد المحصل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                {report.towerBreakdown.map((tb, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-2 font-bold text-white print:text-slate-900">{tb.tower}</td>
                    <td className="p-2 font-mono">{tb.userCount} مشترك</td>
                    <td className="p-2 font-mono font-bold text-emerald-400 print:text-emerald-700">
                      {formatCurrency(tb.revenue, settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Transactions List During Period */}
        <div className="border border-slate-800 print:border-slate-300 rounded-xl overflow-hidden">
          <div className="p-3 bg-slate-800/70 print:bg-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white print:text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400 print:text-cyan-700" />
              <span>كشف حركات الدفع والوصولات خلال هذه الفترة ({filteredTransactions.length} حركة)</span>
            </h3>
            <span className="text-[11px] text-slate-400 print:text-slate-600 font-mono">
              المجموع: {formatCurrency(report.totalRevenue, settings.currency)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800 print:bg-slate-200 text-slate-400 print:text-slate-700 sticky top-0">
                <tr>
                  <th className="p-2.5">رقم الوصل</th>
                  <th className="p-2.5">المشترك</th>
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">المبلغ</th>
                  <th className="p-2.5">طريقة الدفع</th>
                  <th className="p-2.5">المحصل / الملاحظات</th>
                  {currentUser?.role === 'admin' && <th className="p-2.5 text-center no-print">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-200 text-slate-200 print:text-slate-900">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser?.role === 'admin' ? 7 : 6} className="p-6 text-center text-slate-500">
                      لا توجد وصولات مسجلة في هذه الفترة المحددة.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="p-2.5 font-mono text-cyan-400 print:text-cyan-800 font-bold" dir="ltr">
                        {tx.receiptNumber}
                      </td>
                      <td className="p-2.5 font-semibold">{tx.subscriberName}</td>
                      <td className="p-2.5 font-mono text-slate-400 print:text-slate-600" dir="ltr">
                        {tx.date}
                      </td>
                      <td className="p-2.5 font-bold text-emerald-400 print:text-emerald-700 font-mono">
                        {formatCurrency(tx.amount, settings.currency)}
                      </td>
                      <td className="p-2.5">
                        {tx.paymentMethod === 'cash' ? 'نقداً (كاش)' : tx.paymentMethod === 'zain_cash' ? 'زين كاش' : tx.paymentMethod === 'qi_card' ? 'كي كارد' : 'تحويل'}
                      </td>
                      <td className="p-2.5 text-slate-400 print:text-slate-600">{tx.notes || tx.collectedBy || '-'}</td>
                      {currentUser?.role === 'admin' && (
                        <td className="p-2.5 text-center no-print">
                          <button
                            onClick={async () => {
                              if (onDeletePayment && await appConfirm(`تأكيد للمدير العام: هل أنت متأكد من حذف الوصل (${tx.receiptNumber}) بمبلغ (${formatCurrency(tx.amount, settings.currency)})؟`)) {
                                onDeletePayment(tx.id);
                              }
                            }}
                            title="حذف هذا الوصل (صلاحية المدير العام فقط)"
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Report Sign-off for Print */}
        <div className="pt-4 border-t border-slate-800 print:border-slate-300 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span>تاريخ إصدار التقرير: {new Date().toLocaleDateString('ar-IQ')}</span>
          </div>
          <div>
            <span>توقيع وختم الإدارة: ..............................</span>
          </div>
        </div>
      </div>
    </div>
  );
};
