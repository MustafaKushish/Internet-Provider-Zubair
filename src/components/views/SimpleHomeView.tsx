import React, { useMemo, useState } from 'react';
import { MessageCircle, RefreshCw, Search, UserPlus, UserRound, X } from 'lucide-react';
import { StaffUser, Subscriber, SystemSettings } from '../../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt } from '../../utils/storage';
import { matchesSubscriber } from '../../utils/search';

/**
 * الوضع البسيط: شاشة واحدة لكبار السن ومن لا يحتاج كل الأقسام.
 * بحث كبير، ثلاثة فلاتر، ولكل مشترك ثلاثة أزرار واضحة فقط (تجديد، واتساب، الملف).
 * كل الإجراءات الأخرى موجودة داخل «الملف» أو في الوضع الكامل.
 */

type Filter = 'attention' | 'expired' | 'debts' | 'all';

interface SimpleHomeViewProps {
  subscribers: Subscriber[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onAdd: () => void;
  onRenew: (sub: Subscriber) => void;
  onWhatsApp: (sub: Subscriber) => void;
  onProfile: (sub: Subscriber) => void;
}

const PAGE = 30;

/** «يوم» / «يومين» / «3 أيام» / «11 يوماً» */
function daysAr(n: number): string {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومين';
  return n <= 10 ? `${n} أيام` : `${n} يوماً`;
}

function statusLine(days: number, expiry: string): { text: string; cls: string } {
  if (days < 0) return { text: `منتهي منذ ${daysAr(-days)}`, cls: 'text-rose-300' };
  if (days === 0) return { text: 'ينتهي اليوم', cls: 'text-amber-300' };
  if (days <= 7) return { text: `ينتهي بعد ${daysAr(days)}`, cls: 'text-amber-300' };
  return { text: `فعّال حتى ${expiry}`, cls: 'text-emerald-300' };
}

export const SimpleHomeView: React.FC<SimpleHomeViewProps> = ({
  subscribers,
  settings,
  currentUser,
  onAdd,
  onRenew,
  onWhatsApp,
  onProfile,
}) => {
  const office = currentUser.role !== 'technician';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('attention');
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(
    () =>
      subscribers.map(sub => ({
        sub,
        days: getDaysRemaining(sub.expiryDate),
        debt: getRemainingDebt(sub),
      })),
    [subscribers],
  );

  const warn = settings.warningDaysBeforeExpiry ?? 3;
  const needsAttention = (r: (typeof rows)[number]) => r.days <= warn || (office && r.debt > 0);
  const counts = {
    attention: rows.filter(needsAttention).length,
    expired: rows.filter(r => r.days < 0).length,
    debts: rows.filter(r => r.debt > 0).length,
    all: rows.length,
  };

  const searching = query.trim().length > 0;
  const visible = useMemo(() => {
    // أثناء البحث نبحث في كل المشتركين بغض النظر عن الفلتر
    const base = searching
      ? rows.filter(r => matchesSubscriber(r.sub, query))
      : rows.filter(r => (filter === 'all' ? true : filter === 'expired' ? r.days < 0 : filter === 'debts' ? r.debt > 0 : needsAttention(r)));
    // الأكثر تأخراً أولاً، ثم الأقرب انتهاءً، ثم الأكبر ديناً
    return [...base].sort((a, b) => a.days - b.days || b.debt - a.debt || a.sub.name.localeCompare(b.sub.name, 'ar'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filter, searching]);

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'attention', label: 'يحتاج متابعة' },
    { id: 'expired', label: 'منتهي' },
    ...(office ? [{ id: 'debts' as Filter, label: 'عليهم ديون' }] : []),
    { id: 'all', label: 'كل المشتركين' },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto text-base">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">أهلاً {currentUser.name.split(' ')[0]}</h2>
          <p className="text-base text-slate-400 mt-1">ابحث عن المشترك ثم اضغط الزر المطلوب.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="h-14 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-lg font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/40"
        >
          <UserPlus className="w-6 h-6" />
          إضافة مشترك جديد
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div>
          <label htmlFor="simple-search" className="block text-base font-semibold text-slate-200 mb-2">
            البحث عن مشترك
          </label>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 pointer-events-none" />
            <input
              id="simple-search"
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setLimit(PAGE); }}
              autoComplete="off"
              className="w-full h-14 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-cyan-500 outline-none pr-13 pl-14 text-lg text-white placeholder:text-slate-500"
              placeholder="مثلاً: أحمد أو 0780"
              aria-describedby="simple-search-help"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="مسح البحث"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
          <p id="simple-search-help" className="text-sm text-slate-400 mt-2">اكتب الاسم أو رقم الهاتف.</p>
        </div>

        {!searching && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="عرض">
            {chips.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setFilter(c.id); setLimit(PAGE); }}
                aria-pressed={filter === c.id}
                className={`h-12 px-4 rounded-xl text-base font-semibold border-2 cursor-pointer ${
                  filter === c.id
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-200'
                    : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {c.label} <span className="tabular-nums">({counts[c.id]})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 text-base text-slate-300">
          {searching ? `نتائج البحث: ${visible.length}` : `${chips.find(c => c.id === filter)!.label}: ${visible.length}`}
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-2">
            <p className="text-lg text-white">{searching ? 'لا يوجد مشترك بهذا الاسم أو الرقم.' : filter === 'attention' ? 'لا يوجد أحد يحتاج متابعة اليوم.' : 'لا يوجد مشتركون هنا.'}</p>
            <p className="text-base text-slate-400">{searching ? 'تأكد من الكتابة أو جرّب جزءاً من الاسم.' : 'كل شيء على ما يرام.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {visible.slice(0, limit).map(({ sub, days, debt }) => {
              const st = statusLine(days, sub.expiryDate);
              return (
                <li key={sub.id} className="p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => onProfile(sub)}
                    className="w-full text-right cursor-pointer group"
                  >
                    <span className="block text-lg font-semibold text-white group-hover:text-cyan-200">{sub.name}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-base">
                      <span className={st.cls}>{st.text}</span>
                      {office && debt > 0 && <span className="text-rose-300">عليه {formatCurrency(debt, settings.currency)}</span>}
                      {sub.phone && <span className="text-slate-400 tabular-nums" dir="ltr">{sub.phone}</span>}
                    </span>
                  </button>
                  <div className={`grid gap-2 ${office ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {office && (
                      <button
                        type="button"
                        onClick={() => onRenew(sub)}
                        className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className="w-5 h-5" /> تجديد
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onWhatsApp(sub)}
                      disabled={!sub.phone}
                      className="h-12 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-base font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MessageCircle className="w-5 h-5 text-emerald-400" /> واتساب
                    </button>
                    <button
                      type="button"
                      onClick={() => onProfile(sub)}
                      className="h-12 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserRound className="w-5 h-5 text-cyan-300" /> الملف
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {visible.length > limit && (
          <div className="p-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setLimit(l => l + PAGE)}
              className="w-full h-12 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-semibold cursor-pointer hover:bg-slate-700"
            >
              عرض المزيد ({visible.length - limit} متبقي)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
