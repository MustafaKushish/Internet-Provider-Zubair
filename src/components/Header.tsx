import React from 'react';
import { LayoutGrid, LogOut, Plus, Search, Wifi, ChevronRight } from 'lucide-react';
import { LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';
import { StaffUser } from '../types/isp';
import { NotificationBell } from './NotificationBell';
import type { AlertGroup } from '../utils/alerts';
import { NAV_GROUPS, TAB_LABEL, firstTab, groupOf, tabsFor, visibleGroups, type NavGroup } from './nav';

export { TAB_ORDER } from './nav';

const loadMotionFeatures = () => import('./ui/motionFeatures').then(r => r.default);

// مؤشر القسم النشط ينزلق بين الأقسام بحركة نابضية
const PILL_SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

const ROLE_LABEL = { admin: 'المدير', accountant: 'محاسب', technician: 'فني' } as const;

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  /** عدد البلاغات المفتوحة (شارة على «المزيد») */
  openTickets: number;
  ispName: string;
  currentUser: StaffUser;
  onOpenAddModal: () => void;
  onOpenLoginModal: () => void;
  onOpenSearch: () => void;
  onLogout: () => void;
  notificationsOn: boolean;
  onBell: () => void;
  /** تنبيهات «الآن» في نافذة الجرس */
  alerts: AlertGroup[];
  /** الوضع البسيط: رأس صغير بدون أقسام */
  simpleMode?: boolean;
  onToggleSimpleMode?: () => void;
  /** بنود خطة التسويق التي تبدأ خلال أيام (شارة على «التسويق») */
  planAlerts?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  openTickets,
  ispName,
  currentUser,
  onOpenAddModal,
  onOpenLoginModal,
  onOpenSearch,
  onLogout,
  notificationsOn,
  onBell,
  alerts,
  simpleMode,
  onToggleSimpleMode,
  planAlerts = 0,
}) => {
  const groups = visibleGroups(currentUser.role);
  const activeGroup = groupOf(activeTab).id;
  const badge = (g: NavGroup) => (g.id === 'marketing' ? planAlerts : g.id === 'more' ? openTickets : 0);
  const go = (g: NavGroup) => {
    setActiveTab(firstTab(g, currentUser.role));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const bellBtn = (big = false) => (
    <NotificationBell alerts={alerts} onOpenTab={setActiveTab} deviceOn={notificationsOn} onEnableDevice={onBell} big={big} />
  );

  if (simpleMode) {
    return (
      <header className="relative bg-slate-900/80 lg:sticky lg:top-0 z-30 shadow-2xl shadow-black/30 backdrop-blur-xl no-print" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="gradient-line absolute bottom-0 inset-x-0" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <div className="logo-glow w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
            <Wifi className="w-6 h-6" />
          </div>
          <div className="min-w-[13rem] flex-1">
            <h1 className="text-lg font-semibold gradient-text">{ispName}</h1>
            <p className="text-sm text-slate-400 truncate">{currentUser.name}</p>
          </div>
          <div className="flex gap-2 ms-auto">
            {bellBtn(true)}
            <button type="button" onClick={onToggleSimpleMode} className="h-12 px-3 sm:px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-base font-semibold flex items-center gap-2 cursor-pointer hover:bg-slate-700">
              <LayoutGrid className="w-5 h-5 text-cyan-300" />
              كل الأقسام
            </button>
            <button type="button" onClick={onLogout} className="h-12 px-3 sm:px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-base font-semibold flex items-center gap-2 cursor-pointer hover:bg-slate-700">
              <LogOut className="w-5 h-5 text-rose-300" />
              خروج
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <MotionConfig reducedMotion="user">
    <header className="relative bg-slate-900/80 lg:sticky lg:top-0 z-30 shadow-2xl shadow-black/30 backdrop-blur-xl no-print" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="gradient-line absolute bottom-0 inset-x-0" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 sm:gap-3">
        <button type="button" onClick={() => go(NAV_GROUPS[0])} className="flex items-center gap-2.5 min-w-0 cursor-pointer text-right" aria-label="الرئيسية">
          <span className="logo-glow w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
            <Wifi className="w-5 h-5" />
          </span>
          <span className="min-w-0 hidden sm:block lg:max-w-[9rem] 2xl:max-w-[16rem]">
            <span className="block text-base font-bold gradient-text truncate">{ispName}</span>
          </span>
        </button>

        {/* الحاسوب: الأقسام الخمسة في الرأس */}
        <nav aria-label="أقسام المنظومة" className="hidden lg:flex items-center gap-1 ms-4">
          {groups.map(g => {
            const Icon = g.icon;
            const active = activeGroup === g.id;
            const n = badge(g);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => go(g)}
                aria-current={active ? 'page' : undefined}
                className={`relative h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${active ? 'text-cyan-200' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
              >
                {active && <m.span layoutId="desktop-nav-pill" transition={PILL_SPRING} className="absolute inset-0 rounded-xl bg-cyan-500/15 border border-cyan-500/35" aria-hidden="true" />}
                <Icon className="relative w-4 h-4" />
                <span className="relative">{g.label}</span>
                {n > 0 && <span className="relative text-xs min-w-5 px-1.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-500/40">{n}</span>}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="بحث سريع عن مشترك"
          title="بحث سريع (Ctrl+K)"
          className="h-11 min-w-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Search className="w-5 h-5" />
          <span className="hidden 2xl:inline text-sm">ابحث عن مشترك</span>
          <kbd className="hidden 2xl:inline text-[10px] font-mono bg-slate-950 border border-slate-700 rounded px-1 text-slate-400">Ctrl K</kbd>
        </button>
        {bellBtn()}
        <button
          type="button"
          onClick={onOpenAddModal}
          className="h-11 px-3 sm:px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          <span><span className="hidden sm:inline">أضف </span>مشتركاً</span>
        </button>
        <button
          type="button"
          onClick={onOpenLoginModal}
          title={`${currentUser.name} • ${ROLE_LABEL[currentUser.role]} (اضغط لتبديل المستخدم)`}
          aria-label={`الحساب: ${currentUser.name}`}
          className="hidden sm:flex w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-bold items-center justify-center cursor-pointer"
        >
          {currentUser.name.charAt(0)}
        </button>
      </div>
    </header>

    {/* الهاتف: شريط تنقل سفلي عائم (زجاج) بالأقسام الخمسة */}
    <nav
      aria-label="التنقل السريع"
      className="mobile-dock lg:hidden fixed inset-x-3 z-40 no-print"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mobile-dock-bar grid gap-1 p-1.5 rounded-[1.75rem]" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
        {groups.map(g => {
          const Icon = g.icon;
          const active = activeGroup === g.id;
          const n = badge(g);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => go(g)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[3.5rem] rounded-[1.25rem] text-xs font-semibold cursor-pointer transition-colors ${active ? 'text-white' : 'text-slate-400 active:text-slate-200'}`}
            >
              {active && <m.span layoutId="mobile-nav-indicator" transition={PILL_SPRING} className="mobile-dock-active absolute inset-0 rounded-[1.25rem]" aria-hidden="true" />}
              <span className="relative">
                <Icon className={`w-[1.4rem] h-[1.4rem] transition-transform ${active ? 'text-cyan-200 scale-110' : ''}`} />
                {n > 0 && <span className="absolute -top-1.5 -left-2.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold leading-[1.1rem] text-center ring-2 ring-slate-900">{n > 99 ? '99+' : n}</span>}
              </span>
              <span className="relative leading-none">{g.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
    </MotionConfig>
    </LazyMotion>
  );
};

/** شريط الصفحات داخل القسم (مثل: الديون • الصندوق • التقارير). في «المزيد»: زر رجوع إلى القائمة. */
export const SubNav: React.FC<{ activeTab: string; role: StaffUser['role']; onSelect: (tab: string) => void }> = ({ activeTab, role, onSelect }) => {
  const group = groupOf(activeTab);
  const tabs = tabsFor(group, role);
  if (group.id === 'more') {
    if (activeTab === 'more') return null;
    return (
      <div className="mb-4 flex items-center gap-2 text-sm no-print">
        <button type="button" onClick={() => onSelect('more')} className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer">
          <ChevronRight className="w-4 h-4" /> المزيد
        </button>
        <span className="text-slate-400">/</span>
        <span className="text-white font-semibold">{TAB_LABEL[activeTab]}</span>
      </div>
    );
  }
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label={group.label} className="mb-4 flex gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-700 overflow-x-auto no-scrollbar no-print">
      {tabs.map(t => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t === activeTab}
          onClick={() => onSelect(t)}
          className={`flex-1 min-w-max h-10 px-4 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap ${t === activeTab ? 'bg-cyan-500/15 text-cyan-100' : 'text-slate-400 hover:text-slate-100'}`}
        >
          {TAB_LABEL[t]}
        </button>
      ))}
    </div>
  );
};
