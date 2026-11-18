import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, CheckCircle2, Phone, Search, Send, Wallet } from 'lucide-react';
import { PaymentRecord, Subscriber, SystemSettings } from '../../types/isp';
import { NO_TOWER_LABEL, normTower } from '../../utils/towers';
import { matchesSubscriber } from '../../utils/search';
import { parseLocalDate, toLocalDateStr, todayStr } from '../../utils/dates';
import { formatMonthsAr } from '../../utils/debt';
import { DebtRow, buildDebtRows, summarizeDebts } from '../../utils/debtBoard';
import { reminderMessage } from '../../utils/reminders';
import { formatCurrency, generateWhatsAppLink } from '../../utils/storage';
import { ReminderQueue } from '../ReminderQueue';
import { BackButton } from '../ui/BackButton';
import { useEscapeKey } from '../ui/useEscapeKey';

/**
 * صفحة الديون: ترتّب المدينين بذكاء (من أخلف وعده، ثم الأكبر والأقدم)، وتؤجّل من وعد بالدفع
 * أو له قسط قادم، وتمنع تكرار مطالبة من طُولب قبل أيام. لكل مدين ثلاثة أزرار فقط: طالب، سدّد، وعد.
 */

type Tab = 'today' | 'waiting' | 'all';

const REMINDED_KEY = 'sas_plus_debt_reminded_v1';
const STEP = 18;

function loadReminded(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(REMINDED_KEY) || '{}');
    const cutoff = toLocalDateStr(new Date(Date.now() - 45 * 86400000));
    return Object.fromEntries(Object.entries(v as Record<string, string>).filter(([, d]) => typeof d === 'string' && d >= cutoff));
  } catch {
    return {};
  }
}

const addDays = (n: number) => {
  const d = parseLocalDate(todayStr());
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
};

const daysAgoAr = (n: number) => (n <= 0 ? 'اليوم' : n === 1 ? 'أمس' : n === 2 ? 'قبل يومين' : n <= 10 ? `قبل ${n} أيام` : `قبل ${n} يوماً`);

interface DebtsViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  settings: SystemSettings;
  onOpenDebt: (sub: Subscriber) => void;
  onOpenProfile: (sub: Subscriber) => void;
  onSetPromise: (subId: string, date: string | null) => void;
}

export const DebtsView: React.FC<DebtsViewProps> = ({ subscribers, payments, settings, onOpenDebt, onOpenProfile, onSetPromise }) => {
  const [tab, setTab] = useState<Tab>('today');
  const [search, setSearch] = useState('');
  const [tower, setTower] = useState('all');
  const [limit, setLimit] = useState(STEP);
  const [reminded, setReminded] = useState<Record<string, string>>(loadReminded);
  const [promiseFor, setPromiseFor] = useState<Subscriber | null>(null);
  const [queue, setQueue] = useState<DebtRow[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const money = (n: number) => formatCurrency(Math.round(n), settings.currency);

  useEffect(() => {
    try { localStorage.setItem(REMINDED_KEY, JSON.stringify(reminded)); } catch { /* التخزين غير متاح */ }
  }, [reminded]);
  useEffect(() => { setLimit(STEP); }, [tab, search, tower]);

  const rows = useMemo(() => buildDebtRows(subscribers, payments, { reminded }), [subscribers, payments, reminded]);
  const summary = useMemo(() => summarizeDebts(rows, payments), [rows, payments]);
  const towers = useMemo(() => [...new Set(rows.map(r => normTower(r.sub.towerName) || NO_TOWER_LABEL))].sort((a, b) => a.localeCompare(b, 'ar')), [rows]);
  const remindedToday = Object.values(reminded).filter(d => d === todayStr()).length;

  const visible = useMemo(() => rows
    .filter(r => (tab === 'today' ? r.state === 'today' || r.state === 'broken' : tab === 'waiting' ? r.state === 'waiting' : true))
    .filter(r => tower === 'all' || (normTower(r.sub.towerName) || NO_TOWER_LABEL) === tower)
    .filter(r => matchesSubscriber(r.sub, search)), [rows, tab, tower, search]);

  const messageFor = (r: DebtRow) => reminderMessage(r.sub, 'debt', settings, payments, {
    suggested: r.suggested,
    brokenPromise: r.state === 'broken' ? r.promiseDate : null,
  });
  const send = (r: DebtRow) => {
    setReminded(prev => ({ ...prev, [r.sub.id]: todayStr() }));
    window.open(generateWhatsAppLink(r.sub.phone, messageFor(r)), '_blank');
  };
  const queueable = visible.filter(r => r.sub.phone && (r.state === 'today' || r.state === 'broken'));

  const tabs: Array<{ id: Tab; label: string; n: number }> = [
    { id: 'today', label: 'للمطالبة اليوم', n: summary.today },
    { id: 'waiting', label: 'مؤجّل', n: summary.waiting },
    { id: 'all', label: 'الكل', n: summary.count },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto text-base leading-relaxed">
      {/* الملخص */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4" aria-label="ملخص الديون">
        <div>
          <h2 className="text-lg font-semibold text-white">الديون والمطالبات</h2>
          <p className="text-sm text-slate-400">إجمالي ما في ذمة المشتركين</p>
          <p className="text-3xl font-bold text-rose-300 tabular-nums mt-1">{money(summary.total)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="مدينون" value={String(summary.count)} />
          <Stat label="سُدّد (30 يوماً)" value={money(summary.collected30)} tone="good" />
          <Stat label={`متأخر 3 أشهر+ (${summary.atRiskCount})`} value={money(summary.atRisk)} tone={summary.atRisk > 0 ? 'bad' : undefined} />
        </div>
        {summary.broken > 0 && (
          <p className="text-base text-rose-200 bg-rose-950/50 border border-rose-800 rounded-xl px-4 py-3">
            {summary.broken === 1 ? 'مشترك واحد أخلف' : `${summary.broken} مشتركين أخلفوا`} وعدهم بالدفع، وهم في أول القائمة.
          </p>
        )}
      </section>

      {/* التبويبات */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="عرض الديون">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`min-h-14 rounded-xl border-2 px-2 py-2 text-base font-semibold cursor-pointer leading-snug ${
              tab === t.id ? 'bg-cyan-500/15 border-cyan-500 text-cyan-100' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {t.label}
            <span className="block text-sm tabular-nums opacity-80">{t.n}</span>
          </button>
        ))}
      </div>
      {tab === 'waiting' && <p className="text-sm text-slate-400 -mt-2">من وعد بالدفع أو له قسط قادم: لا حاجة لمطالبته الآن.</p>}

      {/* بحث وتصفية */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-3">
        <div>
          <label htmlFor="debts-search" className="block text-sm font-semibold text-slate-300 mb-1">بحث عن مدين</label>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="debts-search"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="الاسم أو رقم الهاتف"
              className="w-full h-12 bg-slate-900 border border-slate-700 rounded-xl pr-11 pl-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor="debts-tower" className="block text-sm font-semibold text-slate-300 mb-1">البرج</label>
          <select id="debts-tower" value={tower} onChange={e => setTower(e.target.value)} className="w-full h-12 bg-slate-900 border border-slate-700 rounded-xl px-3 text-white focus:outline-none focus:border-cyan-500">
            <option value="all">كل الأبراج</option>
            {towers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {tab === 'today' && queueable.length > 1 && (
        <button
          type="button"
          onClick={() => { setQueue(queueable); setQueueIndex(0); }}
          className="w-full sm:w-auto h-12 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-5 h-5" /> طالبهم واحداً بعد الآخر ({queueable.length})
        </button>
      )}
      {remindedToday > 0 && (
        <p className="text-sm text-emerald-300 flex items-center gap-1.5"><Check className="w-4 h-4" /> تمت مطالبة {remindedToday} اليوم</p>
      )}

      {/* القائمة */}
      {visible.length === 0 ? (
        <div className="py-14 px-4 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <p className="text-lg font-semibold text-white">
            {search || tower !== 'all' ? 'لا نتائج بهذا البحث.' : tab === 'today' ? 'لا أحد للمطالبة اليوم.' : tab === 'waiting' ? 'لا أحد مؤجّل.' : 'لا توجد ديون.'}
          </p>
          <p className="text-sm text-slate-400">
            {tab === 'today' && !search && tower === 'all' && summary.count > 0 ? 'من طُولب قريباً أو وعد بالدفع تجده في «مؤجّل» أو «الكل».' : 'كل شيء على ما يرام.'}
          </p>
          {(search || tower !== 'all') ? (
            <button type="button" onClick={() => { setSearch(''); setTower('all'); }} className="h-12 px-5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold cursor-pointer">مسح البحث</button>
          ) : tab !== 'all' && summary.count > 0 ? (
            <button type="button" onClick={() => setTab('all')} className="h-12 px-5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold cursor-pointer">عرض كل المدينين ({summary.count})</button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.slice(0, limit).map(r => (
            <DebtCard key={r.sub.id} row={r} money={money} onSend={() => send(r)} onPay={() => onOpenDebt(r.sub)} onPromise={() => setPromiseFor(r.sub)} onProfile={() => onOpenProfile(r.sub)} />
          ))}
        </ul>
      )}

      {visible.length > limit && (
        <button type="button" onClick={() => setLimit(l => l + STEP)} className="w-full h-12 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-semibold cursor-pointer hover:bg-slate-700">
          عرض المزيد ({visible.length - limit} متبقٍ)
        </button>
      )}

      {promiseFor && (
        <PromiseSheet
          sub={promiseFor}
          onClose={() => setPromiseFor(null)}
          onSave={date => { onSetPromise(promiseFor.id, date); setPromiseFor(null); }}
        />
      )}
      {queue && (
        <ReminderQueue
          queue={queue.map(r => r.sub)}
          index={queueIndex}
          settings={settings}
          typeFor={() => 'debt'}
          messageFor={sub => { const r = queue.find(x => x.sub.id === sub.id); return r ? messageFor(r) : ''; }}
          onSend={sub => { const r = queue.find(x => x.sub.id === sub.id); if (r) send(r); setQueueIndex(i => i + 1); }}
          onSkip={() => setQueueIndex(i => i + 1)}
          onClose={() => setQueue(null)}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'good' | 'bad' }> = ({ label, value, tone }) => (
  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
    <p className="text-sm text-slate-400 leading-snug">{label}</p>
    <p className={`text-base sm:text-lg font-semibold tabular-nums mt-0.5 ${tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-white'}`}>{value}</p>
  </div>
);

const DebtCard: React.FC<{
  row: DebtRow; money: (n: number) => string;
  onSend: () => void; onPay: () => void; onPromise: () => void; onProfile: () => void;
}> = ({ row, money, onSend, onPay, onPromise, onProfile }) => {
  const { sub, debt, state, lateMonths, plan, promiseDate, suggested, remindedDaysAgo } = row;
  const badge =
    state === 'broken' ? { text: `أخلف وعده (${promiseDate})`, cls: 'bg-rose-950 border-rose-700 text-rose-200' }
    : promiseDate ? { text: `وعد بالدفع ${promiseDate}`, cls: 'bg-indigo-950 border-indigo-700 text-indigo-200' }
    : plan && plan.status === 'ok' ? { text: `قسط قادم ${plan.nextDate}`, cls: 'bg-indigo-950 border-indigo-700 text-indigo-200' }
    : plan && plan.status === 'late' ? { text: `قسط متأخر ${money(plan.arrears)}`, cls: 'bg-rose-950 border-rose-700 text-rose-200' }
    : lateMonths > 0 ? { text: `متأخر ${formatMonthsAr(lateMonths)}`, cls: lateMonths >= 3 ? 'bg-rose-950 border-rose-700 text-rose-200' : 'bg-amber-950 border-amber-700 text-amber-200' }
    : { text: 'اشتراكه ساري', cls: 'bg-emerald-950 border-emerald-800 text-emerald-200' };
  const sent = remindedDaysAgo !== null && remindedDaysAgo === 0;

  return (
    <li className={`bg-slate-900 border rounded-2xl p-4 space-y-3 ${state === 'broken' ? 'border-rose-700' : 'border-slate-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onProfile} className="min-h-11 text-right text-lg font-semibold text-white hover:text-cyan-200 cursor-pointer">{sub.name}</button>
          <p className="text-sm text-slate-400">{normTower(sub.towerName) || NO_TOWER_LABEL}</p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
      </div>

      <div>
        <p className="text-2xl font-bold text-rose-300 tabular-nums">{money(debt)}</p>
        {sub.salePrice > 0 && <p className="text-sm text-slate-400">= {formatMonthsAr(Math.round((debt / sub.salePrice) * 10) / 10)} من الاشتراك</p>}
      </div>

      {suggested > 0 && suggested < debt && (
        <p className="text-base text-amber-200 bg-amber-950/30 border border-amber-900/60 rounded-xl px-3 py-2">اطلب الآن: <b className="tabular-nums">{money(suggested)}</b></p>
      )}
      {remindedDaysAgo !== null && <p className="text-sm text-slate-400">آخر مطالبة: {daysAgoAr(remindedDaysAgo)}</p>}

      {sub.phone
        ? <a href={`tel:${sub.phone}`} className="inline-flex items-center gap-2 min-h-11 text-base text-slate-200 hover:text-cyan-200" dir="ltr"><Phone className="w-4 h-4" />{sub.phone}</a>
        : <p className="text-sm text-amber-300">لا يوجد رقم هاتف: أضفه من ملف المشترك.</p>}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={!sub.phone}
          className={`min-h-12 rounded-xl text-base font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sent ? 'bg-slate-800 border border-emerald-600 text-emerald-200' : 'bg-emerald-700 hover:bg-emerald-600 text-white'}`}
        >
          {sent ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />} {sent ? 'تمت' : 'طالب'}
        </button>
        <button type="button" onClick={onPay} className="min-h-12 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white text-base font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
          <Wallet className="w-5 h-5" /> سدّد
        </button>
        <button type="button" onClick={onPromise} className="min-h-12 rounded-xl bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white text-base font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
          <CalendarClock className="w-5 h-5" /> وعد
        </button>
      </div>
    </li>
  );
};

/** تسجيل وعد المشترك بالتسديد في تاريخ محدد (يُؤجَّل في القائمة حتى ذلك التاريخ) */
const PromiseSheet: React.FC<{ sub: Subscriber; onClose: () => void; onSave: (date: string | null) => void }> = ({ sub, onClose, onSave }) => {
  useEscapeKey(onClose);
  const [date, setDate] = useState(sub.promiseDate && sub.promiseDate >= todayStr() ? sub.promiseDate : addDays(7));
  const quick = [{ n: 1, label: 'غداً' }, { n: 3, label: 'بعد 3 أيام' }, { n: 7, label: 'بعد أسبوع' }, { n: 14, label: 'بعد أسبوعين' }];
  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`وعد ${sub.name} بالتسديد`}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl text-base leading-relaxed"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">متى سيسدّد {sub.name}؟</h3>
          <BackButton onClick={onClose} />
        </div>
        <p className="text-sm text-slate-400">لن تظهر له مطالبة حتى ذلك التاريخ. إن مرّ دون دفع يعود في أول القائمة.</p>
        <div className="grid grid-cols-2 gap-2">
          {quick.map(q => (
            <button key={q.n} type="button" onClick={() => setDate(addDays(q.n))} aria-pressed={date === addDays(q.n)}
              className={`min-h-12 rounded-xl border-2 text-base font-semibold cursor-pointer ${date === addDays(q.n) ? 'bg-cyan-500/15 border-cyan-500 text-cyan-100' : 'bg-slate-950 border-slate-700 text-slate-200'}`}>
              {q.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-300 mb-1">أو تاريخ محدد</span>
          <input type="date" value={date} min={addDays(1)} onChange={e => setDate(e.target.value)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white focus:outline-none focus:border-cyan-500" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => onSave(date)} disabled={!date || date < addDays(1)}
            className="flex-1 min-h-12 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-base font-semibold cursor-pointer disabled:opacity-40">
            حفظ الوعد
          </button>
          {sub.promiseDate && (
            <button type="button" onClick={() => onSave(null)} className="min-h-12 px-4 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-base font-semibold cursor-pointer">
              إلغاء الوعد
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
