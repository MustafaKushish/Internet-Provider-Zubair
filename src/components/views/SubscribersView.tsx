import React, { useState, useMemo, useEffect } from 'react';
import { copyText } from '../ui/Dialogs';
import { NO_TOWER_LABEL, normTower } from '../../utils/towers';
import { matchesSubscriber } from '../../utils/search';
import { debtInMonths, formatMonthsAr, monthsLate } from '../../utils/debt';
import { Subscriber, SystemSettings, StaffUser } from '../../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt, getAmountDue } from '../../utils/storage';
import {
  Search,
  Filter,
  RefreshCw,
  MessageSquare,
  Printer,
  Edit,
  Trash2,
  Wrench,
  Key,
  Copy,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  History,
  Send,
  TowerControl,
  Server,
  MoreHorizontal
} from 'lucide-react';

type SortKey = 'name' | 'expiry' | 'debt' | 'newest';
const PAGE_SIZE = 25;

interface SubscribersViewProps {
  subscribers: Subscriber[];
  settings: SystemSettings;
  providers: { id: string; name: string }[];
  towers: string[];
  currentUser?: StaffUser;
  /** طلب فتح القائمة مفلترة على برج (من تبويب الأبراج) */
  towerFilterRequest?: { name: string; nonce: number } | null;
  /** تغيير برج مشترك أو عدة مشتركين */
  onAssignTower?: (subscriberIds: string[], towerName: string) => void;
  /** يُستدعى بعد تطبيق طلب الفلترة حتى لا يُطبَّق مرة أخرى عند العودة للتبويب */
  onTowerFilterApplied?: () => void;
  /** فتح نافذة إدارة الدين */
  onOpenDebt?: (sub: Subscriber) => void;
  onRenew: (sub: Subscriber) => void;
  onSendWhatsApp: (sub: Subscriber, defaultTab?: any) => void;
  onPrintReceipt: (sub: Subscriber) => void;
  onEdit: (sub: Subscriber) => void;
  onDelete: (id: string) => void;
  onAddTicketForSubscriber: (sub: Subscriber) => void;
  onViewPaymentHistory: (sub: Subscriber) => void;
  onBatchReminderForOverdue: () => void;
  onOpenAddModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenManageProviders?: () => void;
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({
  subscribers,
  settings,
  providers,
  towers,
  currentUser,
  towerFilterRequest,
  onAssignTower,
  onTowerFilterApplied,
  onOpenDebt,
  onRenew,
  onSendWhatsApp,
  onPrintReceipt,
  onEdit,
  onDelete,
  onAddTicketForSubscriber,
  onViewPaymentHistory,
  onBatchReminderForOverdue,
  onOpenAddModal,
  onOpenImportModal,
  onOpenManageProviders,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [towerFilter, setTowerFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);   // الهاتف: الفلاتر الإضافية مطوية
  const [moreActionsFor, setMoreActionsFor] = useState<string | null>(null);
  const [bulkTower, setBulkTower] = useState('');

  // فتح القائمة على برج محدد عند الطلب من تبويب الأبراج
  useEffect(() => {
    if (!towerFilterRequest) return;
    setTowerFilter(towerFilterRequest.name === NO_TOWER_LABEL ? '__none__' : towerFilterRequest.name);
    setStatusFilter('all');
    setPaymentFilter('all');
    setProviderFilter('all');
    setSearch('');
    onTowerFilterApplied?.();
  }, [towerFilterRequest?.nonce]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    void copyText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((sub) => {
      // Search
      const matchesSearch = matchesSubscriber(sub, search);

      // Status
      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;

      // Payment
      const matchesPayment = paymentFilter === 'all' || sub.paymentStatus === paymentFilter;

      // Provider
      const matchesProvider = providerFilter === 'all' || sub.upstreamProvider === providerFilter;

      // Tower
      const subTower = normTower(sub.towerName);
      const matchesTower = towerFilter === 'all' || (towerFilter === '__none__' ? !subTower : subTower === towerFilter);

      return matchesSearch && matchesStatus && matchesPayment && matchesProvider && matchesTower;
    });
  }, [subscribers, search, statusFilter, paymentFilter, providerFilter, towerFilter]);

  const sortedSubscribers = useMemo(() => {
    const list = [...filteredSubscribers];
    switch (sortBy) {
      case 'expiry': return list.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
      case 'debt': return list.sort((a, b) => getRemainingDebt(b) - getRemainingDebt(a));
      case 'newest': return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      default: return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }
  }, [filteredSubscribers, sortBy]);

  // الرجوع للصفحة الأولى عند تغيير البحث أو الفلاتر أو الترتيب
  useEffect(() => { setPage(0); }, [search, statusFilter, paymentFilter, providerFilter, towerFilter, sortBy, pageSize]);
  const pageCount = Math.max(1, Math.ceil(sortedSubscribers.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = sortedSubscribers.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const overdueCount = subscribers.filter(s => s.paymentStatus === 'overdue' || s.status === 'expired').length;

  // أزرار العمليات حسب الصلاحية؛ في الهاتف أزرار أكبر مع نص للعمليات الأساسية
  const renderActions = (sub: Subscriber, days: number, remainingDebt: number, mobile: boolean) => {
    const pad = mobile ? 'h-9 px-3' : 'p-1.5';
    const ic = mobile ? 'w-4 h-4' : 'w-3.5 h-3.5';
    const label = (t: string) => (mobile ? <span className="text-[11px] font-bold">{t}</span> : null);
    const ghost = `bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white ${pad} rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1`;
    if (currentUser?.role === 'technician') {
      return (
        <>
          <button onClick={() => onSendWhatsApp(sub, 'expiry')} title="مراسلة المشترك عبر الواتساب"
            className={`bg-emerald-600 hover:bg-emerald-500 text-white ${pad} rounded-lg transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1`}>
            <MessageSquare className={ic} />{label('واتساب')}
          </button>
          <button onClick={() => onAddTicketForSubscriber(sub)} title="تسجيل بلاغ صيانة وعطل لهذا المشترك" className={`${ghost} text-amber-300`}>
            <AlertCircle className={ic} />{label('بلاغ')}
          </button>
          <button onClick={() => onEdit(sub)} title="تعديل البيانات الفنية، البرج، الآي بي والماك" className={`${ghost} text-cyan-300`}>
            <Wrench className={ic} />{mobile ? label('تعديل فني') : <span className="text-[10px] hidden xl:inline">تعديل فني</span>}
          </button>
        </>
      );
    }
    const showAll = !mobile || moreActionsFor === sub.id;
    return (
      <>
        <button onClick={() => onRenew(sub)} title="تجديد الاشتراك فوراً"
          className={`bg-cyan-600 hover:bg-cyan-500 text-white ${pad} rounded-lg transition shadow-md shadow-cyan-600/20 cursor-pointer flex items-center gap-1`}>
          <RefreshCw className={ic} />{label('تجديد')}
        </button>
        <button onClick={() => onSendWhatsApp(sub, remainingDebt > 0 ? 'debt' : days <= 0 ? 'expired' : 'expiry')} title="إرسال تذكير أو إشعار واتساب"
          className={`bg-emerald-600 hover:bg-emerald-500 text-white ${pad} rounded-lg transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1`}>
          <MessageSquare className={ic} />{label('واتساب')}
        </button>
        <button onClick={() => onViewPaymentHistory(sub)} title="عرض سجل المدفوعات والوصولات السابقة"
          className={`bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white ${pad} rounded-lg border border-indigo-500/40 transition cursor-pointer flex items-center gap-1`}>
          <History className={ic} />
        </button>
        <button onClick={() => onEdit(sub)} title="تعديل بيانات المشترك والاشتراك" className={ghost}>
          <Edit className={ic} />
        </button>
        {!showAll && (
          <button onClick={() => setMoreActionsFor(sub.id)} title="المزيد من العمليات" aria-label="المزيد من العمليات" className={ghost}>
            <MoreHorizontal className={ic} />
          </button>
        )}
        {showAll && (
          <button onClick={() => onPrintReceipt(sub)} title="طباعة وصل قبض" className={ghost}>
            <Printer className={ic} />{label('وصل')}
          </button>
        )}
        {showAll && (
          <button onClick={() => onAddTicketForSubscriber(sub)} title="تسجيل بلاغ عطل لهذا المشترك" className={`${ghost} hover:text-amber-300`}>
            <Wrench className={ic} />{label('بلاغ')}
          </button>
        )}
        {showAll && currentUser?.role === 'admin' && (
          <button onClick={() => onDelete(sub.id)} title="حذف المشترك (صلاحية المدير فقط)" className={`${ghost} hover:bg-rose-900/60 hover:text-rose-300 text-slate-400`}>
            <Trash2 className={ic} />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، رقم الهاتف، اسم المستخدم (PPPoE)، أو الآي بي..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              الكل ({subscribers.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-750'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>نشط ({subscribers.filter(s => s.status === 'active').length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('expiring_soon')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'expiring_soon'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-amber-400 hover:bg-slate-750'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ينتهي قريباً ({subscribers.filter(s => s.status === 'expiring_soon').length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'expired'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-rose-400 hover:bg-slate-750'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>منتهي ({subscribers.filter(s => s.status === 'expired').length})</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          className="md:hidden w-full flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer"
        >
          <span className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> الفلاتر والترتيب
            {(paymentFilter !== 'all' || providerFilter !== 'all' || towerFilter !== 'all' || sortBy !== 'name') && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
          </span>
          <span className="text-slate-500">{filtersOpen ? 'إخفاء' : 'إظهار'}</span>
        </button>

        {/* Second Row of Filters */}
        <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs`}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Payment status filter (Paid, Pending, Overdue) */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400">حالة الدفع:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold"
              >
                <option value="all">كافة الحالات</option>
                <option value="paid">مسدد بالكامل (Paid)</option>
                <option value="pending">قيد الدفع / جزئي (Pending)</option>
                <option value="overdue">متأخر ومستحق (Overdue)</option>
              </select>
            </div>

            {/* Provider filter */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400">المزود:</span>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">كافة المزودين</option>
                {providers.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              {currentUser?.role !== 'technician' && onOpenManageProviders && (
                <button
                  type="button"
                  onClick={onOpenManageProviders}
                  title="إدارة وتعديل وتسمية المزودين وباقاتهم في الزبير"
                  className="bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/70 px-2 py-1 rounded-lg flex items-center gap-1 transition text-[11px] font-semibold cursor-pointer"
                >
                  <Server className="w-3 h-3 text-indigo-400" />
                  <span>تعديل المزودين</span>
                </button>
              )}
            </div>

            {/* Tower filter */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400">البرج / النقطة:</span>
              <select
                value={towerFilter}
                onChange={(e) => setTowerFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">كافة الأبراج</option>
                <option value="__none__">— {NO_TOWER_LABEL} ({subscribers.filter(s => !normTower(s.towerName)).length}) —</option>
                {towers.map((t, idx) => (
                  <option key={idx} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400">الترتيب:</span>
              <select
                id="subscribers-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="name">الاسم (أ - ي)</option>
                <option value="expiry">الأقرب انتهاءً / الأكثر تأخراً</option>
                <option value="debt">الأكبر ديناً</option>
                <option value="newest">الأحدث إضافة</option>
              </select>
            </div>

            {(statusFilter !== 'all' || paymentFilter !== 'all' || providerFilter !== 'all' || towerFilter !== 'all' || search) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setPaymentFilter('all');
                  setProviderFilter('all');
                  setTowerFilter('all');
                  setSearch('');
                }}
                className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold cursor-pointer"
              >
                إعادة ضبط
              </button>
            )}
          </div>

          {/* Quick Overdue Reminder Action Button */}
          {overdueCount > 0 && (
            <button
              onClick={onBatchReminderForOverdue}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition cursor-pointer"
              title="تنبيه لكافة الحسابات المتأخرة"
            >
              <Send className="w-3.5 h-3.5" />
              <span>تذكيرات الحسابات المتأخرة ({overdueCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk tower assignment for selected subscribers */}
      {onAssignTower && selected.size > 0 && (
        <div className="sticky top-2 z-20 bg-cyan-950/95 border border-cyan-800 rounded-2xl px-4 py-3 shadow-xl flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-cyan-200">تم تحديد {selected.size} مشترك</span>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="bulk-tower" className="text-cyan-300">نقل إلى البرج:</label>
            <input
              id="bulk-tower"
              list="bulk-towers-list"
              value={bulkTower}
              onChange={(e) => setBulkTower(e.target.value)}
              placeholder="اختر أو اكتب اسم برج جديد"
              className="bg-slate-950 border border-cyan-800 rounded-lg px-2.5 py-1.5 text-white w-56 focus:outline-none focus:border-cyan-400"
            />
            <datalist id="bulk-towers-list">
              {towers.map(t => <option key={t} value={t} />)}
            </datalist>
            <button
              type="button"
              onClick={() => {
                onAssignTower([...selected], bulkTower);
                setSelected(new Set());
                setBulkTower('');
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
            >
              {normTower(bulkTower) ? 'نقل' : `نقل إلى «${NO_TOWER_LABEL}»`}
            </button>
          </div>
          <button type="button" onClick={() => setSelected(new Set())} className="text-cyan-300 hover:text-white underline cursor-pointer mr-auto">
            إلغاء التحديد
          </button>
        </div>
      )}

      {/* الهاتف: بطاقات بدل الجدول العريض */}
      <div className="md:hidden space-y-2.5">
        {pageItems.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-sm space-y-3">
            <p>{subscribers.length === 0 ? 'لا يوجد مشتركون بعد.' : 'لا يوجد مشتركون مطابقون للبحث.'}</p>
            {subscribers.length === 0 && onOpenAddModal && (
              <button onClick={onOpenAddModal} className="px-4 py-2 bg-cyan-600 text-white text-xs font-bold rounded-xl cursor-pointer">+ إضافة أول مشترك</button>
            )}
          </div>
        ) : pageItems.map(sub => {
          const days = getDaysRemaining(sub.expiryDate);
          const remainingDebt = getRemainingDebt(sub);
          return (
            <div key={sub.id} className={`bg-slate-900 border rounded-2xl p-3.5 shadow-lg ${selected.has(sub.id) ? 'border-cyan-700' : 'border-slate-800'}`}>
              <div className="flex items-start gap-2">
                {onAssignTower && (
                  <input
                    type="checkbox"
                    aria-label={`تحديد ${sub.name}`}
                    checked={selected.has(sub.id)}
                    onChange={(e) => setSelected(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(sub.id); else next.delete(sub.id);
                      return next;
                    })}
                    className="mt-1 accent-cyan-500"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm truncate">{sub.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {sub.phone && <a href={`tel:${sub.phone}`} className="font-mono text-cyan-300" dir="ltr">{sub.phone}</a>}
                        <span className="flex items-center gap-1"><TowerControl className="w-3 h-3" />{normTower(sub.towerName) || NO_TOWER_LABEL}</span>
                      </div>
                    </div>
                    <ExpiryChip days={days} expiryDate={sub.expiryDate} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-slate-300">{sub.planName}</span>
                    <button type="button" onClick={() => copyToClipboard(sub.username, `user_${sub.id}`)} className="font-mono text-indigo-300 flex items-center gap-1 cursor-pointer" dir="ltr">
                      {sub.username}
                      {copiedId === `user_${sub.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    </button>
                    {currentUser?.role !== 'technician' && (
                      remainingDebt > 0 ? (
                        <button type="button" onClick={() => onOpenDebt?.(sub)} className="text-rose-400 font-bold cursor-pointer">
                          دين {formatCurrency(remainingDebt, settings.currency)}{sub.salePrice > 0 && ` (×${debtInMonths(sub)})`}
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-semibold">خالص • {formatCurrency(sub.salePrice, settings.currency)}</span>
                      )
                    )}
                    {currentUser?.role === 'technician' && sub.ipAddress && <span className="font-mono text-cyan-300" dir="ltr">{sub.ipAddress}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center gap-1.5">
                {renderActions(sub, days, remainingDebt, true)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscribers Table Card */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/90 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                {onAssignTower && (
                  <th className="py-3 pr-4 pl-1 w-8">
                    <input
                      type="checkbox"
                      aria-label="تحديد كل المشتركين المطابقين للفلتر"
                      checked={sortedSubscribers.length > 0 && sortedSubscribers.every(s => selected.has(s.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(sortedSubscribers.map(s => s.id)) : new Set())}
                      className="rounded bg-slate-900 border-slate-600 accent-cyan-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-3 px-4">المشترك والاتصال</th>
                <th className="py-3 px-3">اليوزر والباسورد (SAS)</th>
                <th className="py-3 px-3">المزود والباقة</th>
                {currentUser?.role === 'technician' ? (
                  <>
                    <th className="py-3 px-3">البرج والموقع</th>
                    <th className="py-3 px-3">الآي بي والماك (IP/MAC)</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3">الرسوم والربح الصافي</th>
                    <th className="py-3 px-3">حالة الدفع</th>
                  </>
                )}
                <th className="py-3 px-3">الصلاحية والانتهاء</th>
                <th className="py-3 px-4 text-center">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={onAssignTower ? 8 : 7} className="py-14 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">
                          {subscribers.length === 0
                            ? 'تم مسح البيانات التجريبية - المنظومة فارغة وجاهزة للعمل'
                            : 'لا يوجد مشتركون مطابقون لمعايير البحث الحالية'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {subscribers.length === 0
                            ? 'يمكنك الآن تسجيل المشتركين الحقيقيين لشبكة أولاد كشيش يدوياً أو استيراد ملف الإكسل القديم مباشرة.'
                            : 'جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر بالأعلى.'}
                        </p>
                      </div>

                      {subscribers.length === 0 && (onOpenAddModal || onOpenImportModal) && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                          {onOpenAddModal && (
                            <button
                              onClick={onOpenAddModal}
                              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/30 transition cursor-pointer"
                            >
                              + إضافة أول مشترك
                            </button>
                          )}
                          {onOpenImportModal && (
                            <button
                              onClick={onOpenImportModal}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                            >
                              استيراد من إكسل (XLSX / CSV)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((sub) => {
                  const days = getDaysRemaining(sub.expiryDate);
                  const netProfit = sub.salePrice - sub.costPrice;
                  const remainingDebt = getRemainingDebt(sub);

                  return (
                    <tr key={sub.id} className={`hover:bg-slate-800/50 transition ${selected.has(sub.id) ? 'bg-cyan-950/30' : ''}`}>
                      {onAssignTower && (
                        <td className="py-3 pr-4 pl-1 align-top">
                          <input
                            type="checkbox"
                            aria-label={`تحديد ${sub.name}`}
                            checked={selected.has(sub.id)}
                            onChange={(e) => setSelected(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(sub.id); else next.delete(sub.id);
                              return next;
                            })}
                            className="rounded bg-slate-900 border-slate-600 accent-cyan-500 cursor-pointer mt-1"
                          />
                        </td>
                      )}
                      {/* Name & Phone & Tower */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">{sub.name}</div>
                        <div className="flex items-center gap-1.5 text-slate-400 mt-0.5" dir="ltr">
                          {sub.phone ? <a href={`tel:${sub.phone}`} className="font-mono text-[11px] text-left hover:text-cyan-300">{sub.phone}</a> : <span className="text-[11px] text-amber-400/80">بدون رقم</span>}
                        </div>
                        <div className="text-[11px] mt-1 flex items-center gap-1">
                          <TowerControl className={`w-3 h-3 flex-shrink-0 ${normTower(sub.towerName) ? 'text-cyan-400' : 'text-amber-400'}`} />
                          {onAssignTower ? (
                            <select
                              aria-label={`برج ${sub.name}`}
                              value={normTower(sub.towerName)}
                              onChange={(e) => onAssignTower([sub.id], e.target.value)}
                              className={`bg-transparent border border-transparent hover:border-slate-700 focus:border-cyan-500 rounded px-1 py-0.5 max-w-[190px] focus:outline-none cursor-pointer ${normTower(sub.towerName) ? 'text-cyan-300' : 'text-amber-300'}`}
                            >
                              <option value="" className="bg-slate-900">— {NO_TOWER_LABEL} —</option>
                              {towers.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                            </select>
                          ) : (
                            <span className={normTower(sub.towerName) ? 'text-cyan-400/90' : 'text-amber-300'}>{normTower(sub.towerName) || NO_TOWER_LABEL}</span>
                          )}
                        </div>
                      </td>

                      {/* Username & Password */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-300 text-xs bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60" dir="ltr">
                            {sub.username}
                          </span>
                          <button
                            onClick={() => copyToClipboard(sub.username, `user_${sub.id}`)}
                            title="نسخ اليوزر"
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {copiedId === `user_${sub.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {sub.password && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="font-mono text-[11px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800" dir="ltr">
                              {visiblePasswords[sub.id] ? sub.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePassword(sub.id)}
                              className="text-slate-500 hover:text-slate-300 cursor-pointer"
                              title="إظهار/إخفاء كلمة المرور"
                            >
                              {visiblePasswords[sub.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(sub.password || '', `pass_${sub.id}`)}
                              title="نسخ كلمة المرور"
                              className="text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                              {copiedId === `pass_${sub.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Provider & Plan */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{sub.planName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{sub.upstreamProvider}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          كلفة المزود: {formatCurrency(sub.costPrice, settings.currency)}
                        </div>
                      </td>

                      {/* Columns 4 & 5: Conditional on Role (Technical vs Financial) */}
                      {currentUser?.role === 'technician' ? (
                        <>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white flex items-center gap-1">
                              <TowerControl className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{normTower(sub.towerName) || NO_TOWER_LABEL}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                              {sub.address || 'الزبير'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-mono text-xs text-cyan-300 font-semibold" dir="ltr">
                              {sub.ipAddress || '192.168.1.X'}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5" dir="ltr">
                              {sub.macAddress || '-'}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Sale Price & Profit */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-cyan-300 text-xs">
                              {formatCurrency(sub.salePrice, settings.currency)}
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                              الربح: +{formatCurrency(netProfit, settings.currency)}
                            </div>
                          </td>

                          {/* Payment Status (Paid, Pending, Overdue) */}
                          <td className="py-3 px-3">
                            {sub.paymentStatus === 'paid' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/60 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>مدفوع (خالص)</span>
                              </span>
                            ) : sub.paymentStatus === 'pending' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800/60 font-semibold text-[11px]">
                                  <span>قيد الدفع (جزئي)</span>
                                </span>
                                <button type="button" onClick={() => onOpenDebt?.(sub)} title="إدارة الدين"
                                  className="block text-right text-[11px] text-rose-400 font-bold mt-1 hover:underline cursor-pointer">
                                  متبقي: {formatCurrency(remainingDebt, settings.currency)}
                                  {sub.salePrice > 0 && <span className="block font-normal text-rose-300/80">×{debtInMonths(sub)} {sub.planName}</span>}
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-rose-950/70 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800/70 font-semibold text-[11px]">
                                  <XCircle className="w-3 h-3" />
                                  <span>متأخر (Overdue)</span>
                                </span>
                                <button type="button" onClick={() => onOpenDebt?.(sub)} title="إدارة الدين"
                                  className="block text-right text-[11px] text-rose-400 font-bold mt-1 hover:underline cursor-pointer">
                                  الدين: {formatCurrency(remainingDebt, settings.currency)}
                                  {sub.salePrice > 0 && <span className="block font-normal text-rose-300/80">×{debtInMonths(sub)} {sub.planName}</span>}
                                </button>
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {/* Expiry & Days Remaining */}
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs text-slate-300" dir="ltr">{sub.expiryDate}</div>
                        <div className="mt-1">
                          {days > 3 ? (
                            <span className="text-emerald-400 text-[11px] font-semibold">
                              متبقي {days} يوم
                            </span>
                          ) : days >= 0 ? (
                            <span className="bg-amber-950/70 text-amber-300 px-2 py-0.5 rounded font-bold text-[11px] border border-amber-800 inline-block animate-pulse">
                              {days === 0 ? 'ينتهي اليوم!' : `متبقي ${days} يوم فقط`}
                            </span>
                          ) : (
                            <span className="bg-rose-950/70 text-rose-300 px-2 py-0.5 rounded font-bold text-[11px] border border-rose-800 inline-block">
                              متأخر {formatMonthsAr(monthsLate(sub.expiryDate))}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Operations & Actions based on Authority */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {renderActions(sub, days, remainingDebt, false)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sortedSubscribers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            عرض {safePage * pageSize + 1}–{Math.min(sortedSubscribers.length, (safePage + 1) * pageSize)} من {sortedSubscribers.length}
            {sortedSubscribers.length !== subscribers.length && ` (من أصل ${subscribers.length})`}
          </span>
          <div className="flex items-center gap-1.5">
            <select
              aria-label="عدد المشتركين في الصفحة"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
            >
              <option value={25}>25 بالصفحة</option>
              <option value={50}>50 بالصفحة</option>
              <option value={100}>100 بالصفحة</option>
              <option value={100000}>الكل</option>
            </select>
            {pageCount > 1 && (
              <>
                <button type="button" disabled={safePage === 0} onClick={() => { setPage(safePage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer">السابق</button>
                <span className="px-1 font-semibold text-slate-300">{safePage + 1} / {pageCount}</span>
                <button type="button" disabled={safePage >= pageCount - 1} onClick={() => { setPage(safePage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer">التالي</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** شارة الصلاحية: الأيام المتبقية أو أشهر التأخير */
const ExpiryChip: React.FC<{ days: number; expiryDate: string }> = ({ days, expiryDate }) => {
  if (days > 3) return <span className="flex-shrink-0 text-[10px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">متبقي {days} يوم</span>;
  if (days >= 0) return <span className="flex-shrink-0 text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-full">{days === 0 ? 'ينتهي اليوم' : `متبقي ${days} يوم`}</span>;
  return <span className="flex-shrink-0 text-[10px] font-bold text-rose-300 bg-rose-950/70 border border-rose-800 px-2 py-0.5 rounded-full">متأخر {formatMonthsAr(monthsLate(expiryDate))}</span>;
};
