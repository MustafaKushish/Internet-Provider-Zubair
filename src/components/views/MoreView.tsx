import React from 'react';
import { Bell, BellOff, ChevronLeft, Download, LogOut, MonitorDown, Server, Settings, ShieldCheck, Smile, TowerControl, Upload, UserCheck, Wrench } from 'lucide-react';
import { StaffUser } from '../../types/isp';
import { canAccessTab } from '../../../shared/access';
import { TAB_LABEL } from '../nav';

/** «المزيد»: الأقسام الأقل استعمالاً، وأدوات الجهاز والحساب (بدل أزرار الرأس القديمة) */
interface MoreViewProps {
  currentUser: StaffUser;
  openTickets: number;
  onOpenTab: (tab: string) => void;
  onToggleSimpleMode: () => void;
  onExport: () => void;
  onImport: () => void;
  onSwitchUser: () => void;
  onLogout: () => void;
  notificationsOn: boolean;
  onBell: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

const ROLE_LABEL = { admin: 'المدير العام', accountant: 'محاسب', technician: 'فني' } as const;

const Row: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; badge?: number; tone?: 'rose' }> = ({ icon: Icon, label, onClick, badge, tone }) => (
  <li>
    <button type="button" onClick={onClick} className="w-full min-h-14 flex items-center gap-3 px-4 text-right text-base text-slate-100 hover:bg-white/5 cursor-pointer">
      <span className={`w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 ${tone === 'rose' ? 'text-rose-300' : 'text-cyan-300'}`}><Icon className="w-5 h-5" /></span>
      <span className="flex-1">{label}</span>
      {!!badge && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200">{badge}</span>}
      <ChevronLeft className="w-4 h-4 text-slate-500" />
    </button>
  </li>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="space-y-2">
    <h3 className="text-sm font-semibold text-slate-400 px-1">{title}</h3>
    <ul className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-700/70">{children}</ul>
  </section>
);

export const MoreView: React.FC<MoreViewProps> = p => {
  const can = (t: string) => canAccessTab(p.currentUser.role, t);
  const isOffice = p.currentUser.role !== 'technician';
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-2xl font-bold text-white">المزيد</h2>

      <Group title="العمل اليومي">
        {can('tickets') && <Row icon={Wrench} label={TAB_LABEL.tickets} badge={p.openTickets} onClick={() => p.onOpenTab('tickets')} />}
        {can('towers') && <Row icon={TowerControl} label={TAB_LABEL.towers} onClick={() => p.onOpenTab('towers')} />}
      </Group>

      {(can('providers') || can('users') || can('settings') || isOffice) && (
        <Group title="الإدارة">
          {can('providers') && <Row icon={Server} label={TAB_LABEL.providers} onClick={() => p.onOpenTab('providers')} />}
          {can('users') && <Row icon={ShieldCheck} label={TAB_LABEL.users} onClick={() => p.onOpenTab('users')} />}
          {can('settings') && <Row icon={Settings} label={TAB_LABEL.settings} onClick={() => p.onOpenTab('settings')} />}
          <Row icon={Upload} label="استيراد من Excel" onClick={p.onImport} />
          <Row icon={Download} label="تصدير المشتركين إلى Excel" onClick={p.onExport} />
        </Group>
      )}

      <Group title="الحساب والجهاز">
        <li className="px-4 py-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white">{p.currentUser.name.charAt(0)}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-white font-semibold truncate">{p.currentUser.name}</span>
            <span className="block text-sm text-slate-400">{ROLE_LABEL[p.currentUser.role]} • <span dir="ltr">@{p.currentUser.username}</span></span>
          </span>
        </li>
        <Row icon={Smile} label="الوضع البسيط (خط وأزرار كبيرة)" onClick={p.onToggleSimpleMode} />
        <Row icon={p.notificationsOn ? Bell : BellOff} label={p.notificationsOn ? 'الإشعارات مفعلة: افحص التنبيهات الآن' : 'فعّل الإشعارات على هذا الجهاز'} onClick={p.onBell} />
        {p.canInstall && <Row icon={MonitorDown} label="ثبّت التطبيق على هذا الجهاز" onClick={p.onInstall} />}
        <Row icon={UserCheck} label="بدّل المستخدم" onClick={p.onSwitchUser} />
        <Row icon={LogOut} label="سجّل الخروج" tone="rose" onClick={p.onLogout} />
      </Group>
    </div>
  );
};
