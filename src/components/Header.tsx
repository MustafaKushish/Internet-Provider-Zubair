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
  X as CloseIcon,
} from 'lucide-react';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import { StaffUser } from '../types/isp';
import { canPromptInstall, isStandalone, onInstallAvailabilityChange, requestInstall } from '../pwa';
import { notify } from './ui/Dialogs';

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
  currentUser: StaffUser;
  onOpenAddModal: () => void;
  onExportExcel: () => void;
  onOpenImportModal: () => void;
  onTriggerNotificationCheck: () => void;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  onOpenAddUser?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  ispName,
  currentUser,
  onOpenAddModal,
  onExportExcel,
  onOpenImportModal,
  onTriggerNotificationCheck,
  onOpenLoginModal,
  onLogout,
  onOpenAddUser,
}) => {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  // زر التثبيت يظهر ما دامت المنظومة مفتوحة في المتصفح وليس كتطبيق مثبت
  const [showInstall, setShowInstall] = useState(() => !isStandalone());
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
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
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl backdrop-blur-md bg-opacity-95 no-print">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
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
                إدارة المشتركين والأبراج • هاتف وواتساب: <span className="text-cyan-400 font-mono font-semibold" dir="ltr">+964 771 979 7455</span>
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
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'subscribers'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>المشتركين والاشتراكات</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
              {stats.totalSubscribers}
            </span>
          </button>

          {/* Dashboard Tab - Hidden for Technician */}
          {currentUser.role !== 'technician' && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>لوحة المؤشرات</span>
            </button>
          )}

          {/* Financial Reports Tab - Hidden for Technician */}
          {currentUser.role !== 'technician' && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>التقارير المالية والجرد الدوري</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer relative ${
              activeTab === 'reminders'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>تذكيرات الواتساب والديون</span>
            {stats.expiringSoonCount + stats.expiredCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-2 right-2"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>البلاغات والدعم الفني</span>
            {stats.openTicketsCount > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                {stats.openTicketsCount}
              </span>
            )}
          </button>

          {/* AI Advisor Tab - admin & accountant */}
          {currentUser.role !== 'technician' && (
            <button
              onClick={() => setActiveTab('advisor')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'advisor'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-indigo-300/80 hover:text-indigo-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>المستشار الذكي</span>
            </button>
          )}

          {/* Towers Tab - visible to everyone (editing for admin/accountant) */}
          <button
            onClick={() => setActiveTab('towers')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'towers'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TowerControl className="w-4 h-4" />
            <span>الأبراج</span>
          </button>

          {/* Providers Tab - Hidden for Technician */}
          {currentUser.role !== 'technician' && (
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'providers'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>المزودون وباقات الزبير</span>
            </button>
          )}

          {/* Users & Staff Management Tab (Admin only) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>المستخدمون والمشرفون</span>
            </button>
          )}

          {/* Settings Tab (Admin only) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>إعدادات المنظومة</span>
            </button>
          )}
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
  );
};
