import { Home, LayoutGrid, Megaphone, Users, Wallet } from 'lucide-react';
import type React from 'react';
import { canAccessTab, type Role } from '../../shared/access';

/**
 * التنقل: 5 أقسام رئيسية، وكل قسم يجمع صفحات (tabs) قديمة. الصفحات نفسها لم تتغير؛
 * الصلاحيات تبقى لكل صفحة في shared/access.ts.
 */
export interface NavGroup {
  id: 'home' | 'subscribers' | 'money' | 'marketing' | 'more';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabs: string[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'home', label: 'الرئيسية', icon: Home, tabs: ['home'] },
  { id: 'subscribers', label: 'المشتركون', icon: Users, tabs: ['subscribers'] },
  { id: 'money', label: 'المال', icon: Wallet, tabs: ['debts', 'cash', 'reports', 'dashboard'] },
  { id: 'marketing', label: 'التسويق', icon: Megaphone, tabs: ['marketing', 'reminders'] },
  { id: 'more', label: 'المزيد', icon: LayoutGrid, tabs: ['more', 'tickets', 'towers', 'providers', 'users', 'settings'] },
];

/** أسماء الصفحات داخل القسم (الشريط الصغير تحت العنوان) */
export const TAB_LABEL: Record<string, string> = {
  home: 'الرئيسية',
  subscribers: 'المشتركون',
  debts: 'الديون',
  cash: 'الصندوق والمصاريف',
  reports: 'التقارير',
  dashboard: 'المؤشرات',
  marketing: 'الخطة والعروض',
  reminders: 'تذكيرات التجديد',
  more: 'المزيد',
  tickets: 'البلاغات والدعم الفني',
  towers: 'الأبراج',
  providers: 'المزودون والباقات',
  users: 'المستخدمون والصلاحيات',
  settings: 'الإعدادات',
};

/** ترتيب كل الصفحات (يحدد اتجاه حركة الدخول) */
export const TAB_ORDER = NAV_GROUPS.flatMap(g => g.tabs);

export const groupOf = (tab: string): NavGroup => NAV_GROUPS.find(g => g.tabs.includes(tab)) || NAV_GROUPS[0];

export const tabsFor = (group: NavGroup, role: Role): string[] => group.tabs.filter(t => canAccessTab(role, t));

export const visibleGroups = (role: Role): NavGroup[] => NAV_GROUPS.filter(g => tabsFor(g, role).length > 0);

/** الصفحة التي تفتح عند الضغط على القسم */
export const firstTab = (group: NavGroup, role: Role): string => tabsFor(group, role)[0] || 'home';
