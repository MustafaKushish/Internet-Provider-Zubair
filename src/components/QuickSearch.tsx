import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, MessageSquare, History, Edit, Wallet, Wrench, X, TowerControl } from 'lucide-react';
import { StaffUser, Subscriber } from '../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt } from '../utils/storage';
import { formatMonthsAr, monthsLate } from '../utils/debt';
import { NO_TOWER_LABEL, normTower } from '../utils/towers';
import { matchesSubscriber } from '../utils/search';
import { useEscapeKey } from './ui/useEscapeKey';

interface QuickSearchProps {
  open: boolean;
  onClose: () => void;
  subscribers: Subscriber[];
  currentUser: StaffUser;
  currency: 'IQD' | 'USD';
  onRenew: (sub: Subscriber) => void;
  onWhatsApp: (sub: Subscriber) => void;
  onHistory: (sub: Subscriber) => void;
  onDebt: (sub: Subscriber) => void;
  onEdit: (sub: Subscriber) => void;
  onTicket: (sub: Subscriber) => void;
}

const MAX_RESULTS = 8;

/** بحث سريع عن أي مشترك من أي مكان (Ctrl+K أو /) مع العمليات الأساسية مباشرة */
export const QuickSearch: React.FC<QuickSearchProps> = props => (props.open ? <QuickSearchInner {...props} /> : null);

const QuickSearchInner: React.FC<QuickSearchProps> = ({
  onClose, subscribers, currentUser, currency, onRenew, onWhatsApp, onHistory, onDebt, onEdit, onTicket,
}) => {
  useEscapeKey(onClose);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return subscribers.filter(s => matchesSubscriber(s, query)).slice(0, MAX_RESULTS);
  }, [query, subscribers]);
  useEffect(() => { setActive(0); }, [query]);

  const office = currentUser.role !== 'technician';
  // Enter = العملية الأهم: تجديد (المكتب) أو تعديل فني (الفني)
  const run = (fn: (s: Subscriber) => void, sub: Subscriber) => {
    onClose();
    fn(sub);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); run(office ? onRenew : onEdit, results[active]); }
  };

  const btn = 'h-8 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4 pt-[8vh] bg-slate-950/80 backdrop-blur-sm no-print" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="بحث سريع عن مشترك"
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-slate-800">
          <Search className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <input
            ref={inputRef}
            id="quick-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="اسم المشترك، الهاتف، اليوزر، الآي بي…"
            className="flex-1 bg-transparent py-4 text-base text-white placeholder-slate-500 focus:outline-none"
            autoComplete="off"
          />
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {!query.trim() ? (
            <p className="p-5 text-xs text-slate-400 leading-relaxed">
              اكتب جزءاً من الاسم أو رقم الهاتف (مع أو بدون صفر) أو اليوزر أو الآي بي.
              <span className="hidden sm:inline"> الأسهم للتنقل، و Enter {office ? 'للتجديد' : 'للتعديل الفني'}، و Esc للإغلاق.</span>
            </p>
          ) : results.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">لا يوجد مشترك مطابق لـ «{query}».</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {results.map((sub, i) => {
                const days = getDaysRemaining(sub.expiryDate);
                const debt = getRemainingDebt(sub);
                return (
                  <li
                    key={sub.id}
                    onMouseEnter={() => setActive(i)}
                    className={`px-4 py-3 ${i === active ? 'bg-slate-800/70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{sub.name}</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                          {sub.phone && <span className="font-mono" dir="ltr">{sub.phone}</span>}
                          <span className="font-mono text-indigo-300" dir="ltr">{sub.username}</span>
                          <span className="flex items-center gap-0.5"><TowerControl className="w-3 h-3" />{normTower(sub.towerName) || NO_TOWER_LABEL}</span>
                          <span>{sub.planName}</span>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0 text-[10px] space-y-0.5">
                        {days > 3 ? (
                          <span className="block text-emerald-300">متبقي {days} يوم</span>
                        ) : days >= 0 ? (
                          <span className="block text-amber-300 font-bold">{days === 0 ? 'ينتهي اليوم' : `متبقي ${days} يوم`}</span>
                        ) : (
                          <span className="block text-rose-300 font-bold">متأخر {formatMonthsAr(monthsLate(sub.expiryDate))}</span>
                        )}
                        {office && debt > 0 && <span className="block text-rose-400 font-bold">دين {formatCurrency(debt, currency)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {office ? (
                        <>
                          <button type="button" onClick={() => run(onRenew, sub)} className={`${btn} bg-cyan-600 hover:bg-cyan-500 text-white`}><RefreshCw className="w-3.5 h-3.5" />تجديد</button>
                          <button type="button" onClick={() => run(onWhatsApp, sub)} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><MessageSquare className="w-3.5 h-3.5" />واتساب</button>
                          {debt > 0 && <button type="button" onClick={() => run(onDebt, sub)} className={`${btn} bg-rose-700 hover:bg-rose-600 text-white`}><Wallet className="w-3.5 h-3.5" />الدين</button>}
                          <button type="button" onClick={() => run(onHistory, sub)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`}><History className="w-3.5 h-3.5" />الوصولات</button>
                          <button type="button" onClick={() => run(onEdit, sub)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`}><Edit className="w-3.5 h-3.5" />تعديل</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => run(onEdit, sub)} className={`${btn} bg-cyan-600 hover:bg-cyan-500 text-white`}><Wrench className="w-3.5 h-3.5" />تعديل فني</button>
                          <button type="button" onClick={() => run(onWhatsApp, sub)} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><MessageSquare className="w-3.5 h-3.5" />واتساب</button>
                        </>
                      )}
                      <button type="button" onClick={() => run(onTicket, sub)} className={`${btn} bg-slate-800 hover:bg-amber-900/60 text-amber-300 border border-slate-700`}><Wrench className="w-3.5 h-3.5" />بلاغ عطل</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
