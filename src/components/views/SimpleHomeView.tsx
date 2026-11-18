import React, { useMemo, useState } from 'react';
import { AlertCircle, BellRing, CheckCircle2, MessageCircle, RefreshCw, Search, UserPlus, UserRound, Users, Wallet, X } from 'lucide-react';
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

type Tone = 'cyan' | 'rose' | 'amber' | 'emerald' | 'slate';

/** ألوان موحّدة: أحمر = منتهي فقط، كهرماني = ينتهي قريباً أو دين، أخضر = ساري */
const TONE: Record<Tone, { text: string; soft: string; ring: string }> = {
  cyan: { text: 'text-cyan-200', soft: 'bg-cyan-500/15 text-cyan-200', ring: 'border-cyan-400 bg-cyan-500/15' },
  rose: { text: 'text-rose-200', soft: 'bg-rose-500/15 text-rose-200', ring: 'border-rose-400 bg-rose-500/15' },
  amber: { text: 'text-amber-200', soft: 'bg-amber-500/15 text-amber-200', ring: 'border-amber-400 bg-amber-500/15' },
  emerald: { text: 'text-emerald-200', soft: 'bg-emerald-500/15 text-emerald-200', ring: 'border-emerald-400 bg-emerald-500/15' },
  slate: { text: 'text-slate-100', soft: 'bg-white/10 text-slate-100', ring: 'border-slate-300 bg-white/10' },
};

function statusOf(days: number, expiry: string): { text: string; tone: Tone } {
  if (days < 0) return { text: `منتهي منذ ${daysAr(-days)}`, tone: 'rose' };
  if (days === 0) return { text: 'ينتهي اليوم', tone: 'amber' };
  if (days <= 7) return { text: `ينتهي بعد ${daysAr(days)}`, tone: 'amber' };
  return { text: `ساري حتى ${expiry}`, tone: 'emerald' };
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
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

  const tiles: Array<{ id: Filter; label: string; icon: React.ComponentType<{ className?: string }>; tone: Tone }> = [
    { id: 'attention', label: 'يحتاج متابعة', icon: BellRing, tone: 'cyan' },
    { id: 'expired', label: 'منتهي', icon: AlertCircle, tone: 'rose' },
    ...(office ? [{ id: 'debts' as Filter, label: 'عليهم ديون', icon: Wallet, tone: 'amber' as Tone }] : []),
    { id: 'all', label: 'كل المشتركين', icon: Users, tone: 'slate' },
  ];
  const today = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="space-y-4 max-w-3xl mx-auto text-base leading-relaxed">
      {/* الترحيب + إضافة مشترك */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-white truncate">{greeting()}، {currentUser.name.split(' ')[0]}</h2>
          <p className="text-sm text-slate-400">{today}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="h-12 px-4 sm:px-5 rounded-2xl bg-cyan-600 text-white text-base font-semibold flex items-center gap-2 cursor-pointer flex-shrink-0"
        >
          <UserPlus className="w-5 h-5" />
          أضف مشتركاً
        </button>
      </div>

      {/* البحث: المهمة الأولى */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 sm:p-4">
        <label htmlFor="simple-search" className="block text-sm font-semibold text-slate-300 mb-2">البحث عن مشترك</label>
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-cyan-300 pointer-events-none" />
          <input
            id="simple-search"
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setLimit(PAGE); }}
            autoComplete="off"
            className="w-full h-14 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 outline-none pr-13 pl-14 text-lg text-white placeholder:text-slate-500"
            placeholder="الاسم أو رقم الهاتف"
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
      </div>

      {/* نظرة اليوم = الفلاتر */}
      {!searching && (
        <div className={`grid grid-cols-2 gap-3 ${tiles.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`} role="group" aria-label="عرض">
          {tiles.map(t => {
            const Icon = t.icon;
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setFilter(t.id); setLimit(PAGE); }}
                aria-pressed={active}
                className={`min-h-[4.5rem] rounded-2xl border-2 p-3 flex items-center gap-3 text-right cursor-pointer ${active ? TONE[t.tone].ring : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TONE[t.tone].soft}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-2xl font-bold tabular-nums leading-tight ${TONE[t.tone].text}`}>{counts[t.id]}</span>
                  <span className="block text-sm text-slate-300 leading-snug">{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* القائمة */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
        {searching && <p className="px-4 py-3 border-b border-slate-800 text-sm text-slate-300">نتائج البحث: {visible.length}</p>}

        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto" />
            <p className="text-lg text-white">{searching ? 'لا يوجد مشترك بهذا الاسم أو الرقم.' : filter === 'attention' ? 'لا أحد يحتاج متابعة اليوم.' : 'لا يوجد مشتركون هنا.'}</p>
            <p className="text-base text-slate-400">{searching ? 'تأكد من الكتابة أو جرّب جزءاً من الاسم.' : 'كل شيء على ما يرام.'}</p>
            {!searching && filter !== 'all' && counts.all > 0 && (
              <button type="button" onClick={() => setFilter('all')} className="h-12 px-5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold cursor-pointer">
                عرض كل المشتركين ({counts.all})
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {visible.slice(0, limit).map(({ sub, days, debt }) => {
              const st = statusOf(days, sub.expiryDate);
              return (
                <li key={sub.id} className="p-4 space-y-3">
                  <button type="button" onClick={() => onProfile(sub)} className="w-full flex items-center gap-3 text-right cursor-pointer group">
                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${TONE.slate.soft}`}>
                      {sub.name.trim().charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold text-white group-hover:text-cyan-200 truncate">{sub.name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm">
                        <span className={`px-2 py-0.5 rounded-full ${TONE[st.tone].soft}`}>{st.text}</span>
                        {office && debt > 0 && <span className="text-amber-200 tabular-nums">دين {formatCurrency(debt, settings.currency)}</span>}
                        {sub.phone && <span className="text-slate-400 tabular-nums" dir="ltr">{sub.phone}</span>}
                      </span>
                    </span>
                  </button>
                  <div className={`grid gap-2 ${office ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {office && (
                      <button
                        type="button"
                        onClick={() => onRenew(sub)}
                        className="h-12 rounded-xl bg-emerald-600 text-white text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
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
                      <MessageCircle className="w-5 h-5 text-emerald-300" /> واتساب
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
              عرض المزيد ({visible.length - limit} متبقٍ)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
