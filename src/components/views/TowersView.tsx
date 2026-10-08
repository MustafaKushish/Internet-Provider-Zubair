import React, { useMemo, useState } from 'react';
import { useEscapeKey } from '../ui/useEscapeKey';
import { PaymentRecord, Subscriber, SystemSettings, TowerPoint } from '../../types/isp';
import { formatCurrency } from '../../utils/storage';
import { computeTowerStats, NO_TOWER_LABEL, sortTowerStats, TowerSortKey, TowerStats } from '../../utils/towers';
import {
  TowerControl, Plus, Edit, Trash2, Users, TrendingUp, Wallet, AlertTriangle, MapPin, Network,
  ArrowLeftRight, Search, Trophy, X, CheckCircle2,
} from 'lucide-react';

interface TowersViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  towers: TowerPoint[];
  settings: SystemSettings;
  canEdit: boolean;
  onAddTower: () => void;
  onEditTower: (tower: TowerPoint) => void;
  onDeleteTower: (tower: TowerPoint, moveSubscribersTo: string) => void;
  onRegisterTower: (name: string) => void;
  onMoveSubscribers: (fromName: string, toName: string) => void;
  onShowSubscribers: (towerName: string) => void;
}

const SORTS: { key: TowerSortKey; label: string }[] = [
  { key: 'subscribers', label: 'الأكثر مشتركين' },
  { key: 'monthlyProfit', label: 'الأعلى ربحاً' },
  { key: 'collectedThisMonth', label: 'الأعلى تحصيلاً هذا الشهر' },
  { key: 'debts', label: 'الأعلى ديوناً' },
];

// نافذة حذف برج أو نقل مشتركيه: تسأل إلى أين ينتقل المشتركون
interface MoveDialogState {
  mode: 'delete' | 'move';
  stats: TowerStats;
}

export const TowersView: React.FC<TowersViewProps> = ({
  subscribers,
  payments,
  towers,
  settings,
  canEdit,
  onAddTower,
  onEditTower,
  onDeleteTower,
  onRegisterTower,
  onMoveSubscribers,
  onShowSubscribers,
}) => {
  const [sortKey, setSortKey] = useState<TowerSortKey>('subscribers');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<MoveDialogState | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  useEscapeKey(() => setDialog(null), !!dialog);

  const money = (n: number) => formatCurrency(Math.round(n), settings.currency);

  const allStats = useMemo(() => computeTowerStats(subscribers, payments, towers), [subscribers, payments, towers]);
  const sorted = useMemo(() => sortTowerStats(allStats, sortKey), [allStats, sortKey]);
  const visible = sorted.filter(s => {
    const q = search.trim();
    if (!q) return true;
    return s.name.includes(q) || (s.tower?.location || '').includes(q) || (s.tower?.ipRange || '').includes(q);
  });

  const registered = allStats.filter(s => s.registered);
  const unregistered = allStats.filter(s => !s.registered && s.name !== NO_TOWER_LABEL && s.subscribers > 0);
  const noTower = allStats.find(s => s.name === NO_TOWER_LABEL);
  const maxMetric = Math.max(1, ...sorted.map(s => Math.abs(s[sortKey])));
  const totalSubs = subscribers.length || 1;
  const bestProfit = sortTowerStats(registered, 'monthlyProfit')[0];
  const bestCount = sortTowerStats(registered, 'subscribers')[0];

  const openDialog = (mode: 'delete' | 'move', stats: TowerStats) => {
    setDialog({ mode, stats });
    const firstOther = registered.find(r => r.name !== stats.name);
    setMoveTarget(firstOther ? firstOther.name : '');
  };

  const confirmDialog = () => {
    if (!dialog) return;
    if (dialog.mode === 'delete' && dialog.stats.tower) {
      onDeleteTower(dialog.stats.tower, moveTarget);
    } else {
      onMoveSubscribers(dialog.stats.name, moveTarget);
    }
    setDialog(null);
  };

  const metricText = (s: TowerStats) => {
    switch (sortKey) {
      case 'subscribers': return `${s.subscribers} مشترك`;
      case 'monthlyProfit': return money(s.monthlyProfit);
      case 'collectedThisMonth': return money(s.collectedThisMonth);
      case 'debts': return money(s.debts);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <TowerControl className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">الأبراج ونقاط البث</h1>
              <p className="text-xs text-slate-400 mt-0.5">إضافة الأبراج الجديدة وإزالة المفككة، وربط المشتركين ومقارنة الأرباح بين الأبراج</p>
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onAddTower}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة برج جديد</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-slate-400 block text-[10px] font-semibold">الأبراج المسجلة</span>
            <span className="text-base font-bold text-cyan-400">{registered.length}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-slate-400 block text-[10px] font-semibold">مشتركون بدون برج</span>
            <span className={`text-base font-bold ${noTower && noTower.subscribers > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {noTower?.subscribers || 0}
            </span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 min-w-0">
            <span className="text-slate-400 block text-[10px] font-semibold">الأكثر مشتركين</span>
            <span className="text-sm font-bold text-white truncate block">
              {bestCount && bestCount.subscribers > 0 ? `${bestCount.name} (${bestCount.subscribers})` : '—'}
            </span>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-2xl p-3 min-w-0">
            <span className="text-emerald-300 block text-[10px] font-semibold">الأعلى ربحاً (شهرياً متوقع)</span>
            <span className="text-sm font-bold text-emerald-400 truncate block">
              {bestProfit && bestProfit.monthlyProfit > 0 ? `${bestProfit.name} (${money(bestProfit.monthlyProfit)})` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Unregistered names found on subscribers */}
      {unregistered.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              هذه الأسماء مكتوبة عند مشتركين لكنها غير مسجلة كأبراج (غالباً من الاستيراد أو بكتابة مختلفة).
              سجّلها كبرج جديد، أو انقل مشتركيها إلى برج موجود.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {unregistered.map(u => (
              <div key={u.name} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-white">{u.name} <span className="text-slate-400 font-normal">• {u.subscribers} مشترك</span></span>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onRegisterTower(u.name)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-bold cursor-pointer">
                      تسجيل كبرج
                    </button>
                    <button type="button" onClick={() => openDialog('move', u)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                      <ArrowLeftRight className="w-3 h-3" /> نقل إلى برج موجود
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">ترتيب الأبراج</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
              <input
                id="tower-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن برج أو منطقة…"
                className="w-full sm:w-48 bg-slate-950 border border-slate-700 rounded-lg pr-8 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {SORTS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSortKey(s.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${sortKey === s.key ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right min-w-[860px]">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                <th className="py-2.5 px-3 w-8">#</th>
                <th className="py-2.5 px-3">البرج</th>
                <th className="py-2.5 px-3">المشتركون</th>
                <th className="py-2.5 px-3">الإيراد الشهري المتوقع</th>
                <th className="py-2.5 px-3">الربح الشهري المتوقع</th>
                <th className="py-2.5 px-3">المقبوض هذا الشهر</th>
                <th className="py-2.5 px-3">الديون</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {visible.map((s, idx) => {
                const share = Math.round((s.subscribers / totalSubs) * 100);
                const barPct = Math.max(2, Math.round((Math.abs(s[sortKey]) / maxMetric) * 100));
                const isNone = s.name === NO_TOWER_LABEL;
                return (
                  <tr key={s.name} className="hover:bg-slate-800/40 align-top">
                    <td className="py-3 px-3 text-slate-500 font-bold">{idx + 1}</td>
                    <td className="py-3 px-3 min-w-[220px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold text-sm ${isNone ? 'text-amber-300' : 'text-white'}`}>{s.name}</span>
                        {!s.registered && !isNone && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">غير مسجل</span>
                        )}
                      </div>
                      {(s.tower?.location || s.tower?.ipRange) && (
                        <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                          {s.tower?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.tower.location}</span>}
                          {s.tower?.ipRange && <span className="flex items-center gap-1 font-mono" dir="ltr"><Network className="w-3 h-3" />{s.tower.ipRange}</span>}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden max-w-[180px]">
                          <div className={`h-1.5 rounded-full ${sortKey === 'debts' ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{metricText(s)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white flex items-center gap-1"><Users className="w-3.5 h-3.5 text-cyan-400" />{s.subscribers} <span className="text-slate-500 font-normal">({share}%)</span></div>
                      <div className="text-[10px] mt-0.5"><span className="text-emerald-400">{s.active} نشط</span> • <span className="text-rose-400">{s.expired} منتهي</span></div>
                    </td>
                    <td className="py-3 px-3 font-mono">{money(s.monthlyRevenue)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400"><TrendingUp className="w-3 h-3 inline ml-1" />{money(s.monthlyProfit)}</td>
                    <td className="py-3 px-3 font-mono text-cyan-300"><Wallet className="w-3 h-3 inline ml-1" />{money(s.collectedThisMonth)}</td>
                    <td className={`py-3 px-3 font-mono ${s.debts > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>{money(s.debts)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {s.subscribers > 0 && (
                          <button type="button" onClick={() => onShowSubscribers(s.name)} title="عرض مشتركي هذا البرج"
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer whitespace-nowrap">
                            المشتركون
                          </button>
                        )}
                        {canEdit && s.tower && (
                          <>
                            <button type="button" onClick={() => onEditTower(s.tower!)} title="تعديل البرج"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => openDialog('delete', s)} title="حذف البرج (تفكيك)"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {canEdit && !s.registered && !isNone && (
                          <button type="button" onClick={() => onRegisterTower(s.name)} title="تسجيل كبرج"
                            className="px-2 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap">
                            تسجيل
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <TowerControl className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    {towers.length === 0 ? 'لا توجد أبراج بعد. أضف أول برج من الزر بالأعلى.' : 'لا يوجد برج مطابق للبحث.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[10px] text-slate-500 border-t border-slate-800">
          المتوقع = رسوم وكلفة شهر واحد لكل مشتركي البرج (عدا الموقوفين)، أي ما يربحه البرج إذا جدد الجميع. المقبوض هذا الشهر = الوصولات المسجلة منذ بداية الشهر.
        </p>
      </div>

      {/* Delete / move dialog */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDialog(null)}>
          <div role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dialog.mode === 'delete' ? 'bg-rose-600/20 text-rose-400' : 'bg-cyan-600/20 text-cyan-400'}`}>
                  {dialog.mode === 'delete' ? <Trash2 className="w-5 h-5" /> : <ArrowLeftRight className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {dialog.mode === 'delete' ? `حذف البرج «${dialog.stats.name}»` : `نقل مشتركي «${dialog.stats.name}»`}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {dialog.stats.subscribers > 0
                      ? `على هذا البرج ${dialog.stats.subscribers} مشترك. اختر إلى أين ينتقلون:`
                      : 'لا يوجد مشتركون على هذا البرج.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setDialog(null)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>

            {dialog.stats.subscribers > 0 && (
              <select
                id="tower-move-target"
                value={moveTarget}
                onChange={e => setMoveTarget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {registered.filter(r => r.name !== dialog.stats.name).map(r => (
                  <option key={r.name} value={r.name}>{r.name} ({r.subscribers} مشترك)</option>
                ))}
                <option value="">— {NO_TOWER_LABEL} —</option>
              </select>
            )}

            {dialog.mode === 'delete' && (
              <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                الوصولات السابقة تبقى محفوظة باسم هذا البرج في التقارير.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer">
                إلغاء
              </button>
              <button type="button" onClick={confirmDialog}
                className={`px-5 py-2 rounded-lg text-white text-xs font-bold cursor-pointer ${dialog.mode === 'delete' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
                {dialog.mode === 'delete' ? 'حذف البرج' : 'نقل المشتركين'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
