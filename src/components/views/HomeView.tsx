import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PaymentRecord, PlanItem, StaffUser, Subscriber, SupportTicket, SystemSettings } from '../../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt } from '../../utils/storage';
import { todayStr } from '../../utils/dates';
import { daysBetween } from '../../utils/marketingPlan';
import { buildTodayTasks, countByKind, type TaskKind, type TodayTask } from '../../utils/today';

/**
 * الرئيسية («اليوم»): ثلاثة أرقام وقائمة واحدة «ما يجب فعله اليوم»، لكل سطر زر واحد.
 * الرسوم البيانية والتفاصيل في «المال»، والقوائم الكاملة في أقسامها.
 */
interface HomeViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  tickets: SupportTicket[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onSearch: () => void;
  onRenew: (s: Subscriber) => void;
  onRemind: (s: Subscriber) => void;
  onDebt: (s: Subscriber) => void;
  onProfile: (s: Subscriber) => void;
  onOpenTab: (tab: string) => void;
}

const PAGE = 8;

function daysAr(n: number): string {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومين';
  return n <= 10 ? `${n} أيام` : `${n} يوماً`;
}

const FILTERS: Array<{ id: TaskKind | 'all'; label: string; money?: boolean }> = [
  { id: 'all', label: 'الكل' },
  { id: 'renew', label: 'تجديد' },
  { id: 'remind', label: 'ينتهي قريباً' },
  { id: 'debt', label: 'ديون', money: true },
  { id: 'ticket', label: 'بلاغات' },
];

export const HomeView: React.FC<HomeViewProps> = ({ subscribers, payments, tickets, settings, currentUser, onSearch, onRenew, onRemind, onDebt, onProfile, onOpenTab }) => {
  const showMoney = currentUser.role !== 'technician';
  const today = todayStr();
  const [filter, setFilter] = useState<TaskKind | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);
  const money = (n: number) => formatCurrency(Math.round(n), settings.currency);

  const tasks = useMemo(() => buildTodayTasks(subscribers, tickets, { showMoney }), [subscribers, tickets, showMoney]);
  const counts = countByKind(tasks);
  const shown = (filter === 'all' ? tasks : tasks.filter(t => t.kind === filter)).slice(0, limit);
  const total = filter === 'all' ? counts.all : counts[filter];

  const collectedToday = useMemo(() => payments.filter(p => p.date === today).reduce((a, p) => a + (p.amount || 0), 0), [payments, today]);
  const endingWeek = useMemo(() => subscribers.filter(s => !s.archived && (d => d >= 0 && d <= 7)(getDaysRemaining(s.expiryDate))).length, [subscribers]);
  const totalDebt = useMemo(() => (showMoney ? subscribers.filter(s => !s.archived).reduce((a, s) => a + getRemainingDebt(s), 0) : 0), [subscribers, showMoney]);
  const openTickets = counts.ticket;

  // أقرب بند في خطة التسويق (خلال أسبوعين)
  const nextPlan: PlanItem | undefined = showMoney
    ? (settings.marketingPlan || []).filter(i => !i.skipped && i.startDate >= today && daysBetween(today, i.startDate) <= 14).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    : undefined;

  const h = new Date().getHours();
  const dateText = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const status = (t: TodayTask): { text: string; cls: string } => {
    if (t.kind === 'ticket') return { text: t.ticket?.subscriberName ? `بلاغ: ${t.ticket.subscriberName}` : 'بلاغ مفتوح', cls: 'bg-white/10 text-slate-200' };
    if (t.kind === 'renew') return { text: t.days === -1 ? 'انتهى أمس' : `انتهى منذ ${daysAr(-(t.days || 0))}`, cls: 'bg-rose-500/15 text-rose-200' };
    if (t.kind === 'remind') return { text: t.days === 0 ? 'ينتهي اليوم' : t.days === 1 ? 'ينتهي غداً' : `ينتهي بعد ${daysAr(t.days || 0)}`, cls: 'bg-amber-500/15 text-amber-200' };
    return { text: `عليه ${money(t.amount || 0)}`, cls: 'bg-amber-500/15 text-amber-200' };
  };

  const action = (t: TodayTask) => {
    const base = 'min-h-11 px-4 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap';
    const sec = `${base} bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700`;
    if (t.kind === 'ticket') return <button type="button" onClick={() => onOpenTab('tickets')} className={sec}>افتح</button>;
    const s = t.subscriber!;
    if (t.kind === 'renew') return currentUser.role === 'technician'
      ? <button type="button" onClick={() => onRemind(s)} className={sec}>ذكّره</button>
      : <button type="button" onClick={() => onRenew(s)} className={`${base} bg-emerald-600 hover:bg-emerald-500 text-white`}>جدّد</button>;
    if (t.kind === 'remind') return <button type="button" onClick={() => onRemind(s)} className={sec}>ذكّره</button>;
    return <button type="button" onClick={() => onDebt(s)} className={sec}>طالِب</button>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">{h < 12 ? 'صباح الخير' : 'مساء الخير'}</h2>
          <p className="text-sm text-slate-400">{dateText}</p>
        </div>
      </div>

      <button type="button" onClick={onSearch} className="w-full h-13 min-h-12 rounded-2xl bg-slate-900 border border-slate-700 px-4 flex items-center gap-3 text-slate-400 text-base cursor-pointer hover:border-slate-500 lg:hidden">
        <Search className="w-5 h-5" /> ابحث بالاسم أو الهاتف أو اليوزر
      </button>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {showMoney ? (
          <button type="button" onClick={() => onOpenTab('cash')} className="text-right bg-slate-900 border border-slate-700 rounded-2xl p-3 sm:p-4 cursor-pointer hover:border-slate-500">
            <span className="block text-xs sm:text-sm text-slate-400">قبضنا اليوم</span>
            <span className="block text-lg sm:text-2xl font-bold text-emerald-300 tabular-nums mt-1">{collectedToday.toLocaleString('en-US')}</span>
          </button>
        ) : (
          <button type="button" onClick={() => onOpenTab('tickets')} className="text-right bg-slate-900 border border-slate-700 rounded-2xl p-3 sm:p-4 cursor-pointer hover:border-slate-500">
            <span className="block text-xs sm:text-sm text-slate-400">بلاغات مفتوحة</span>
            <span className="block text-lg sm:text-2xl font-bold text-amber-300 tabular-nums mt-1">{openTickets}</span>
          </button>
        )}
        <button type="button" onClick={() => onOpenTab('reminders')} className="text-right bg-slate-900 border border-slate-700 rounded-2xl p-3 sm:p-4 cursor-pointer hover:border-slate-500">
          <span className="block text-xs sm:text-sm text-slate-400">ينتهون هذا الأسبوع</span>
          <span className="block text-lg sm:text-2xl font-bold text-amber-300 tabular-nums mt-1">{endingWeek}</span>
        </button>
        {showMoney ? (
          <button type="button" onClick={() => onOpenTab('debts')} className="text-right bg-slate-900 border border-slate-700 rounded-2xl p-3 sm:p-4 cursor-pointer hover:border-slate-500">
            <span className="block text-xs sm:text-sm text-slate-400">ديون</span>
            <span className="block text-lg sm:text-2xl font-bold text-amber-300 tabular-nums mt-1">{totalDebt.toLocaleString('en-US')}</span>
          </button>
        ) : (
          <button type="button" onClick={() => onOpenTab('subscribers')} className="text-right bg-slate-900 border border-slate-700 rounded-2xl p-3 sm:p-4 cursor-pointer hover:border-slate-500">
            <span className="block text-xs sm:text-sm text-slate-400">المشتركون</span>
            <span className="block text-lg sm:text-2xl font-bold text-white tabular-nums mt-1">{subscribers.filter(s => !s.archived).length}</span>
          </button>
        )}
      </div>

      <section aria-label="ما يجب فعله اليوم" className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-white">ما يجب فعله اليوم <span className="text-sm font-normal text-slate-400">({counts.all})</span></h3>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="تصفية المهام">
            {FILTERS.filter(f => (!f.money || showMoney) && (f.id === 'all' || counts[f.id] > 0)).map(f => (
              <button key={f.id} type="button" onClick={() => { setFilter(f.id); setLimit(PAGE); }} aria-pressed={filter === f.id}
                className={`h-9 px-3 rounded-full text-sm whitespace-nowrap cursor-pointer border ${filter === f.id ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-100' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                {f.label}{f.id !== 'all' ? ` ${counts[f.id]}` : ''}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 pb-6 pt-2 text-slate-300">لا شيء عاجل اليوم. كل شيء تحت السيطرة.</p>
        ) : (
          <ul>
            {shown.map(t => {
              const st = status(t);
              return (
                <li key={t.key} className="flex items-center gap-3 px-4 py-3 border-t border-slate-700/70">
                  <button type="button" onClick={() => (t.subscriber ? onProfile(t.subscriber) : onOpenTab('tickets'))} className="flex-1 min-w-0 text-right cursor-pointer">
                    <span className="block font-semibold text-white truncate">{t.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                      {t.subscriber && <span className="truncate">{t.subscriber.planName}{t.subscriber.towerName ? ` • ${t.subscriber.towerName}` : ''}</span>}
                    </span>
                  </button>
                  {action(t)}
                </li>
              );
            })}
          </ul>
        )}
        {total > shown.length && (
          <div className="px-4 py-3 border-t border-slate-700/70">
            <button type="button" onClick={() => setLimit(l => l + 20)} className="text-sm text-cyan-300 cursor-pointer">اعرض المزيد ({total - shown.length})</button>
          </div>
        )}
      </section>

      {nextPlan && (
        <button type="button" onClick={() => onOpenTab('marketing')} className="w-full text-right rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 flex items-center gap-3 cursor-pointer">
          <span className="flex-1 text-sm text-slate-100">
            {nextPlan.title}: {nextPlan.startDate === today ? 'يبدأ اليوم' : `يبدأ بعد ${daysAr(daysBetween(today, nextPlan.startDate))}`}
          </span>
          <span className="text-sm text-cyan-300">الخطة ←</span>
        </button>
      )}
    </div>
  );
};
