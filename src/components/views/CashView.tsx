import React, { useMemo, useState } from 'react';
import { Expense, ExpenseCategory, PaymentRecord, StaffUser, Subscriber, SystemSettings, TowerPoint } from '../../types/isp';
import { formatCurrency } from '../../utils/storage';
import { addMonthsToDateStr, todayStr, uid } from '../../utils/dates';
import { computeTowerStats, normTower } from '../../utils/towers';
import {
  EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS, categoryLabel, expensesByTower, expensesInMonth,
  netProfitInMonth, pendingRecurring, sameDayInMonth, sumAmounts,
} from '../../utils/expenses';
import { appConfirm, copyText, notify } from '../ui/Dialogs';
import { useEscapeKey } from '../ui/useEscapeKey';
import {
  Wallet, Receipt, ChevronRight, ChevronLeft, Plus, Trash2, Edit, Copy, MessageSquare, Repeat, TrendingUp, TrendingDown, X, Check,
} from 'lucide-react';

interface CashViewProps {
  payments: PaymentRecord[];
  expenses: Expense[];
  subscribers: Subscriber[];
  towers: TowerPoint[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onSaveExpense: (expense: Expense) => void;
  onSaveExpenses: (expenses: Expense[]) => void;
  onDeleteExpense: (id: string) => void;
}

const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const monthLabel = (m: string) => `${MONTHS_AR[Number(m.slice(5, 7)) - 1] || ''} ${m.slice(0, 4)}`;
const METHODS = ['cash', 'zain_cash', 'qi_card', 'transfer'] as const;

/**
 * الصندوق والمصاريف:
 * - تسليم الصندوق اليومي: ما قبضه كل موظف حسب طريقة الدفع، ناقص ما دفعه نقداً من مصاريف
 * - المصاريف الشهرية: تسجيلها وربطها بالأبراج، وصافي الربح الحقيقي بعد المصاريف
 */
export const CashView: React.FC<CashViewProps> = (props) => {
  const [tab, setTab] = useState<'closing' | 'expenses'>('closing');
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" /> الصندوق والمصاريف
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">تسليم الصندوق اليومي لكل موظف، والمصاريف التشغيلية وصافي الربح الحقيقي</p>
        </div>
        <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-bold">
          <button type="button" onClick={() => setTab('closing')} aria-pressed={tab === 'closing'}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${tab === 'closing' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            تسليم الصندوق
          </button>
          <button type="button" onClick={() => setTab('expenses')} aria-pressed={tab === 'expenses'}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${tab === 'expenses' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            المصاريف وصافي الربح
          </button>
        </div>
      </div>
      {tab === 'closing' ? <DailyClosing {...props} /> : <MonthlyExpenses {...props} />}
    </div>
  );
};

// ---------------------------------------------------------------- تسليم الصندوق اليومي
const DailyClosing: React.FC<CashViewProps> = ({ payments, expenses, settings }) => {
  const [date, setDate] = useState(todayStr());
  const [openStaff, setOpenStaff] = useState<string | null>(null);
  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const rows = useMemo(() => {
    const day = payments.filter(p => (p.date || '').slice(0, 10) === date);
    const dayExpenses = expenses.filter(e => (e.date || '').slice(0, 10) === date);
    const names = new Set<string>([...day.map(p => p.collectedBy || 'غير محدد'), ...dayExpenses.filter(e => e.paidBy).map(e => e.paidBy!)]);
    return [...names].map(name => {
      const list = day.filter(p => (p.collectedBy || 'غير محدد') === name);
      const byMethod = Object.fromEntries(METHODS.map(m => [m, sumAmounts(list.filter(p => p.paymentMethod === m))])) as Record<string, number>;
      const paidOut = sumAmounts(dayExpenses.filter(e => e.paidBy === name));
      return { name, list, byMethod, total: sumAmounts(list), paidOut, handOver: byMethod.cash - paidOut };
    }).sort((a, b) => b.total - a.total);
  }, [payments, expenses, date]);

  const totals = {
    count: rows.reduce((a, r) => a + r.list.length, 0),
    total: rows.reduce((a, r) => a + r.total, 0),
    paidOut: rows.reduce((a, r) => a + r.paidOut, 0),
    handOver: rows.reduce((a, r) => a + r.handOver, 0),
    byMethod: Object.fromEntries(METHODS.map(m => [m, rows.reduce((a, r) => a + r.byMethod[m], 0)])) as Record<string, number>,
  };

  const summaryText = () => {
    const lines = [`📋 تسليم الصندوق - ${settings.ispName}`, `📅 ${date}`, ''];
    rows.forEach(r => {
      lines.push(`👤 ${r.name}: ${r.list.length} وصل = ${fmt(r.total)}`);
      METHODS.filter(m => r.byMethod[m]).forEach(m => lines.push(`   • ${PAYMENT_METHOD_LABELS[m]}: ${fmt(r.byMethod[m])}`));
      if (r.paidOut) lines.push(`   • مصاريف دفعها: ${fmt(r.paidOut)}`);
      lines.push(`   ✅ المطلوب تسليمه نقداً: ${fmt(r.handOver)}`);
    });
    lines.push('', `💰 المجموع: ${fmt(totals.total)} (${totals.count} وصل)`, `💵 النقد المطلوب تسليمه: ${fmt(totals.handOver)}`);
    return lines.join('\n');
  };

  const shiftDay = (n: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shiftDay(-1)} aria-label="اليوم السابق" className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        <input id="closing-date" type="date" value={date} max={todayStr()} onChange={e => e.target.value && setDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono" />
        <button type="button" onClick={() => shiftDay(1)} disabled={date >= todayStr()} aria-label="اليوم التالي" className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        {date !== todayStr() && <button type="button" onClick={() => setDate(todayStr())} className="text-xs text-cyan-400 cursor-pointer">اليوم</button>}
        <div className="flex gap-2 ms-auto">
          <button type="button" disabled={!rows.length} onClick={async () => { await copyText(summaryText()); notify('تم نسخ ملخص الصندوق.', 'success'); }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer">
            <Copy className="w-3.5 h-3.5" /> نسخ
          </button>
          <button type="button" disabled={!rows.length} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(summaryText())}`, '_blank')}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer">
            <MessageSquare className="w-3.5 h-3.5" /> إرسال واتساب
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <Stat label="مجموع المقبوض" value={fmt(totals.total)} sub={`${totals.count} وصل`} tone="emerald" />
        <Stat label="نقداً" value={fmt(totals.byMethod.cash)} sub={`زين كاش ${fmt(totals.byMethod.zain_cash)}`} tone="cyan" />
        <Stat label="كي كارد وتحويل" value={fmt(totals.byMethod.qi_card + totals.byMethod.transfer)} sub="لا يُسلَّم نقداً" tone="indigo" />
        <Stat label="النقد المطلوب تسليمه" value={fmt(totals.handOver)} sub={totals.paidOut ? `بعد مصاريف ${fmt(totals.paidOut)}` : 'لا مصاريف مدفوعة'} tone="amber" />
      </div>

      {rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-400">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          لا توجد وصولات أو مصاريف مسجلة في {date}.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.name} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button type="button" onClick={() => setOpenStaff(openStaff === r.name ? null : r.name)} aria-expanded={openStaff === r.name}
                className="w-full p-4 flex flex-wrap items-center justify-between gap-3 text-right cursor-pointer hover:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-300 flex items-center justify-center font-bold">{r.name.charAt(0)}</div>
                  <div>
                    <div className="font-bold text-white text-sm">{r.name}</div>
                    <div className="text-[11px] text-slate-400">{r.list.length} وصل • {METHODS.filter(m => r.byMethod[m]).map(m => `${PAYMENT_METHOD_LABELS[m]} ${fmt(r.byMethod[m])}`).join(' • ') || 'بدون قبض'}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-amber-300">يسلّم نقداً</div>
                  <div className={`text-lg font-bold ${r.handOver < 0 ? 'text-rose-400' : 'text-amber-300'}`}>{fmt(r.handOver)}</div>
                  {r.paidOut > 0 && <div className="text-[10px] text-slate-500">دفع مصاريف {fmt(r.paidOut)}</div>}
                </div>
              </button>
              {openStaff === r.name && r.list.length > 0 && (
                <div className="border-t border-slate-800 overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-800/60 text-slate-400">
                      <tr><th className="p-2">رقم الوصل</th><th className="p-2">المشترك</th><th className="p-2">النوع</th><th className="p-2">الطريقة</th><th className="p-2">المبلغ</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {r.list.map(p => (
                        <tr key={p.id}>
                          <td className="p-2 font-mono text-slate-400" dir="ltr">{p.receiptNumber}</td>
                          <td className="p-2">{p.subscriberName}</td>
                          <td className="p-2 text-slate-400">{p.paymentType === 'debt_installment' ? 'تسديد دين' : p.paymentType === 'renewal' ? 'تجديد' : p.paymentType === 'initial' ? 'اشتراك جديد' : 'إضافة'}</td>
                          <td className="p-2">{PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
                          <td className="p-2 font-bold text-emerald-400">{fmt(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TONES: Record<string, string> = {
  emerald: 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300',
  cyan: 'bg-cyan-950/40 border-cyan-800/50 text-cyan-300',
  indigo: 'bg-indigo-950/40 border-indigo-800/50 text-indigo-300',
  amber: 'bg-amber-950/40 border-amber-800/50 text-amber-300',
  rose: 'bg-rose-950/40 border-rose-800/50 text-rose-300',
  slate: 'bg-slate-800/50 border-slate-700 text-slate-300',
};

const Stat: React.FC<{ label: string; value: string; sub?: string; tone: keyof typeof TONES }> = ({ label, value, sub, tone }) => (
  <div className={`rounded-xl p-3 border ${TONES[tone]}`}>
    <div>{label}</div>
    <div className="text-base sm:text-lg font-bold text-white mt-0.5">{value}</div>
    {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
  </div>
);

// ---------------------------------------------------------------- المصاريف الشهرية
const emptyDraft = (month: string, user: StaffUser): Expense => ({
  id: '',
  date: todayStr().slice(0, 7) === month ? todayStr() : `${month}-01`,
  amount: 0,
  category: 'generator',
  towerName: '',
  note: '',
  paidBy: user.name,
  recurring: false,
  createdAt: '',
});

const MonthlyExpenses: React.FC<CashViewProps> = ({
  payments, expenses, subscribers, towers, settings, currentUser, onSaveExpense, onSaveExpenses, onDeleteExpense,
}) => {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [draft, setDraft] = useState<Expense | null>(null);
  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const isAdmin = currentUser.role === 'admin';

  const list = useMemo(() => expensesInMonth(expenses, month).sort((a, b) => b.date.localeCompare(a.date)), [expenses, month]);
  const net = useMemo(() => netProfitInMonth(payments, subscribers, expenses, month), [payments, subscribers, expenses, month]);
  const prevNet = useMemo(() => netProfitInMonth(payments, subscribers, expenses, addMonthsToDateStr(`${month}-01`, -1).slice(0, 7)), [payments, subscribers, expenses, month]);
  const recurring = useMemo(() => pendingRecurring(expenses, month), [expenses, month]);
  const byCategory = EXPENSE_CATEGORIES.map(c => ({ ...c, total: sumAmounts(list.filter(e => e.category === c.id)) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const towerRows = useMemo(() => {
    const exp = expensesByTower(expenses, month);
    const stats = computeTowerStats(subscribers, payments, towers, month);
    const rows = stats.filter(t => t.subscribers > 0 || exp.get(t.name)).map(t => {
      const e = exp.get(t.name) || 0;
      return { name: t.name, profit: t.profitThisMonth, expenses: e, net: t.profitThisMonth - e };
    });
    return { rows: rows.sort((a, b) => b.net - a.net), general: exp.get('') || 0 };
  }, [expenses, subscribers, payments, towers, month]);
  const towerNames = useMemo(() => [...new Set([...towers.map(t => normTower(t.name)), ...subscribers.map(s => normTower(s.towerName))])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar')), [towers, subscribers]);

  const save = () => {
    if (!draft) return;
    const amount = Math.round(Number(draft.amount) || 0);
    if (amount <= 0) { notify('أدخل مبلغ المصروف.'); return; }
    if (!draft.date) { notify('اختر التاريخ.'); return; }
    onSaveExpense({
      ...draft,
      amount,
      towerName: normTower(draft.towerName) || undefined,
      note: (draft.note || '').trim() || undefined,
      paidBy: (draft.paidBy || '').trim() || undefined,
      id: draft.id || uid('exp'),
      createdBy: draft.createdBy || currentUser.name,
      createdAt: draft.createdAt || new Date().toISOString(),
    });
    notify(draft.id ? 'تم تعديل المصروف.' : 'تم تسجيل المصروف.', 'success');
    setDraft(null);
  };

  const copyRecurring = () => {
    const now = new Date().toISOString();
    // «دفعه» لا يُنسخ: المصروف الجديد لم يُدفع من صندوق أحد بعد (يُعدَّل عند الدفع)
    onSaveExpenses(recurring.map(e => ({ ...e, id: uid('exp'), date: sameDayInMonth(e.date, month), paidBy: undefined, createdBy: currentUser.name, createdAt: now })));
    notify(`تم تسجيل ${recurring.length} مصروف ثابت لشهر ${monthLabel(month)}.`, 'success');
  };

  const shift = (n: number) => setMonth(addMonthsToDateStr(`${month}-01`, n).slice(0, 7));
  const diff = net.net - prevNet.net;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="الشهر السابق" className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        <span className="min-w-[9rem] text-center text-sm font-bold text-white">{monthLabel(month)}</span>
        <button type="button" onClick={() => shift(1)} disabled={month >= todayStr().slice(0, 7)} aria-label="الشهر التالي" className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        <button type="button" onClick={() => setDraft(emptyDraft(month, currentUser))}
          className="ms-auto px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
          <Plus className="w-4 h-4" /> تسجيل مصروف
        </button>
      </div>

      {recurring.length > 0 && (
        <div className="bg-indigo-950/50 border border-indigo-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-indigo-200 flex items-center gap-1.5">
            <Repeat className="w-4 h-4" />
            {recurring.length} مصروف ثابت من الشهر الماضي لم يُسجل بعد ({fmt(sumAmounts(recurring))}): {recurring.slice(0, 3).map(e => categoryLabel(e.category)).join('، ')}{recurring.length > 3 ? '…' : ''}
          </span>
          <button type="button" onClick={copyRecurring} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
            تسجيلها لهذا الشهر
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <Stat label="المقبوض في الشهر" value={fmt(net.collected)} sub={`${net.count} وصل`} tone="cyan" />
        <Stat label="ربح الوصولات (بعد كلفة الجملة)" value={fmt(net.profit)} sub={`كلفة الجملة ${fmt(net.cost)}`} tone="emerald" />
        <Stat label="المصاريف التشغيلية" value={fmt(net.expenses)} sub={`${list.length} مصروف`} tone="rose" />
        <div className={`rounded-xl p-3 border ${net.net >= 0 ? TONES.emerald : TONES.rose}`}>
          <div className="font-bold">صافي الربح الحقيقي</div>
          <div className="text-base sm:text-lg font-bold text-white mt-0.5">{fmt(net.net)}</div>
          <div className={`text-[11px] flex items-center gap-1 ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {diff >= 0 ? '+' : ''}{fmt(diff)} عن الشهر الماضي
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">المصاريف حسب النوع</h3>
          {byCategory.length === 0 ? <p className="text-xs text-slate-500">لا مصاريف في هذا الشهر.</p> : (
            <div className="space-y-2.5">
              {byCategory.map(c => (
                <div key={c.id} className="text-xs">
                  <div className="flex justify-between text-slate-300 mb-1"><span>{c.label}</span><span className="font-bold">{fmt(c.total)}</span></div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${c.color}`} style={{ width: `${Math.max(3, (c.total / net.expenses) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-1">صافي كل برج هذا الشهر</h3>
          <p className="text-[11px] text-slate-500 mb-3">ربح الوصولات المقبوضة من مشتركي البرج ناقص مصاريفه{towerRows.general ? ` • مصاريف عامة غير مربوطة ببرج: ${fmt(towerRows.general)}` : ''}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-slate-400"><tr><th className="pb-2">البرج</th><th className="pb-2">ربح</th><th className="pb-2">مصاريف</th><th className="pb-2">الصافي</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {towerRows.rows.map(t => (
                  <tr key={t.name}>
                    <td className="py-1.5 text-slate-200">{t.name}</td>
                    <td className="py-1.5 text-emerald-400">{fmt(t.profit)}</td>
                    <td className="py-1.5 text-rose-300">{t.expenses ? fmt(t.expenses) : '—'}</td>
                    <td className={`py-1.5 font-bold ${t.net >= 0 ? 'text-white' : 'text-rose-400'}`}>{fmt(t.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 text-sm font-bold text-white">سجل المصاريف ({list.length})</div>
        {list.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <p>لم تُسجل مصاريف لهذا الشهر بعد.</p>
            <p className="text-slate-500">سجّل الإيجار والمولد والرواتب مرة واحدة كـ«مصروف ثابت»، وفي كل شهر جديد تُنسخ بضغطة.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {list.map(e => (
              <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    {categoryLabel(e.category)}
                    {e.recurring && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">ثابت شهرياً</span>}
                  </div>
                  <div className="text-slate-400 mt-0.5 truncate">
                    <span className="font-mono" dir="ltr">{e.date}</span>
                    {' • '}{normTower(e.towerName) || 'مصروف عام'}
                    {e.paidBy && ` • دفعه ${e.paidBy}`}
                    {e.note && ` • ${e.note}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-bold text-rose-300 ml-1">{fmt(e.amount)}</span>
                  <button type="button" onClick={() => setDraft({ ...e, towerName: e.towerName || '', note: e.note || '', paidBy: e.paidBy || '' })} aria-label="تعديل" className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                  {isAdmin && (
                    <button type="button" aria-label="حذف"
                      onClick={async () => { if (await appConfirm(`حذف مصروف ${categoryLabel(e.category)} بمبلغ ${fmt(e.amount)}؟`, { danger: true, confirmLabel: 'حذف' })) onDeleteExpense(e.id); }}
                      className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-300 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {draft && (
        <ExpenseForm draft={draft} setDraft={setDraft} onSave={save} towerNames={towerNames} />
      )}
    </div>
  );
};

const ExpenseForm: React.FC<{
  draft: Expense;
  setDraft: (d: Expense | null) => void;
  onSave: () => void;
  towerNames: string[];
}> = ({ draft, setDraft, onSave, towerNames }) => {
  useEscapeKey(() => setDraft(null));
  const set = (patch: Partial<Expense>) => setDraft({ ...draft, ...patch });
  const input = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDraft(null)}>
      <form role="dialog" aria-modal="true" aria-label="تسجيل مصروف"
        onSubmit={e => { e.preventDefault(); onSave(); }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{draft.id ? 'تعديل مصروف' : 'تسجيل مصروف'}</h3>
          <button type="button" onClick={() => setDraft(null)} aria-label="إغلاق" className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <label className="col-span-2 space-y-1">
            <span className="text-slate-400">المبلغ (د.ع)</span>
            <input id="expense-amount" type="number" inputMode="numeric" min={0} step={250} autoFocus required
              value={draft.amount || ''} onChange={e => set({ amount: Number(e.target.value) })} className={`${input} text-lg font-bold`} />
          </label>
          <div className="col-span-2 flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map(c => (
              <button key={c.id} type="button" onClick={() => set({ category: c.id as ExpenseCategory })} aria-pressed={draft.category === c.id}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${draft.category === c.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="space-y-1">
            <span className="text-slate-400">التاريخ</span>
            <input type="date" required value={draft.date} max={todayStr()} onChange={e => set({ date: e.target.value })} className={`${input} font-mono`} />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">البرج</span>
            <select id="expense-tower" value={draft.towerName || ''} onChange={e => set({ towerName: e.target.value })} className={input}>
              <option value="">مصروف عام</option>
              {towerNames.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">دفعه من الصندوق</span>
            <input value={draft.paidBy || ''} onChange={e => set({ paidBy: e.target.value })} placeholder="اسم الموظف" className={input} />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">ملاحظة</span>
            <input value={draft.note || ''} onChange={e => set({ note: e.target.value })} placeholder="مثلاً: 40 لتر كاز" className={input} />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-slate-300 cursor-pointer">
            <input type="checkbox" checked={!!draft.recurring} onChange={e => set({ recurring: e.target.checked })} className="accent-emerald-500" />
            مصروف ثابت كل شهر (إيجار، اشتراك مولد، راتب) — يُقترح نسخه في الشهر القادم
          </label>
        </div>
        <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer">
          <Check className="w-4 h-4" /> حفظ
        </button>
      </form>
    </div>
  );
};
