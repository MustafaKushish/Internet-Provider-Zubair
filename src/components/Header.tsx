import React, { useState, useEffect } from 'react';
import {
  Users,
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Server,
  Settings,
  Plus,
  Download,
  Upload,
  Wifi,
  BellRing,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Bell,
  BellOff,
  UserCheck,
  ShieldCheck,
  Lock,
  LogOut,
  TowerControl,
  MonitorDown,
  Sparkles,
  Share,
  MoreHorizontal,
  Search,
  X as CloseIcon,
} from 'lucide-react';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import { StaffUser } from '../types/isp';
import { canPromptInstall, isStandalone, onInstallAvailabilityChange, requestInstall } from '../pwa';
import { notify } from './ui/Dialogs';
import { useEscapeKey } from './ui/useEscapeKey';

type Role = StaffUser['role'];
const ALL: Role[] = ['admin', 'accountant', 'technician'];
const OFFICE: Role[] = ['admin', 'accountant'];

interface TabDef {
  id: string;
  label: string;   // الاسم الكامل (الحاسوب)
  short: string;   // اسم قصير لشريط الهاتف السفلي
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  accent?: 'indigo';
}

// ترتيب الأقسام؛ الصلاحيات نفسها تُفرض أيضاً في App (TAB_ACCESS) وعلى الخادم
const TABS: TabDef[] = [
  { id: 'subscribers', label: 'المشتركين والاشتراكات', short: 'المشتركون', icon: Users, roles: ALL },
  { id: 'dashboard', label: 'لوحة المؤشرات', short: 'المؤشرات', icon: LayoutDashboard, roles: OFFICE },
  { id: 'reports', label: 'التقارير المالية والجرد الدوري', short: 'التقارير', icon: BarChart3, roles: OFFICE },
  { id: 'reminders', label: 'تذكيرات الواتساب والديون', short: 'التذكيرات', icon: MessageSquare, roles: ALL },
  { id: 'tickets', label: 'البلاغات والدعم الفني', short: 'البلاغات', icon: Wrench, roles: ALL },
  { id: 'advisor', label: 'المستشار الذكي', short: 'المستشار', icon: Sparkles, roles: OFFICE, accent: 'indigo' },
  { id: 'towers', label: 'الأبراج', short: 'الأبراج', icon: TowerControl, roles: ALL },
  { id: 'providers', label: 'المزودون وباقات الزبير', short: 'المزودون', icon: Server, roles: OFFICE },
  { id: 'users', label: 'المستخدمون والمشرفون', short: 'المستخدمون', icon: ShieldCheck, roles: ['admin'], accent: 'indigo' },
  { id: 'settings', label: 'إعدادات المنظومة', short: 'الإعدادات', icon: Settings, roles: ['admin'] },
];

// الأقسام الظاهرة مباشرة في شريط الهاتف السفلي (الباقي في «المزيد»)
const MOBILE_PRIMARY = ['subscribers', 'reminders', 'dashboard', 'tickets', 'towers'];

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: {
    totalSubscribers: number;
    activeCount: number;
    expiringSoonCount: number;
    expiredCount: number;
    totalProfit: number;
    totalDebts: number;
    openTicketsCount: number;
  };
  ispName: string;
  contactPhone: string;
  currentUser: StaffUser;
  onOpenAddModal: () => void;
  onExportExcel: () => void;
  onOpenImportModal: () => void;
  onTriggerNotificationCheck: () => void;
  onOpenLoginModal: () => void;
  onOpenSearch: () => void;
  onLogout: () => void;
  onOpenAddUser?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  ispName,
  contactPhone,
  currentUser,
  onOpenAddModal,
  onExportExcel,
  onOpenImportModal,
  onTriggerNotificationCheck,
  onOpenLoginModal,
  onOpenSearch,
  onLogout,
  onOpenAddUser,
}) => {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  // زر التثبيت يظهر ما دامت المنظومة مفتوحة في المتصفح وليس كتطبيق مثبت
  const [showInstall, setShowInstall] = useState(() => !isStandalone());
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleTabs = TABS.filter(t => t.roles.includes(currentUser.role));
  const primaryTabs = visibleTabs.filter(t => MOBILE_PRIMARY.includes(t.id)).slice(0, 4);
  const moreTabs = visibleTabs.filter(t => !primaryTabs.includes(t));
  const alertsCount = stats.expiringSoonCount + stats.expiredCount;
  const badgeFor = (id: string): React.ReactNode => {
    if (id === 'subscribers') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">{stats.totalSubscribers}</span>;
    if (id === 'tickets' && stats.openTicketsCount > 0) return <span className="text-xs px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">{stats.openTicketsCount}</span>;
    if (id === 'reminders' && alertsCount > 0) return <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-2 right-2"></span>;
    return null;
  };
  const go = (id: string) => {
    setActiveTab(id);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  useEffect(() => onInstallAvailabilityChange(() => setShowInstall(!isStandalone())), []);

  const handleInstall = async () => {
    const result = await requestInstall();
    if (result === 'installed') {
      setShowInstall(false);
      notify('تم تثبيت التطبيق. ستجده في قائمة التطبيقات وعلى الشاشة الرئيسية.', 'success');
    } else if (result === 'ios') {
      setIosHelpOpen(true);
    } else if (result === 'manual') {
      notify(canPromptInstall()
        ? 'اضغط زر التثبيت مرة أخرى.'
        : 'للتثبيت: افتح قائمة المتصفح (⋮ أو …) واختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية". في ويندوز استخدم Edge أو Chrome.', 'info');
    }
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleNotificationClick = async () => {
    if (notifPermission !== 'granted') {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted ? 'granted' : 'denied');
      if (granted) {
        onTriggerNotificationCheck();
      }
    } else {
      onTriggerNotificationCheck();
    }
  };

  return (
    <>
    <header className="bg-slate-900 border-b border-slate-800 md:sticky md:top-0 z-30 shadow-xl backdrop-blur-md bg-opacity-95 no-print">
      {/* الهاتف: شريط علوي مضغوط */}
      <div className="md:hidden px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white truncate">{ispName}</h1>
            <p className="text-[10px] text-slate-400 truncate">{currentUser.name} • {currentUser.role === 'admin' ? 'المدير' : currentUser.role === 'accountant' ? 'محاسب' : 'فني'}</p>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="بحث سريع عن مشترك"
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenAddModal}
            aria-label="إضافة مشترك"
            className="h-9 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> <span>مشترك</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="تسجيل الخروج"
            className="w-9 h-9 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 pb-0.5">
          <span className="flex-shrink-0 bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1 text-[11px] text-slate-300">
            نشط <b className="text-white">{stats.activeCount}</b> من {stats.totalSubscribers}
          </span>
          {currentUser.role !== 'technician' && (
            <span className="flex-shrink-0 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-2.5 py-1 text-[11px] text-emerald-300">
              ربح شهري <b className="text-emerald-400">{stats.totalProfit.toLocaleString()}</b>
            </span>
          )}
          {currentUser.role !== 'technician' && stats.totalDebts > 0 && (
            <button type="button" onClick={() => go('reminders')} className="flex-shrink-0 bg-rose-950/40 border border-rose-800/40 rounded-lg px-2.5 py-1 text-[11px] text-rose-300 cursor-pointer">
              ديون <b className="text-rose-400">{stats.totalDebts.toLocaleString()}</b>
            </button>
          )}
          {alertsCount > 0 && (
            <button type="button" onClick={() => go('reminders')} className="flex-shrink-0 bg-amber-950/50 border border-amber-700/50 rounded-lg px-2.5 py-1 text-[11px] text-amber-300 cursor-pointer">
              {stats.expiringSoonCount} قريباً • {stats.expiredCount} متأخر
            </button>
          )}
          {stats.openTicketsCount > 0 && (
            <button type="button" onClick={() => go('tickets')} className="flex-shrink-0 bg-amber-950/50 border border-amber-700/50 rounded-lg px-2.5 py-1 text-[11px] text-amber-300 cursor-pointer">
              {stats.openTicketsCount} عطل مفتوح
            </button>
          )}
        </div>
      </div>

      {/* Top Banner */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white ring-2 ring-cyan-400/30">
              <Wifi className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">{ispName}</h1>
                <span className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-semibold">
                  البصرة - الزبير
                </span>
              </div>
              <p className="text-xs text-slate-400">
                إدارة المشتركين والأبراج{contactPhone ? <> • هاتف وواتساب: <span className="text-cyan-400 font-mono font-semibold" dir="ltr">{contactPhone}</span></> : null}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar & User Account Profile */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Logged-in Staff User Pill */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenLoginModal}
                title="اضغط لتبديل المستخدم أو فحص الجلسة"
                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2.5 py-1.5 flex items-center gap-2 transition cursor-pointer text-right"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-xs font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-white max-w-[120px] truncate">{currentUser.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      currentUser.role === 'admin'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : currentUser.role === 'accountant'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {currentUser.role === 'admin' ? 'المدير' : currentUser.role === 'accountant' ? 'محاسب' : 'فني'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block font-mono" dir="ltr">@{currentUser.username}</span>
                </div>
              </button>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                title="تسجيل الخروج وقفل المنظومة (أمان) • يتم القفل تلقائياً بعد 60 دقيقة من الخمول"
                className="bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-rose-950/40"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>

            {/* Active Subscribers Pill */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">المشتركون النشطون</span>
                <span className="font-bold text-white">{stats.activeCount} من {stats.totalSubscribers}</span>
              </div>
            </div>

            {/* Financial Metrics - Visible ONLY for Admin and Accountant */}
            {currentUser.role !== 'technician' && (
              <>
                <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <div className="text-xs">
                    <span className="text-emerald-300 block text-[10px]">صافي الربح الشهري</span>
                    <span className="font-bold text-emerald-400">{stats.totalProfit.toLocaleString()} د.ع</span>
                  </div>
                </div>

                {stats.totalDebts > 0 && (
                  <div className="bg-rose-950/40 border border-rose-800/40 rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <div className="text-xs">
                      <span className="text-rose-300 block text-[10px]">المتأخرات والديون</span>
                      <span className="font-bold text-rose-400">{stats.totalDebts.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Open Tickets Pill for Technician */}
            {currentUser.role === 'technician' && stats.openTicketsCount > 0 && (
              <button
                onClick={() => setActiveTab('tickets')}
                className="bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2 transition cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                <div className="text-xs text-right">
                  <span className="text-amber-300 block text-[10px]">بلاغات الصيانة</span>
                  <span className="font-bold text-amber-400">{stats.openTicketsCount} عطل مفتوح</span>
                </div>
              </button>
            )}

            {currentUser.role !== 'technician' && stats.expiringSoonCount + stats.expiredCount > 0 && (
              <button
                onClick={() => setActiveTab('reminders')}
                className="bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2 transition cursor-pointer"
                title="اضغط للانتقال إلى تذكيرات الدفع والاشتراكات"
              >
                <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
                <div className="text-xs text-right">
                  <span className="text-amber-300 block text-[10px]">تنبيهات التجديد</span>
                  <span className="font-bold text-amber-400">
                    {stats.expiringSoonCount} قريباً • {stats.expiredCount} متأخر
                  </span>
                </div>
              </button>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 ms-auto md:ms-2">
              <button
                onClick={onOpenSearch}
                title="بحث سريع عن مشترك (Ctrl+K)"
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs px-2.5 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span className="hidden lg:inline">بحث</span>
                <kbd className="hidden lg:inline text-[9px] font-mono bg-slate-900 border border-slate-700 rounded px-1 text-slate-400">Ctrl K</kbd>
              </button>
              {/* Browser Notification Bell Toggle */}
              <button
                onClick={handleNotificationClick}
                title={
                  notifPermission === 'granted'
                    ? 'إشعارات المتصفح مفعلة (اضغط لفحص وتنبيه الاشتراكات القريبة)'
                    : 'اضغط لتفعيل إشعارات المتصفح للتنبيه قبل انتهاء الاشتراك'
                }
                className={`p-2 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-400 hover:bg-emerald-900/60'
                    : 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                }`}
              >
                {notifPermission === 'granted' ? (
                  <Bell className="w-4 h-4 text-emerald-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-amber-400" />
                )}
              </button>

              {showInstall && (
                <button
                  onClick={handleInstall}
                  title="تثبيت المنظومة كتطبيق على هذا الجهاز"
                  className="bg-slate-800 hover:bg-slate-700 border border-cyan-700 text-cyan-300 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <MonitorDown className="w-4 h-4" />
                  <span>تثبيت التطبيق</span>
                </button>
              )}

              <button
                onClick={onOpenAddModal}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مشترك</span>
              </button>

              <button
                onClick={onExportExcel}
                title="تصدير إلى إكسل XLSX"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenImportModal}
                title="استيراد من إكسل / CSV"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav aria-label="أقسام المنظومة" className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
          {visibleTabs.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            const activeCls = t.accent === 'indigo' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
            const idleCls = t.id === 'advisor' ? 'text-indigo-300/80 hover:text-indigo-200 hover:bg-slate-800/60' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer relative ${active ? activeCls : idleCls}`}
              >
                <Icon className={`w-4 h-4 ${t.id === 'users' ? 'text-indigo-400' : ''}`} />
                <span>{t.label}</span>
                {badgeFor(t.id)}
              </button>
            );
          })}
        </nav>
      </div>
      {iosHelpOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIosHelpOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl text-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">تثبيت التطبيق على آيفون / آيباد</h2>
              <button type="button" onClick={() => setIosHelpOpen(false)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2.5 text-slate-300 text-xs leading-relaxed list-decimal pr-4">
              <li>افتح المنظومة في متصفح <strong className="text-white">Safari</strong>.</li>
              <li>اضغط زر المشاركة <Share className="w-3.5 h-3.5 inline text-cyan-400" /> أسفل الشاشة.</li>
              <li>اختر <strong className="text-white">«إضافة إلى الشاشة الرئيسية»</strong> ثم <strong className="text-white">«إضافة»</strong>.</li>
              <li>افتح التطبيق من أيقونة <strong className="text-white">أولاد كشيش</strong> على الشاشة الرئيسية.</li>
            </ol>
          </div>
        </div>
      )}
    </header>

    {/* الهاتف: شريط تنقل سفلي ثابت */}
    <nav
      aria-label="التنقل السريع"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryTabs.length + (moreTabs.length ? 1 : 0)}, minmax(0, 1fr))` }}>
        {primaryTabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const count = t.id === 'tickets' ? stats.openTicketsCount : t.id === 'reminders' ? alertsCount : 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold cursor-pointer ${active ? 'text-cyan-400' : 'text-slate-400'}`}
            >
              {active && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-cyan-400" />}
              <span className="relative">
                <Icon className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -left-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] leading-4 text-center">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              <span>{t.short}</span>
            </button>
          );
        })}
        {moreTabs.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold cursor-pointer ${moreTabs.some(t => t.id === activeTab) ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>المزيد</span>
          </button>
        )}
      </div>
    </nav>

    {moreOpen && (
      <MoreSheet onClose={() => setMoreOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {moreTabs.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-[11px] font-semibold cursor-pointer ${active ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-slate-800/60 border-slate-700 text-slate-200'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-center leading-tight">{t.short}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <button type="button" onClick={() => { setMoreOpen(false); onOpenLoginModal(); }} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-200 cursor-pointer">
            <UserCheck className="w-4 h-4 text-indigo-300" /> تبديل المستخدم
          </button>
          <button type="button" onClick={() => { setMoreOpen(false); void handleNotificationClick(); }} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-200 cursor-pointer">
            {notifPermission === 'granted' ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-amber-400" />}
            {notifPermission === 'granted' ? 'فحص التنبيهات' : 'تفعيل الإشعارات'}
          </button>
          <button type="button" onClick={() => { setMoreOpen(false); onExportExcel(); }} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-200 cursor-pointer">
            <Download className="w-4 h-4 text-cyan-300" /> تصدير إكسل
          </button>
          <button type="button" onClick={() => { setMoreOpen(false); onOpenImportModal(); }} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-200 cursor-pointer">
            <Upload className="w-4 h-4 text-cyan-300" /> استيراد إكسل
          </button>
          {showInstall && (
            <button type="button" onClick={() => { setMoreOpen(false); void handleInstall(); }} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-cyan-700 px-3 py-2.5 text-cyan-300 font-bold cursor-pointer">
              <MonitorDown className="w-4 h-4" /> تثبيت التطبيق على هذا الجهاز
            </button>
          )}
        </div>
      </MoreSheet>
    )}
    </>
  );
};

/** لوحة «المزيد» تنزلق من أسفل الشاشة في الهاتف */
const MoreSheet: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEscapeKey(onClose);
  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end bg-slate-950/70 backdrop-blur-sm no-print" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="المزيد من الأقسام"
        className="w-full bg-slate-900 border-t border-slate-700 rounded-t-3xl p-4 shadow-2xl"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />
        {children}
      </div>
    </div>
  );
};
