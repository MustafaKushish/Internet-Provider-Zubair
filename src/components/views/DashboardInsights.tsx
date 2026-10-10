import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Expense, PaymentRecord, StaffUser, Subscriber, SupportTicket, SystemSettings } from '../../types/isp';
import { formatCurrency, getDaysRemaining, getPaymentCost } from '../../utils/storage';
import { expensesInMonth, sumAmounts, PAYMENT_METHOD_LABELS } from '../../utils/expenses';
import { importedIds } from '../../utils/growth';
import { NO_TOWER_LABEL, normTower } from '../../utils/towers';
import { addMonthsToDateStr, todayStr } from '../../utils/dates';
import {
  ArrowUpRight, ArrowDownRight, Minus, Target, TrendingUp, CalendarRange, Users, Layers, Wallet, UserCheck, Wrench, Table2, BarChart3, Pencil, Check,
} from 'lucide-react';

/*
 * لوحة التحليلات (تُحمَّل عند الحاجة لأنها تستخدم مكتبة الرسوم).
 * الألوان: لوحة فئوية مُتحقق منها على الخلفية الداكنة (#0f172a) — أزرق، برتقالي، أخضر مائي، أصفر —
 * وألوان الحالة (أخضر/كهرماني/أحمر) محجوزة للحالة فقط وتظهر دائماً مع نص.
 */
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
const GRID = '#1e293b';
const AXIS = '#64748b';
const MONTHS_AR = ['ك2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'ت1', 'ت2', 'ك1'];

interface Props {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  expenses: Expense[];
  tickets: SupportTicket[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onSetTarget?: (target: number) => void;
}

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
};

const monthKey = (d: string) => (d || '').slice(0, 7);
const dayOf = (d: string) => Number((d || '').slice(8, 10)) || 0;

function Delta({ now, prev, money, fmt }: { now: number; prev: number; money?: boolean; fmt: (n: number) => string }) {
  const diff = now - prev;
  const pct = prev ? Math.round((diff / Math.abs(prev)) * 100) : null;
  const up = diff > 0;
  const Icon = diff === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${diff === 0 ? 'text-slate-400' : up ? 'text-emerald-400' : 'text-rose-400'}`}>
      <Icon className="w-3.5 h-3.5" />
      {diff === 0 ? 'بلا تغيير' : `${up ? '+' : ''}${money ? fmt(diff) : diff}${pct !== null ? ` (${up ? '+' : ''}${pct}%)` : ''}`}
    </span>
  );
}

const Card: React.FC<{ title: string; icon: React.ReactNode; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, sub, right, children, className = '' }) => (
  <section className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl min-w-0 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">{icon}{title}</h3>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const tooltipStyle = { background: '#020617', border: '1px solid #334155', borderRadius: 12, fontSize: 12, color: '#e2e8f0' };

export const DashboardInsights: React.FC<Props> = ({ subscribers, payments, expenses, tickets, settings, currentUser, onSetTarget }) => {
  const fmt = (n: number) => formatCurrency(Math.round(n), settings.currency);
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const lastMonth = addMonthsToDateStr(`${thisMonth}-01`, -1).slice(0, 7);
  const dayNow = dayOf(today);
  const daysInMonth = new Date(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)), 0).getDate();
  const [tables, setTables] = useState<Record<string, boolean>>({});
  const toggleTable = (k: string) => setTables(t => ({ ...t, [k]: !t[k] }));
  const [editTarget, setEditTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');

  // ---------- مؤشرات الشهر حتى اليوم مقارنة بنفس الفترة من الشهر الماضي ----------
  const kpi = useMemo(() => {
    const imported = importedIds(subscribers);
    const upTo = (month: string, day: number) => payments.filter(p => monthKey(p.date) === month && dayOf(p.date) <= day);
    const calc = (month: string, day: number) => {
      const list = upTo(month, day);
      const collected = sumAmounts(list);
      const cost = list.reduce((a, p) => a + getPaymentCost(p, subscribers), 0);
      const exp = sumAmounts(expensesInMonth(expenses, month).filter(e => dayOf(e.date) <= day));
      const payers = new Set(list.map(p => p.subscriberId)).size;
      return {
        collected,
        net: collected - cost - exp,
        renewals: list.filter(p => p.paymentType === 'renewal' || p.paymentType === 'initial').length,
        fresh: subscribers.filter(s => !imported.has(s.id) && monthKey(s.createdAt) === month && dayOf(s.createdAt) <= day).length,
        arpu: payers ? collected / payers : 0,
        receipts: list.length,
      };
    };
    return { now: calc(thisMonth, dayNow), prev: calc(lastMonth, dayNow) };
  }, [payments, subscribers, expenses, thisMonth, lastMonth, dayNow]);

  // ---------- هدف الشهر ----------
  const expectedMonthly = subscribers.filter(s => s.status !== 'suspended').reduce((a, s) => a + (s.pendingPrice?.salePrice ?? s.salePrice ?? 0), 0);
  const target = settings.monthlyTarget || expectedMonthly;
  const collectedMonth = sumAmounts(payments.filter(p => monthKey(p.date) === thisMonth));
  const projection = dayNow ? Math.round((collectedMonth / dayNow) * daysInMonth) : 0;
  const pct = target ? Math.min(100, Math.round((collectedMonth / target) * 100)) : 0;
  const pacePct = Math.round((dayNow / daysInMonth) * 100);

  // ---------- اتجاه 12 شهراً ----------
  const trend = useMemo(() => {
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const m = addMonthsToDateStr(`${thisMonth}-01`, -i).slice(0, 7);
      const list = payments.filter(p => monthKey(p.date) === m);
      const collected = sumAmounts(list);
      const cost = list.reduce((a, p) => a + getPaymentCost(p, subscribers), 0);
      const exp = sumAmounts(expensesInMonth(expenses, m));
      out.push({ m, label: `${MONTHS_AR[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`, collected, net: collected - cost - exp, receipts: list.length });
    }
    return out;
  }, [payments, subscribers, expenses, thisMonth]);
  const hasTrend = trend.some(t => t.collected > 0);

  // ---------- توقع التحصيل 30 يوماً ----------
  const forecast = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + i);
      return { i, date: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, amount: 0, count: 0 };
    });
    subscribers.forEach(s => {
      const left = getDaysRemaining(s.expiryDate);
      if (left < 0 || left >= 30 || s.status === 'suspended') return;
      days[left].amount += s.pendingPrice?.salePrice ?? s.salePrice ?? 0;
      days[left].count++;
    });
    return days;
  }, [subscribers, today]);
  const forecastTotal = forecast.reduce((a, d) => a + d.amount, 0);
  const forecastCount = forecast.reduce((a, d) => a + d.count, 0);
  const weeks = [0, 7, 14, 21].map(start => {
    const slice = forecast.slice(start, start === 21 ? 30 : start + 7);
    return { label: start === 0 ? 'هذا الأسبوع' : `بعد ${start / 7} أسبوع`, amount: slice.reduce((a, d) => a + d.amount, 0), count: slice.reduce((a, d) => a + d.count, 0) };
  });

  // ---------- الحالة ----------
  const statusRows = [
    { key: 'active', label: 'نشط', cls: 'bg-emerald-500', n: subscribers.filter(s => s.status === 'active').length },
    { key: 'soon', label: 'ينتهي قريباً', cls: 'bg-amber-500', n: subscribers.filter(s => s.status === 'expiring_soon').length },
    { key: 'expired', label: 'منتهٍ', cls: 'bg-rose-500', n: subscribers.filter(s => s.status === 'expired').length },
    { key: 'suspended', label: 'موقوف', cls: 'bg-slate-500', n: subscribers.filter(s => s.status === 'suspended').length },
  ].filter(r => r.n > 0);
  const statusTotal = statusRows.reduce((a, r) => a + r.n, 0) || 1;

  // ---------- الباقات ----------
  const planRows = useMemo(() => {
    const m = new Map<string, { plan: string; n: number; revenue: number; profit: number }>();
    subscribers.forEach(s => {
      const r = m.get(s.planName) || { plan: s.planName, n: 0, revenue: 0, profit: 0 };
      r.n++;
      r.revenue += s.salePrice || 0;
      r.profit += (s.salePrice || 0) - (s.costPrice || 0);
      m.set(s.planName, r);
    });
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }, [subscribers]);
  const maxPlanRevenue = Math.max(1, ...planRows.map(r => r.revenue));

  // ---------- طرق الدفع والموظفون هذا الشهر ----------
  const monthPayments = payments.filter(p => monthKey(p.date) === thisMonth);
  const methods = ['cash', 'zain_cash', 'qi_card', 'transfer'].map((k, i) => ({ k, label: PAYMENT_METHOD_LABELS[k], color: SERIES[i], v: sumAmounts(monthPayments.filter(p => p.paymentMethod === k)) })).filter(x => x.v > 0);
  const methodsTotal = methods.reduce((a, x) => a + x.v, 0) || 1;
  const staff = useMemo(() => {
    const m = new Map<string, { name: string; amount: number; receipts: number }>();
    monthPayments.forEach(p => {
      const name = p.collectedBy || 'غير محدد';
      const r = m.get(name) || { name, amount: 0, receipts: 0 };
      r.amount += p.amount || 0;
      r.receipts++;
      m.set(name, r);
    });
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }, [monthPayments]);
  const maxStaff = Math.max(1, ...staff.map(s => s.amount));

  // ---------- البلاغات ----------
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const recentTickets = tickets.filter(t => (t.createdAt || '') >= since30);
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const resolved = recentTickets.filter(t => t.resolvedAt && t.createdAt);
  const avgDays = resolved.length
    ? Math.round(resolved.reduce((a, t) => a + Math.max(0, (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 86_400_000), 0) / resolved.length * 10) / 10
    : null;
  const openByTower = Object.entries(openTickets.reduce<Record<string, number>>((acc, t) => {
    const k = normTower(t.towerName) || NO_TOWER_LABEL;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const tableBtn = (k: string) => (
    <button type="button" onClick={() => toggleTable(k)} aria-pressed={!!tables[k]}
      className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer">
      {tables[k] ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}{tables[k] ? 'رسم' : 'جدول'}
    </button>
  );

  const tiles = [
    { label: 'المقبوض هذا الشهر', now: kpi.now.collected, prev: kpi.prev.collected, money: true },
    { label: 'صافي الربح الحقيقي', now: kpi.now.net, prev: kpi.prev.net, money: true },
    { label: 'تجديدات واشتراكات', now: kpi.now.renewals, prev: kpi.prev.renewals },
    { label: 'مشتركون جدد', now: kpi.now.fresh, prev: kpi.prev.fresh },
    { label: 'متوسط دفع المشترك', now: kpi.now.arpu, prev: kpi.prev.arpu, money: true },
    { label: 'عدد الوصولات', now: kpi.now.receipts, prev: kpi.prev.receipts },
  ];

  return (
    <div className="space-y-4" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* مؤشرات مع المقارنة */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> هذا الشهر حتى اليوم</h2>
          <span className="text-[11px] text-slate-500">مقارنة بنفس الفترة (1–{dayNow}) من الشهر الماضي</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {tiles.map(t => (
            <div key={t.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">{t.label}</div>
              <div className="text-base font-bold text-white mt-0.5 truncate">{t.money ? fmt(t.now) : t.now}</div>
              <Delta now={t.now} prev={t.prev} money={t.money} fmt={fmt} />
            </div>
          ))}
        </div>
      </div>

      {/* هدف الشهر */}
      <Card
        title="هدف التحصيل الشهري"
        icon={<Target className="w-4 h-4 text-cyan-400" />}
        sub={settings.monthlyTarget ? 'هدف يحدده المدير' : 'الهدف الافتراضي = رسوم شهر لكل المشتركين غير الموقوفين'}
        right={onSetTarget && (editTarget ? (
          <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); onSetTarget(Math.max(0, Math.round(Number(targetDraft) || 0))); setEditTarget(false); }}>
            <input id="target-input" type="number" inputMode="numeric" min={0} step={50000} autoFocus value={targetDraft} onChange={e => setTargetDraft(e.target.value)}
              className="w-36 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white" placeholder="0 = تلقائي" />
            <button type="submit" aria-label="حفظ الهدف" className="p-1.5 rounded-lg bg-cyan-600 text-white cursor-pointer"><Check className="w-4 h-4" /></button>
          </form>
        ) : (
          <button type="button" onClick={() => { setTargetDraft(String(settings.monthlyTarget || '')); setEditTarget(true); }}
            className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer">
            <Pencil className="w-3.5 h-3.5" /> تحديد الهدف
          </button>
        ))}
      >
        <div className="flex flex-wrap items-end justify-between gap-2 text-xs mb-2">
          <span className="text-slate-300">مقبوض <b className="text-white text-base">{fmt(collectedMonth)}</b> من <b className="text-white">{fmt(target)}</b></span>
          <span className={`font-bold ${pct >= pacePct ? 'text-emerald-400' : 'text-amber-300'}`}>{pct}% {pct >= pacePct ? '— متقدم على الجدول' : '— متأخر عن الجدول'}</span>
        </div>
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#3987e5] rounded-full" style={{ width: `${pct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/70" style={{ right: `${pacePct}%` }} title="أين يجب أن تكون اليوم" />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400 mt-2">
          <span>الخط الأبيض: المطلوب حتى اليوم ({pacePct}% من الشهر)</span>
          <span>بهذا المعدل نهاية الشهر: <b className={projection >= target ? 'text-emerald-400' : 'text-amber-300'}>{fmt(projection)}</b></span>
          <span>المتبقي للهدف: <b className="text-white">{fmt(Math.max(0, target - collectedMonth))}</b> • يومياً {fmt(Math.max(0, target - collectedMonth) / Math.max(1, daysInMonth - dayNow + 1))}</span>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* اتجاه 12 شهراً */}
        <Card title="التحصيل وصافي الربح — 12 شهراً" icon={<BarChart3 className="w-4 h-4 text-cyan-400" />} sub="الصافي = المقبوض − كلفة الجملة − المصاريف" right={tableBtn('trend')}>
          {!hasTrend ? <p className="text-xs text-slate-500 py-10 text-center">لا توجد وصولات بعد.</p> : tables.trend ? (
            <table className="w-full text-xs text-right">
              <thead className="text-slate-400"><tr><th className="py-1">الشهر</th><th>المقبوض</th><th>الصافي</th><th>وصولات</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{[...trend].reverse().map(t => (
                <tr key={t.m}><td className="py-1 font-mono" dir="ltr">{t.m}</td><td>{fmt(t.collected)}</td><td className={t.net < 0 ? 'text-rose-400' : ''}>{fmt(t.net)}</td><td>{t.receipts}</td></tr>
              ))}</tbody>
            </table>
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" stroke={AXIS} fontSize={10} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke={AXIS} fontSize={10} tickFormatter={compact} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [fmt(Number(v)), name]} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="collected" name="المقبوض" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Line dataKey="net" name="صافي الربح" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: '#0f172a' }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* توقع 30 يوماً */}
        <Card title="التجديدات المتوقعة — 30 يوماً" icon={<CalendarRange className="w-4 h-4 text-cyan-400" />}
          sub={`${forecastCount} مشترك ينتهي اشتراكه = ${fmt(forecastTotal)} متوقع (بالأسعار الجديدة إن وجدت)`} right={tableBtn('forecast')}>
          {tables.forecast ? (
            <table className="w-full text-xs text-right">
              <thead className="text-slate-400"><tr><th className="py-1">الفترة</th><th>مشتركون</th><th>المبلغ المتوقع</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{weeks.map(w => (
                <tr key={w.label}><td className="py-1">{w.label}</td><td>{w.count}</td><td>{fmt(w.amount)}</td></tr>
              ))}</tbody>
            </table>
          ) : (
            <>
              <div className="h-48" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" stroke={AXIS} fontSize={10} tickLine={false} interval={4} />
                    <YAxis stroke={AXIS} fontSize={10} tickFormatter={compact} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                      formatter={(v: any, _n: any, item: any) => [`${fmt(Number(v))} • ${item?.payload?.count || 0} مشترك`, 'متوقع']} labelFormatter={(l: any) => `يوم ${l}`} />
                    <Bar dataKey="amount" name="متوقع" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px]">
                {weeks.map(w => (
                  <div key={w.label} className="rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1.5">
                    <div className="text-slate-400">{w.label}</div>
                    <div className="text-white font-bold">{fmt(w.amount)}</div>
                    <div className="text-slate-500">{w.count} مشترك</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* حالة المشتركين */}
        <Card title="حالة المشتركين" icon={<Users className="w-4 h-4 text-cyan-400" />} sub={`${statusTotal} مشترك (بدون المؤرشفين)`}>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5 bg-slate-800">
            {statusRows.map(r => <div key={r.key} className={`${r.cls} h-full`} style={{ width: `${(r.n / statusTotal) * 100}%` }} title={`${r.label}: ${r.n}`} />)}
          </div>
          <ul className="grid grid-cols-2 gap-2 mt-3 text-xs">
            {statusRows.map(r => (
              <li key={r.key} className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-slate-300"><span className={`w-2.5 h-2.5 rounded-sm ${r.cls}`} />{r.label}</span>
                <span className="text-white font-bold">{r.n} <span className="text-slate-500 font-normal">({Math.round((r.n / statusTotal) * 100)}%)</span></span>
              </li>
            ))}
          </ul>
        </Card>

        {/* الباقات */}
        <Card title="الباقات: المشتركون والإيراد الشهري" icon={<Layers className="w-4 h-4 text-cyan-400" />} sub="الإيراد المتوقع شهرياً لكل باقة وربحه">
          <ul className="space-y-2.5 text-xs">
            {planRows.slice(0, 8).map(r => (
              <li key={r.plan}>
                <div className="flex justify-between gap-2 text-slate-300 mb-1">
                  <span className="truncate">{r.plan} <span className="text-slate-500">• {r.n} مشترك</span></span>
                  <span className="text-white font-bold whitespace-nowrap">{fmt(r.revenue)} <span className="text-slate-500 font-normal">ربح {fmt(r.profit)}</span></span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${(r.revenue / maxPlanRevenue) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>

        {/* طرق الدفع */}
        <Card title="طرق الدفع هذا الشهر" icon={<Wallet className="w-4 h-4 text-cyan-400" />} sub={`${monthPayments.length} وصل`}>
          {methods.length === 0 ? <p className="text-xs text-slate-500">لا وصولات هذا الشهر بعد.</p> : (
            <>
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5 bg-slate-800">
                {methods.map(m => <div key={m.k} className="h-full" style={{ width: `${(m.v / methodsTotal) * 100}%`, background: m.color }} title={`${m.label}: ${fmt(m.v)}`} />)}
              </div>
              <ul className="grid grid-cols-2 gap-2 mt-3 text-xs">
                {methods.map(m => (
                  <li key={m.k} className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-2.5 py-1.5">
                    <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.color }} />{m.label}</span>
                    <span className="text-white font-bold">{fmt(m.v)} <span className="text-slate-500 font-normal">({Math.round((m.v / methodsTotal) * 100)}%)</span></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* الموظفون */}
        <Card title="تحصيل الموظفين هذا الشهر" icon={<UserCheck className="w-4 h-4 text-cyan-400" />} sub="من قبض كم (حسب الوصولات)">
          {staff.length === 0 ? <p className="text-xs text-slate-500">لا وصولات هذا الشهر بعد.</p> : (
            <ul className="space-y-2.5 text-xs">
              {staff.map(s => (
                <li key={s.name}>
                  <div className="flex justify-between gap-2 text-slate-300 mb-1">
                    <span className="truncate">{s.name} <span className="text-slate-500">• {s.receipts} وصل</span></span>
                    <span className="text-white font-bold whitespace-nowrap">{fmt(s.amount)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#199e70]" style={{ width: `${(s.amount / maxStaff) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* البلاغات */}
        <Card title="الدعم الفني" icon={<Wrench className="w-4 h-4 text-cyan-400" />} sub="آخر 30 يوماً" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3"><div className="text-slate-400">مفتوحة الآن</div><div className={`text-lg font-bold ${openTickets.length ? 'text-amber-300' : 'text-white'}`}>{openTickets.length}</div></div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3"><div className="text-slate-400">بلاغات جديدة</div><div className="text-lg font-bold text-white">{recentTickets.length}</div></div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3"><div className="text-slate-400">متوسط وقت الحل</div><div className="text-lg font-bold text-white">{avgDays === null ? '—' : `${avgDays} يوم`}</div></div>
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3"><div className="text-slate-400">لكل 100 مشترك</div><div className="text-lg font-bold text-white">{subscribers.length ? Math.round((recentTickets.length / subscribers.length) * 1000) / 10 : 0}</div></div>
          </div>
          {openByTower.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 text-[11px]">
              <span className="text-slate-400">المفتوحة حسب البرج:</span>
              {openByTower.map(([t, n]) => <span key={t} className="px-2 py-0.5 rounded-lg bg-amber-950/40 border border-amber-900 text-amber-200">{t}: {n}</span>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardInsights;
