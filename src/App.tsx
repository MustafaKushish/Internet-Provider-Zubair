/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Subscriber,
  PaymentRecord,
  SupportTicket,
  UpstreamProvider,
  SystemSettings,
  StaffUser,
  TowerPoint,
  UserRole
} from './types/isp';
import {
  loadSubscribers,
  saveSubscribers,
  loadPayments,
  savePayments,
  loadTickets,
  saveTickets,
  loadProviders,
  saveProviders,
  loadSettings,
  saveSettings,
  loadActiveStaffUser,
  saveActiveStaffUser,
  exportSubscribersToExcel,
  calculateSubscriptionStatus,
  calculatePaymentStatus,
  generateWhatsAppLink,
  getWhatsAppTemplates,
  loadTowers,
  saveTowers,
  getRemainingDebt,
  refreshSubscriberStatus,
  nextReceiptNumber,
  nextTicketNumber,
  normalizeNameKey
} from './utils/storage';
import { todayStr, addMonthsToDateStr, parseLocalDate, uid } from './utils/dates';
import {
  checkAndTriggerExpiryNotifications,
  getNotificationPermission
} from './utils/notifications';
import {
  INITIAL_SUBSCRIBERS,
  INITIAL_PAYMENTS,
  INITIAL_TICKETS,
  INITIAL_PROVIDERS,
  INITIAL_SETTINGS,
  INITIAL_STAFF_USERS
} from './data/initialData';

// Components & Modals
import { Header } from './components/Header';
import { SubscriberModal } from './components/SubscriberModal';
import { QuickRenewModal } from './components/QuickRenewModal';
import { WhatsAppReminderModal } from './components/WhatsAppReminderModal';
import { ReceiptModal } from './components/ReceiptModal';
import { TicketModal } from './components/TicketModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { PaymentHistoryModal } from './components/PaymentHistoryModal';
import { UserLoginModal } from './components/UserLoginModal';
import { LockScreen } from './components/LockScreen';
import { ProviderModal } from './components/ProviderModal';
import { TowerModal } from './components/TowerModal';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { authApi, usersApi, getToken, setToken, ApiError, PREVIEW_MODE } from './sync/api';
import { useCloudSync } from './sync/useCloudSync';

// Views
import { SubscribersView } from './components/views/SubscribersView';
import { DashboardView } from './components/views/DashboardView';
// التقارير تحتوي على مكتبة الرسوم البيانية؛ تُحمَّل عند فتح التبويب فقط
const ReportsView = React.lazy(() => import('./components/views/ReportsView').then(m => ({ default: m.ReportsView })));
import { RemindersView } from './components/views/RemindersView';
import { TicketsView } from './components/views/TicketsView';
import { ProvidersView } from './components/views/ProvidersView';
import { UsersManagementView } from './components/views/UsersManagementView';
import { TowersView } from './components/views/TowersView';
// المستشار الذكي يُحمَّل عند فتح التبويب فقط
const AdvisorView = React.lazy(() => import('./components/views/AdvisorView').then(m => ({ default: m.AdvisorView })));
import { NO_TOWER_LABEL, normTower } from './utils/towers';
import { SettingsView } from './components/views/SettingsView';
import { appConfirm, notify } from './components/ui/Dialogs';

// صلاحيات التبويبات حسب الدور (تُطبَّق على المحتوى نفسه وليس على أزرار القائمة فقط)
const TAB_ACCESS: Record<string, UserRole[]> = {
  subscribers: ['admin', 'accountant', 'technician'],
  reminders: ['admin', 'accountant', 'technician'],
  tickets: ['admin', 'accountant', 'technician'],
  dashboard: ['admin', 'accountant'],
  reports: ['admin', 'accountant'],
  providers: ['admin', 'accountant'],
  towers: ['admin', 'accountant', 'technician'],
  advisor: ['admin', 'accountant'],
  users: ['admin'],
  settings: ['admin'],
};

const canAccessTab = (role: UserRole, tab: string): boolean =>
  (TAB_ACCESS[tab] || []).includes(role);

export default function App() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => loadSubscribers(loadSettings().warningDaysBeforeExpiry));
  const [payments, setPayments] = useState<PaymentRecord[]>(loadPayments);
  const [tickets, setTickets] = useState<SupportTicket[]>(loadTickets);
  const [providers, setProviders] = useState<UpstreamProvider[]>(loadProviders);
  const [settings, setSettings] = useState<SystemSettings>(loadSettings);
  // قائمة الموظفين تأتي من الخادم بعد تسجيل الدخول (بدون كلمات مرور)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [currentUser, setCurrentUser] = useState<StaffUser>(loadActiveStaffUser);
  const [towerPoints, setTowerPoints] = useState<TowerPoint[]>(loadTowers);

  const [activeTab, setActiveTabRaw] = useState<string>('subscribers');
  // لا يمكن فتح تبويب غير مسموح لدور المستخدم الحالي
  const setActiveTab = (tab: string) => {
    setActiveTabRaw(canAccessTab(currentUser.role, tab) ? tab : 'subscribers');
  };
  const safeActiveTab = canAccessTab(currentUser.role, activeTab) ? activeTab : 'subscribers';

  const [isTowerModalOpen, setIsTowerModalOpen] = useState(false);
  const [towerToEdit, setTowerToEdit] = useState<TowerPoint | null>(null);

  // Modals state
  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false);
  const [subscriberToEdit, setSubscriberToEdit] = useState<Subscriber | null>(null);

  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [subscriberToRenew, setSubscriberToRenew] = useState<Subscriber | null>(null);

  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [subscriberForWhatsApp, setSubscriberForWhatsApp] = useState<Subscriber | null>(null);
  const [whatsAppDefaultTab, setWhatsAppDefaultTab] = useState<any>('expiry');

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [subscriberForReceipt, setSubscriberForReceipt] = useState<Subscriber | null>(null);
  const [receiptCustomAmount, setReceiptCustomAmount] = useState<number | undefined>(undefined);

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<SupportTicket | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [ticketPrefillSubscriberId, setTicketPrefillSubscriberId] = useState<string | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [subscriberForHistory, setSubscriberForHistory] = useState<Subscriber | null>(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [providerToEdit, setProviderToEdit] = useState<UpstreamProvider | null>(null);

  // Security Lock & Inactivity Auto-logout (5 minutes = 300,000 ms)
  // By default when opening the app, username and password are required
  const hasActiveSession = () =>
    PREVIEW_MODE || (sessionStorage.getItem('sas_plus_authenticated_session') === 'active' && !!getToken());
  const [isLocked, setIsLocked] = useState<boolean>(() => !hasActiveSession());
  const [lockReason, setLockReason] = useState<'manual' | 'inactivity' | 'auth_required' | 'session_expired' | null>(() => {
    return hasActiveSession() ? null : 'auth_required';
  });

  const [forceOpenAddUserModal, setForceOpenAddUserModal] = useState(false);

  useEffect(() => {
    if (isLocked || PREVIEW_MODE) return;

    let timeoutId: any;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lockApp('inactivity');
      }, 5 * 60 * 1000); // 5 minutes of no activity
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetInactivityTimer, { passive: true }));

    // Start timer
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [isLocked]);

  // القفل = إنهاء الجلسة على الخادم أيضاً؛ البيانات غير المرفوعة تبقى على الجهاز وتُرفع بعد الدخول
  function lockApp(reason: 'manual' | 'inactivity' | 'session_expired') {
    if (PREVIEW_MODE) {
      notify('وضع المعاينة: لا يوجد تسجيل دخول أو خروج. بعد النشر على Cloudflare يعمل الدخول بكلمة المرور.', 'info');
      return;
    }
    if (getToken()) authApi.logout().catch(() => undefined);
    setToken(null);
    sessionStorage.removeItem('sas_plus_authenticated_session');
    setIsLocked(true);
    setLockReason(reason);
  }

  const handleLogout = () => lockApp('manual');

  const refreshStaffUsers = () => {
    usersApi.list().then(r => setStaffUsers(r.users)).catch(() => undefined);
  };

  // يُستدعى بعد نجاح تسجيل الدخول على الخادم (رمز الجلسة محفوظ مسبقاً)
  const handleUnlock = (user: StaffUser) => {
    setCurrentUser(user);
    saveActiveStaffUser(user);
    setActiveTabRaw('subscribers');
    sessionStorage.setItem('sas_plus_authenticated_session', 'active');
    setIsLocked(false);
    setLockReason(null);
    if (!user.mustChangePassword) refreshStaffUsers();
  };

  // عند إعادة تحميل الصفحة: التأكد من أن الجلسة ما زالت صالحة (بدون إنترنت نكمل بالبيانات المحفوظة)
  useEffect(() => {
    if (PREVIEW_MODE) {
      const previewAdmin = { ...INITIAL_STAFF_USERS[0], mustChangePassword: false };
      setCurrentUser(previewAdmin);
      setStaffUsers([previewAdmin]);
      return;
    }
    if (isLocked) return;
    authApi.me()
      .then(r => {
        setCurrentUser(r.user);
        saveActiveStaffUser(r.user);
        if (!r.user.mustChangePassword) refreshStaffUsers();
      })
      .catch((e: ApiError) => {
        if (e.status === 401) lockApp('session_expired');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- المزامنة مع الخادم ----------
  const settingsAsList = useMemo(() => [{ ...settings, id: 'main' }], [settings]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const { status: syncStatus, syncNow } = useCloudSync({
    enabled: !PREVIEW_MODE && !isLocked && !currentUser.mustChangePassword,
    sources: {
      subscribers: {
        value: subscribers,
        set: setSubscribers,
        fromServer: (d: any) => refreshSubscriberStatus(d as Subscriber, settings.warningDaysBeforeExpiry),
      },
      payments: { value: payments, set: setPayments },
      tickets: { value: tickets, set: setTickets },
      providers: { value: providers, set: setProviders },
      towers: { value: towerPoints, set: setTowerPoints },
      settings: {
        value: settingsAsList,
        set: (updater: any) => setSettings(prev => {
          const list = typeof updater === 'function' ? updater([{ ...prev, id: 'main' }]) : updater;
          const main = list.find((x: any) => x.id === 'main');
          if (!main) return prev;
          const { id: _id, ...rest } = main;
          return { ...INITIAL_SETTINGS, ...rest };
        }),
      },
    },
    onAuthError: () => lockApp('session_expired'),
    onRejected: msgs => setSyncNotice(`تم إلغاء تغيير لم يقبله الخادم: ${msgs.join(' ')}`),
  });

  // Sync to localStorage
  useEffect(() => {
    saveSubscribers(subscribers);
  }, [subscribers]);

  useEffect(() => {
    savePayments(payments);
  }, [payments]);

  useEffect(() => {
    saveTickets(tickets);
  }, [tickets]);

  useEffect(() => {
    saveProviders(providers);
  }, [providers]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveActiveStaffUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    saveTowers(towerPoints);
  }, [towerPoints]);

  // إعادة حساب الحالات عند تغيير أيام التنبيه، ومرة كل ساعة (لتحديث الحالات بعد منتصف الليل)
  useEffect(() => {
    const recompute = () =>
      setSubscribers(prev => prev.map(s => refreshSubscriberStatus(s, settings.warningDaysBeforeExpiry)));
    recompute();
    const intervalId = setInterval(recompute, 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [settings.warningDaysBeforeExpiry]);

  // Automatically check and trigger browser notifications for subscribers about to expire if permission granted
  useEffect(() => {
    if (getNotificationPermission() === 'granted') {
      checkAndTriggerExpiryNotifications(subscribers, settings, false);
    }
  }, [subscribers, settings.warningDaysBeforeExpiry]);

  // قائمة الأبراج للاختيار والفلترة: المسجلة أولاً، ثم أسماء موجودة عند مشتركين ولم تُسجَّل بعد
  const towers = React.useMemo(() => {
    const registered = towerPoints.map(t => normTower(t.name)).filter(Boolean);
    const known = new Set(registered);
    const orphans = new Set<string>();
    subscribers.forEach(s => {
      const n = normTower(s.towerName);
      if (n && !known.has(n)) orphans.add(n);
    });
    return [...registered, ...[...orphans].sort((x, y) => x.localeCompare(y, 'ar'))];
  }, [subscribers, towerPoints]);

  const canEditTowers = currentUser.role === 'admin' || currentUser.role === 'accountant';

  // يسجّل اسم برج جديد تلقائياً عند استخدامه لأول مرة (من نموذج المشترك أو النقل الجماعي)
  const ensureTowerRegistered = (name: string) => {
    const n = normTower(name);
    if (!n || !canEditTowers) return;
    setTowerPoints(prev => prev.some(t => normTower(t.name) === n)
      ? prev
      : [...prev, { id: uid('tow'), name: n }]);
  };

  // نقل مشتركين محددين إلى برج (أو بدون برج عند الاسم الفارغ)
  const handleAssignTower = (subscriberIds: string[], towerName: string) => {
    const ids = new Set(subscriberIds);
    const n = normTower(towerName);
    setSubscribers(prev => prev.map(s => ids.has(s.id) ? { ...s, towerName: n } : s));
    ensureTowerRegistered(n);
    notify(`تم نقل ${ids.size} مشترك إلى ${n || NO_TOWER_LABEL}.`, 'success');
  };

  // طلب فتح قائمة المشتركين مفلترة على برج معيّن (من تبويب الأبراج)
  const [towerFilterRequest, setTowerFilterRequest] = useState<{ name: string; nonce: number } | null>(null);


  // آخر وصل مطابق للمشترك المعروض في نافذة الطباعة
  const receiptPayment = React.useMemo(() => {
    if (!subscriberForReceipt) return undefined;
    const subPays = payments
      .filter(p => p.subscriberId === subscriberForReceipt.id)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.receiptNumber || '').localeCompare(a.receiptNumber || ''));
    if (receiptCustomAmount !== undefined) {
      return subPays.find(p => p.amount === receiptCustomAmount) || subPays[0];
    }
    return subPays[0];
  }, [subscriberForReceipt, receiptCustomAmount, payments]);

  // Overall statistics
  const stats = React.useMemo(() => {
    const totalSubscribers = subscribers.length;
    const activeCount = subscribers.filter(s => s.status === 'active').length;
    const expiringSoonCount = subscribers.filter(s => s.status === 'expiring_soon').length;
    const expiredCount = subscribers.filter(s => s.status === 'expired').length;

    const totalSales = subscribers.reduce((acc, s) => acc + s.salePrice, 0);
    const totalWholesale = subscribers.reduce((acc, s) => acc + s.costPrice, 0);
    const totalProfit = totalSales - totalWholesale;

    const totalDebts = subscribers.reduce((acc, s) => acc + getRemainingDebt(s), 0);
    const openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

    return {
      totalSubscribers,
      activeCount,
      expiringSoonCount,
      expiredCount,
      totalProfit,
      totalDebts,
      openTicketsCount,
    };
  }, [subscribers, tickets]);

  // Handlers: Subscribers
  const handleSaveSubscriber = (subData: Partial<Subscriber>) => {
    const warn = settings.warningDaysBeforeExpiry;
    if (subData.towerName !== undefined) {
      subData = { ...subData, towerName: normTower(subData.towerName) };
      ensureTowerRegistered(subData.towerName || '');
    }
    if (subData.id) {
      // المبلغ المدفوع لا يُعدَّل من نموذج المشترك؛ أي دفعة تمر عبر سجل الدفعات حتى يبقى الدفتر مطابقاً
      const { paidAmount: _ignoredPaid, ...rest } = subData;
      setSubscribers(prev => prev.map(s => {
        if (s.id === subData.id) {
          return refreshSubscriberStatus({ ...s, ...(rest as Subscriber), paidAmount: s.paidAmount }, warn);
        }
        return s;
      }));
    } else {
      const today = todayStr();
      const subId = uid('sub');
      const cycleId = uid('cycle');
      const paid = Math.max(0, Number(subData.paidAmount) || 0);
      const draft: Subscriber = {
        id: subId,
        name: subData.name || 'مشترك جديد',
        phone: subData.phone || '',
        username: subData.username || `user_${Date.now().toString().slice(-6)}`,
        password: subData.password || '',
        upstreamProvider: subData.upstreamProvider || 'إيرثلنك (Earthlink)',
        planName: subData.planName || 'ستاندرد (Standard)',
        costPrice: subData.costPrice ?? 24000,
        salePrice: subData.salePrice ?? 35000,
        paidAmount: paid,
        startDate: subData.startDate || today,
        expiryDate: subData.expiryDate || addMonthsToDateStr(subData.startDate || today, 1),
        status: 'active',
        paymentStatus: 'pending',
        towerName: normTower(subData.towerName),
        ipAddress: subData.ipAddress || '',
        macAddress: subData.macAddress || '',
        address: subData.address || '',
        notes: subData.notes || '',
        createdAt: today,
        lastPaymentDate: paid > 0 ? today : undefined,
        cycleMonths: 1,
        carriedDebt: 0,
        currentCycleId: cycleId,
      };
      const newSub = refreshSubscriberStatus(draft, warn);
      setSubscribers(prev => [newSub, ...prev]);

      // تسجيل الدفعة الأولى في الدفتر حتى تظهر في التقارير والأرباح
      if (paid > 0) {
        setPayments(prev => [{
          id: uid('pay'),
          receiptNumber: nextReceiptNumber(prev, today),
          subscriberId: subId,
          subscriberName: newSub.name,
          amount: paid,
          date: today,
          paymentMethod: 'cash',
          paymentType: 'initial',
          cycleMonths: 1,
          notes: 'دفعة الاشتراك الأولي',
          collectedBy: currentUser.name || settings.agentName,
          remainingBalanceAfter: getRemainingDebt(newSub),
          costAmount: newSub.costPrice,
          provider: newSub.upstreamProvider,
          towerName: newSub.towerName,
          cycleId,
        }, ...prev]);
      }
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (currentUser.role !== 'admin') {
      notify('عذراً: صلاحية حذف المشتركين مخصصة للمدير العام فقط!');
      return;
    }
    if (await appConfirm('هل أنت متأكد من حذف هذا المشترك نهائياً من المنظومة؟\n(تبقى وصولاته المالية محفوظة في التقارير)')) {
      setSubscribers(prev => prev.filter(s => s.id !== id));
    }
  };

  // Handlers: Quick Renewal
  const handleConfirmRenewal = (
    subId: string,
    renewalData: {
      durationMonths: number;
      amountPaid: number;
      paymentMethod: 'cash' | 'zain_cash' | 'qi_card' | 'transfer';
      sendWhatsAppReceipt: boolean;
      notes: string;
    }
  ) => {
    const sub = subscribers.find(s => s.id === subId);
    if (!sub) return;

    const months = Math.max(1, Math.round(renewalData.durationMonths || 1));
    const amountPaid = Math.max(0, Number(renewalData.amountPaid) || 0);
    const today = todayStr();

    // إذا كان الاشتراك ما زال سارياً نمدّد من تاريخ الانتهاء، وإلا من اليوم — بأشهر تقويمية
    const baseDate = parseLocalDate(sub.expiryDate) > parseLocalDate(today) ? sub.expiryDate : today;
    const newExpiry = addMonthsToDateStr(baseDate, months);

    // الدين غير المسدد من الدورة السابقة يُرحَّل ولا يُمسح
    const previousDebt = getRemainingDebt(sub);
    const cycleId = uid('cycle');

    const updatedSub: Subscriber = refreshSubscriberStatus({
      ...sub,
      startDate: baseDate,
      expiryDate: newExpiry,
      paidAmount: amountPaid,
      cycleMonths: months,
      carriedDebt: previousDebt,
      currentCycleId: cycleId,
      status: sub.status === 'suspended' ? 'active' : sub.status,
      lastPaymentDate: amountPaid > 0 ? today : sub.lastPaymentDate,
    }, settings.warningDaysBeforeExpiry);

    const newPayment: PaymentRecord = {
      id: uid('pay'),
      receiptNumber: nextReceiptNumber(payments, today),
      subscriberId: sub.id,
      subscriberName: sub.name,
      amount: amountPaid,
      date: today,
      paymentMethod: renewalData.paymentMethod,
      paymentType: 'renewal',
      cycleMonths: months,
      notes: renewalData.notes,
      collectedBy: currentUser.name || settings.agentName,
      remainingBalanceAfter: getRemainingDebt(updatedSub),
      costAmount: sub.costPrice * months,
      provider: sub.upstreamProvider,
      towerName: sub.towerName,
      cycleId,
    };

    setPayments(prev => [newPayment, ...prev]);
    setSubscribers(prev => prev.map(s => s.id === subId ? updatedSub : s));

    if (renewalData.sendWhatsAppReceipt) {
      setTimeout(() => {
        const templates = getWhatsAppTemplates(updatedSub, settings);
        const link = generateWhatsAppLink(updatedSub.phone, templates.paymentReceipt);
        window.open(link, '_blank');
      }, 500);
    }
  };

  // Handlers: Add manual payment from Payment History
  const handleAddPaymentFromHistory = (paymentData: Partial<PaymentRecord>) => {
    if (!subscriberForHistory) return;
    const sub = subscribers.find(s => s.id === subscriberForHistory.id) || subscriberForHistory;
    const amount = Math.max(0, Number(paymentData.amount) || 0);
    if (amount <= 0) return;

    const date = paymentData.date || todayStr();
    const updatedSub = refreshSubscriberStatus({
      ...sub,
      paidAmount: sub.paidAmount + amount,
      lastPaymentDate: date,
    }, settings.warningDaysBeforeExpiry);

    const newRec: PaymentRecord = {
      id: uid('pay'),
      receiptNumber: nextReceiptNumber(payments, date),
      subscriberId: sub.id,
      subscriberName: sub.name,
      amount,
      date,
      paymentMethod: paymentData.paymentMethod || 'cash',
      paymentType: paymentData.paymentType || 'debt_installment',
      notes: paymentData.notes || '',
      collectedBy: currentUser.name || settings.agentName,
      remainingBalanceAfter: getRemainingDebt(updatedSub),
      // الأقساط والإضافات لا تحمل كلفة جملة جديدة (الكلفة سُجّلت مع التجديد)
      costAmount: 0,
      provider: sub.upstreamProvider,
      towerName: sub.towerName,
      cycleId: sub.currentCycleId,
    };

    setPayments(prev => [newRec, ...prev]);
    setSubscribers(prev => prev.map(s => s.id === sub.id ? updatedSub : s));
    setSubscriberForHistory(updatedSub);
  };

  // هل الوصل تابع للدورة الحالية للمشترك؟
  const paymentBelongsToCurrentCycle = (pay: PaymentRecord, sub: Subscriber): boolean => {
    if (pay.cycleId && sub.currentCycleId) return pay.cycleId === sub.currentCycleId;
    // وصولات قديمة بلا معرّف دورة: نعتمد على التاريخ
    return pay.date >= sub.startDate;
  };

  // Handler: Delete payment/invoice (Admin only)
  const handleDeletePayment = (paymentId: string) => {
    if (currentUser.role !== 'admin') {
      notify('عذراً، فقط المدير العام يمتلك صلاحية حذف الفواتير ووصولات الدفع!');
      return;
    }

    const pay = payments.find(p => p.id === paymentId);
    if (!pay) return;

    const sub = subscribers.find(s => s.id === pay.subscriberId);
    let updatedSub: Subscriber | null = null;

    // يُخصم من رصيد المشترك فقط إذا كان الوصل تابعاً للدورة الحالية
    if (sub && paymentBelongsToCurrentCycle(pay, sub)) {
      const u = refreshSubscriberStatus({
        ...sub,
        paidAmount: Math.max(0, sub.paidAmount - pay.amount),
      }, settings.warningDaysBeforeExpiry);
      updatedSub = u;
      setSubscribers(prev => prev.map(s => s.id === u.id ? u : s));
      setSubscriberForHistory(prev => (prev && prev.id === u.id ? u : prev));
    }

    setPayments(prev => prev.filter(p => p.id !== paymentId));

    if (updatedSub) {
      notify('تم حذف الوصل المالي وخصم مبلغه من رصيد الدورة الحالية للمشترك.' +
        (pay.paymentType === 'renewal' ? '\nتنبيه: تاريخ انتهاء الاشتراك لم يتغير، عدّله يدوياً إذا كان التجديد ملغياً.' : ''));
    } else {
      notify('تم حذف الوصل المالي. الوصل يعود لدورة سابقة لذلك لم يتغير رصيد الدورة الحالية للمشترك.');
    }
  };

  // Handlers: Tickets
  const handleSaveTicket = (ticketData: Partial<SupportTicket>) => {
    if (ticketData.id) {
      setTickets(prev => prev.map(t => t.id === ticketData.id ? ({ ...t, ...ticketData } as SupportTicket) : t));
    } else {
      setTickets(prev => {
        const newTicket: SupportTicket = {
          id: uid('tkt'),
          ticketNumber: nextTicketNumber(prev),
          subscriberId: ticketData.subscriberId || '',
          subscriberName: ticketData.subscriberName || 'مشترك',
          phone: ticketData.phone || '',
          towerName: ticketData.towerName || '',
          issueType: ticketData.issueType || 'connection_problem',
          title: ticketData.title || 'بلاغ صيانة',
          description: ticketData.description || '',
          priority: ticketData.priority || 'medium',
          status: ticketData.status || 'open',
          technicianName: ticketData.technicianName || currentUser.name || 'فريق الصيانة',
          resolutionNotes: ticketData.resolutionNotes || '',
          reportedBy: ticketData.reportedBy || 'user',
          createdAt: todayStr(),
          resolvedAt: ticketData.resolvedAt,
        };
        return [newTicket, ...prev];
      });
    }
  };

  const handleQuickResolveTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'resolved',
          resolvedAt: todayStr(),
          resolutionNotes: t.resolutionNotes || 'تم حل المشكلة بنجاح والتأكد من استقرار الخدمة في الزبير.',
        };
      }
      return t;
    }));
  };

  const handleQuickCloseTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'closed',
          resolvedAt: t.resolvedAt || todayStr(),
          resolutionNotes: t.resolutionNotes || 'تم إغلاق التذكرة بعد التأكيد مع المشترك.',
        };
      }
      return t;
    }));
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (await appConfirm('هل أنت متأكد من حذف هذه التذكرة؟')) {
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    }
  };

  // Handlers: Staff Users (للمدير فقط) — تُنفَّذ على الخادم الذي يتحقق من الصلاحيات أيضاً
  const handleSaveStaffUser = async (userData: Partial<StaffUser>) => {
    if (currentUser.role !== 'admin') {
      setSyncNotice('عذراً: إدارة المستخدمين مخصصة للمدير العام فقط!');
      return;
    }
    try {
      const payload: Partial<StaffUser> = {
        name: userData.name,
        username: userData.username,
        role: userData.role,
        phone: userData.phone,
        isActive: userData.isActive,
      };
      if (userData.password && userData.password.trim()) payload.password = userData.password.trim();
      const res = userData.id
        ? await usersApi.update(userData.id, payload)
        : await usersApi.create(payload);
      setStaffUsers(res.users);
      const me = res.users.find(u => u.id === currentUser.id);
      if (me) {
        setCurrentUser(me);
        saveActiveStaffUser(me);
      }
    } catch (e) {
      setSyncNotice((e as Error).message);
    }
  };

  const handleDeleteStaffUser = async (userId: string) => {
    if (currentUser.role !== 'admin') {
      setSyncNotice('عذراً: حذف المستخدمين مخصص للمدير العام فقط!');
      return;
    }
    if (userId === currentUser.id) {
      setSyncNotice('لا يمكنك حذف الحساب الذي تستخدمه حالياً.');
      return;
    }
    const target = staffUsers.find(u => u.id === userId);
    if (await appConfirm(`هل أنت متأكد من حذف حساب (${target?.name || ''})؟`)) {
      try {
        const res = await usersApi.remove(userId);
        setStaffUsers(res.users);
      } catch (e) {
        setSyncNotice((e as Error).message);
      }
    }
  };

  // تبديل المستخدم يتم فقط بعد تسجيل الدخول على الخادم (عبر نافذة تسجيل الدخول)
  const handleSwitchStaffUser = (user: StaffUser) => {
    handleUnlock(user);
  };

  const requestSwitchUser = () => {
    setIsLoginModalOpen(true);
  };

  // تغيير كلمة مرور المستخدم الحالي؛ يعيد رسالة خطأ أو null عند النجاح
  const changeCurrentUserPassword = async (currentPassword: string, newPassword: string): Promise<string | null> => {
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      setCurrentUser(res.user);
      saveActiveStaffUser(res.user);
      refreshStaffUsers();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const handleUpdateAdminPassword = (currentPassword: string, newPassword: string) =>
    changeCurrentUserPassword(currentPassword, newPassword);

  const handleForcedPasswordChange = (newPassword: string) => changeCurrentUserPassword('', newPassword);

  // Handlers: Provider Management & Renaming across Zubair
  const handleSaveProvider = (updatedProvider: UpstreamProvider, oldName?: string) => {
    // If provider was renamed, update all Zubair subscribers linked to oldName
    if (oldName && oldName.trim() !== updatedProvider.name.trim()) {
      setSubscribers(prev => prev.map(sub => {
        if (sub.upstreamProvider === oldName) {
          return { ...sub, upstreamProvider: updatedProvider.name };
        }
        return sub;
      }));
    }

    setProviders(prev => {
      const exists = prev.some(p => p.id === updatedProvider.id);
      if (exists) {
        return prev.map(p => p.id === updatedProvider.id ? updatedProvider : p);
      }
      return [...prev, updatedProvider];
    });
  };

  // Handlers: Towers (الأبراج ونقاط البث)
  const handleSaveTower = (tower: TowerPoint, oldName?: string) => {
    const name = normTower(tower.name);
    const duplicate = towerPoints.some(t => normTower(t.name) === name && t.id !== tower.id);
    if (duplicate) {
      notify(`يوجد برج آخر بنفس الاسم «${name}».`, 'error');
      return;
    }
    const old = normTower(oldName);
    if (old && old !== name) {
      // تغيير الاسم ينعكس على كل مشتركي البرج
      setSubscribers(prev => prev.map(sub => normTower(sub.towerName) === old ? { ...sub, towerName: name } : sub));
    }
    setTowerPoints(prev => {
      const exists = prev.some(t => t.id === tower.id);
      const clean = { ...tower, name };
      return exists ? prev.map(t => t.id === tower.id ? clean : t) : [...prev, { ...clean, id: tower.id || uid('tow') }];
    });
    notify(oldName ? 'تم حفظ تعديلات البرج.' : `تمت إضافة البرج «${name}».`, 'success');
  };

  // حذف برج (تفكيك): مشتركوه ينتقلون إلى برج آخر أو يصبحون بدون برج
  const handleDeleteTower = (tower: TowerPoint, moveTo: string) => {
    const from = normTower(tower.name);
    const to = normTower(moveTo);
    const count = subscribers.filter(s => normTower(s.towerName) === from).length;
    if (count > 0) {
      setSubscribers(prev => prev.map(s => normTower(s.towerName) === from ? { ...s, towerName: to } : s));
    }
    setTowerPoints(prev => prev.filter(t => t.id !== tower.id));
    notify(`تم حذف البرج «${from}»${count ? ` ونقل ${count} مشترك إلى ${to || NO_TOWER_LABEL}` : ''}.`, 'success');
  };

  const handleRegisterTower = (name: string) => {
    ensureTowerRegistered(name);
    notify(`تم تسجيل «${normTower(name)}» كبرج.`, 'success');
  };

  const handleMoveTowerSubscribers = (fromName: string, toName: string) => {
    const from = normTower(fromName);
    const ids = subscribers.filter(s => (normTower(s.towerName) || NO_TOWER_LABEL) === from).map(s => s.id);
    handleAssignTower(ids, toName);
  };

  // Handlers: Excel Import
  const handleImportComplete = (importedRows: Partial<Subscriber>[], replaceAll: boolean) => {
    // Auto-discover and register any new providers found in the imported Excel file
    const existingProviderNames = new Set(providers.map(p => p.name.trim().toLowerCase()));
    const newProvidersToRegister: UpstreamProvider[] = [];

    importedRows.forEach((row) => {
      const pName = row.upstreamProvider?.trim();
      if (pName && !existingProviderNames.has(pName.toLowerCase())) {
        existingProviderNames.add(pName.toLowerCase());
        newProvidersToRegister.push({
          id: uid('prov_imported'),
          name: pName,
          plans: [
            {
              id: uid('plan_imp'),
              name: row.planName?.trim() || 'ستاندرد (Standard)',
              defaultCost: row.costPrice ?? 24000,
              defaultSalePrice: row.salePrice ?? 35000,
              speed: '30 Mbps',
            },
          ],
        });
      }
    });

    if (newProvidersToRegister.length > 0) {
      setProviders(prev => [...prev, ...newProvidersToRegister]);
    }

    // منع التكرار: نتجاوز أي صف يطابق مشتركاً موجوداً (أو صفاً سابقاً في نفس الملف) باسم المستخدم أو بالاسم
    const seenUsernames = new Set<string>();
    const seenNames = new Set<string>();
    if (!replaceAll) {
      subscribers.forEach(s => {
        if (s.username) seenUsernames.add(s.username.trim().toLowerCase());
        seenNames.add(normalizeNameKey(s.name));
      });
    }
    const skippedNames: string[] = [];
    const uniqueRows = importedRows.filter(row => {
      const uname = row.username?.trim().toLowerCase();
      const nameKey = normalizeNameKey(row.name || '');
      if ((uname && seenUsernames.has(uname)) || (nameKey && seenNames.has(nameKey))) {
        skippedNames.push(row.name || row.username || '');
        return false;
      }
      if (uname) seenUsernames.add(uname);
      if (nameKey) seenNames.add(nameKey);
      return true;
    });

    const today = todayStr();
    const formatted: Subscriber[] = uniqueRows.map((row, idx) => {
      const sub: Subscriber = {
        id: uid(`sub_${idx}`),
        name: row.name || `مشترك ${idx + 1}`,
        phone: row.phone || '',
        username: row.username || `user_${Date.now().toString(36)}_${idx}`,
        password: row.password || '',
        upstreamProvider: row.upstreamProvider || 'إيرثلنك (Earthlink)',
        planName: row.planName || 'ستاندرد (Standard)',
        costPrice: row.costPrice ?? 24000,
        salePrice: row.salePrice ?? 35000,
        paidAmount: row.paidAmount ?? 0,
        startDate: row.startDate || today,
        expiryDate: row.expiryDate || today,
        status: 'active',
        paymentStatus: 'pending',
        towerName: normTower(row.towerName),
        ipAddress: row.ipAddress || '',
        macAddress: row.macAddress || '',
        address: row.address || '',
        notes: row.notes || 'مستورد من إكسل',
        createdAt: today,
        cycleMonths: 1,
        carriedDebt: Math.max(0, row.carriedDebt ?? 0),
        currentCycleId: uid('cycle'),
      };
      return refreshSubscriberStatus(sub, settings.warningDaysBeforeExpiry);
    });

    if (skippedNames.length > 0) {
      notify(`تم استيراد ${formatted.length} مشترك. تم تجاوز ${skippedNames.length} مكرر:\n${skippedNames.slice(0, 20).join('، ')}${skippedNames.length > 20 ? ' …' : ''}`);
    }

    if (replaceAll) {
      setSubscribers(formatted);
    } else {
      setSubscribers(prev => [...formatted, ...prev]);
    }
  };

  // Handlers: Full Backup Restore & Empty Database
  const handleRestoreFullBackup = (data: {
    subscribers: Subscriber[];
    payments: PaymentRecord[];
    tickets: SupportTicket[];
    providers: UpstreamProvider[];
    settings: SystemSettings;
    staffUsers?: StaffUser[];
    towers?: TowerPoint[];
  }) => {
    if (currentUser.role !== 'admin') return;
    const restoredSettings = { ...INITIAL_SETTINGS, ...(data.settings || {}) };
    setSubscribers((data.subscribers || []).map(s => refreshSubscriberStatus(s, restoredSettings.warningDaysBeforeExpiry)));
    setPayments(data.payments || []);
    setTickets(data.tickets || []);
    setProviders(data.providers || INITIAL_PROVIDERS);
    setSettings(restoredSettings);
    if (Array.isArray(data.towers)) setTowerPoints(data.towers);
    // حسابات الموظفين تُدار على الخادم ولا تُستعاد من ملف النسخة الاحتياطية
  };

  const handleClearAllData = () => {
    if (currentUser.role !== 'admin') return;
    setSubscribers([]);
    setPayments([]);
    setTickets([]);
    notify('تم مسح وتفريغ كافة البيانات بنجاح! المنظومة نظيفة وجاهزة للعمل الفعلي.');
  };

  if (isLocked) {
    return (
      <LockScreen
        currentUser={currentUser}
        lockReason={lockReason}
        ispName={settings.ispName}
        onUnlock={handleUnlock}
      />
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <ForcePasswordChange
        user={currentUser}
        ispName={settings.ispName}
        onChangePassword={handleForcedPasswordChange}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={safeActiveTab}
        setActiveTab={setActiveTab}
        stats={stats}
        ispName={settings.ispName}
        currentUser={currentUser}
        onOpenAddModal={() => {
          setSubscriberToEdit(null);
          setIsSubscriberModalOpen(true);
        }}
        onExportExcel={() => exportSubscribersToExcel(subscribers, `${settings.ispName}_مشتركون.xlsx`)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onTriggerNotificationCheck={() => {
          checkAndTriggerExpiryNotifications(subscribers, settings, true);
        }}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {safeActiveTab === 'subscribers' && (
          <SubscribersView
            subscribers={subscribers}
            settings={settings}
            providers={providers}
            towers={towers}
            currentUser={currentUser}
            towerFilterRequest={towerFilterRequest}
            onTowerFilterApplied={() => setTowerFilterRequest(null)}
            onAssignTower={handleAssignTower}
            onRenew={(sub) => {
              setSubscriberToRenew(sub);
              setIsRenewModalOpen(true);
            }}
            onSendWhatsApp={(sub, defaultTab) => {
              setSubscriberForWhatsApp(sub);
              setWhatsAppDefaultTab(defaultTab || 'expiry');
              setIsWhatsAppModalOpen(true);
            }}
            onPrintReceipt={(sub) => {
              setSubscriberForReceipt(sub);
              setReceiptCustomAmount(undefined);
              setIsReceiptModalOpen(true);
            }}
            onEdit={(sub) => {
              setSubscriberToEdit(sub);
              setIsSubscriberModalOpen(true);
            }}
            onDelete={handleDeleteSubscriber}
            onAddTicketForSubscriber={(sub) => {
              setTicketToEdit(null);
              setTicketPrefillSubscriberId(sub.id);
              setIsTicketModalOpen(true);
            }}
            onViewPaymentHistory={(sub) => {
              setSubscriberForHistory(sub);
              setIsHistoryModalOpen(true);
            }}
            onBatchReminderForOverdue={() => {
              setActiveTab('reminders');
            }}
            onOpenAddModal={() => {
              setSubscriberToEdit(null);
              setIsSubscriberModalOpen(true);
            }}
            onOpenImportModal={() => {
              setIsImportModalOpen(true);
            }}
            onOpenManageProviders={() => {
              setProviderToEdit(null);
              setIsProviderModalOpen(true);
            }}
          />
        )}

        {safeActiveTab === 'dashboard' && (
          <DashboardView
            subscribers={subscribers}
            payments={payments}
            towerPoints={towerPoints}
            settings={settings}
            onOpenTowers={() => setActiveTab('towers')}
            onRenew={(sub) => {
              setSubscriberToRenew(sub);
              setIsRenewModalOpen(true);
            }}
            onSendWhatsApp={(sub, defaultTab) => {
              setSubscriberForWhatsApp(sub);
              setWhatsAppDefaultTab(defaultTab || 'expiry');
              setIsWhatsAppModalOpen(true);
            }}
          />
        )}

        {safeActiveTab === 'reports' && (
          <React.Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">جارٍ تحميل التقارير…</div>}>
          <ReportsView
            subscribers={subscribers}
            payments={payments}
            settings={settings}
            currentUser={currentUser}
            onDeletePayment={handleDeletePayment}
          />
          </React.Suspense>
        )}

        {safeActiveTab === 'reminders' && (
          <RemindersView
            subscribers={subscribers}
            settings={settings}
            onRenew={(sub) => {
              setSubscriberToRenew(sub);
              setIsRenewModalOpen(true);
            }}
            onOpenMessageModal={(sub, defaultTab) => {
              setSubscriberForWhatsApp(sub);
              setWhatsAppDefaultTab(defaultTab);
              setIsWhatsAppModalOpen(true);
            }}
          />
        )}

        {safeActiveTab === 'tickets' && (
          <TicketsView
            tickets={tickets}
            subscribers={subscribers}
            onOpenCreateModal={() => {
              setTicketToEdit(null);
              setIsTicketModalOpen(true);
            }}
            onEditTicket={(ticket) => {
              setTicketToEdit(ticket);
              setIsTicketModalOpen(true);
            }}
            onDeleteTicket={handleDeleteTicket}
            onQuickResolve={handleQuickResolveTicket}
            onQuickClose={handleQuickCloseTicket}
          />
        )}

        {safeActiveTab === 'providers' && (
          <ProvidersView
            providers={providers}
            subscribers={subscribers}
            settings={settings}
            towers={towerPoints}
            onSaveProviders={setProviders}
            onSaveTowers={setTowerPoints}
            onOpenEditTowerModal={(tow) => {
              setTowerToEdit(tow);
              setIsTowerModalOpen(true);
            }}
            onOpenAddTowerModal={() => {
              setTowerToEdit(null);
              setIsTowerModalOpen(true);
            }}
            onOpenTowersTab={() => setActiveTab('towers')}
            onOpenEditProviderModal={(prov) => {
              setProviderToEdit(prov);
              setIsProviderModalOpen(true);
            }}
            onOpenAddProviderModal={() => {
              setProviderToEdit(null);
              setIsProviderModalOpen(true);
            }}
            onNavigateToSubscribersWithProvider={() => {
              setActiveTab('subscribers');
            }}
          />
        )}

        {safeActiveTab === 'towers' && (
          <TowersView
            subscribers={subscribers}
            payments={payments}
            towers={towerPoints}
            settings={settings}
            canEdit={canEditTowers}
            onAddTower={() => {
              setTowerToEdit(null);
              setIsTowerModalOpen(true);
            }}
            onEditTower={(tow) => {
              setTowerToEdit(tow);
              setIsTowerModalOpen(true);
            }}
            onDeleteTower={handleDeleteTower}
            onRegisterTower={handleRegisterTower}
            onMoveSubscribers={handleMoveTowerSubscribers}
            onShowSubscribers={(name) => {
              setTowerFilterRequest({ name, nonce: Date.now() });
              setActiveTab('subscribers');
            }}
          />
        )}

        {safeActiveTab === 'advisor' && (
          <React.Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">جارٍ تحميل المستشار…</div>}>
            <AdvisorView
              subscribers={subscribers}
              payments={payments}
              tickets={tickets}
              providers={providers}
              towers={towerPoints}
              settings={settings}
            />
          </React.Suspense>
        )}

        {safeActiveTab === 'users' && (
          <UsersManagementView
            currentUser={currentUser}
            users={staffUsers}
            onSaveUser={handleSaveStaffUser}
            onDeleteUser={handleDeleteStaffUser}
            onSwitchUser={requestSwitchUser}
            forceOpenAddModal={forceOpenAddUserModal}
            onResetForceOpenAddModal={() => setForceOpenAddUserModal(false)}
          />
        )}

        {safeActiveTab === 'settings' && (
          <SettingsView
            settings={settings}
            subscribers={subscribers}
            payments={payments}
            tickets={tickets}
            providers={providers}
            currentUser={currentUser}
            adminUser={currentUser}
            onSaveSettings={setSettings}
            onRestoreFullBackup={handleRestoreFullBackup}
            onResetToDemoData={handleClearAllData}
            onUpdateAdminPassword={handleUpdateAdminPassword}
            onNavigateToProviders={() => setActiveTab('providers')}
            staffUsers={staffUsers}
            towers={towerPoints}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 no-print">
        <p>
          {settings.ispName} (العراق - البصرة - قضاء الزبير) © {new Date().getFullYear()} • هاتف وواتساب:{' '}
          <span className="font-mono text-cyan-400 font-semibold" dir="ltr">+964 771 979 7455</span>
        </p>
      </footer>

      <SyncStatusBadge
        previewMode={PREVIEW_MODE}
        status={syncStatus}
        notice={syncNotice}
        onDismissNotice={() => setSyncNotice(null)}
        onSyncNow={() => { void syncNow(); }}
      />

      {/* Modals */}
      <SubscriberModal
        isOpen={isSubscriberModalOpen}
        onClose={() => {
          setIsSubscriberModalOpen(false);
          setSubscriberToEdit(null);
        }}
        onSave={handleSaveSubscriber}
        subscriberToEdit={subscriberToEdit}
        providers={providers}
        towers={towers}
        currentUser={currentUser}
        onOpenManageProviders={() => {
          setProviderToEdit(null);
          setIsProviderModalOpen(true);
        }}
      />

      <QuickRenewModal
        isOpen={isRenewModalOpen}
        onClose={() => {
          setIsRenewModalOpen(false);
          setSubscriberToRenew(null);
        }}
        subscriber={subscriberToRenew}
        onConfirmRenewal={handleConfirmRenewal}
      />

      <WhatsAppReminderModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => {
          setIsWhatsAppModalOpen(false);
          setSubscriberForWhatsApp(null);
        }}
        subscriber={subscriberForWhatsApp}
        settings={settings}
        defaultTab={whatsAppDefaultTab}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSubscriberForReceipt(null);
        }}
        subscriber={subscriberForReceipt}
        settings={settings}
        customAmount={receiptCustomAmount}
        receiptNumber={receiptPayment?.receiptNumber}
        receiptDate={receiptPayment?.date}
      />

      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => {
          setIsTicketModalOpen(false);
          setTicketToEdit(null);
          setTicketPrefillSubscriberId(null);
        }}
        ticketToEdit={ticketToEdit}
        initialSubscriberId={ticketPrefillSubscriberId}
        subscribers={subscribers}
        onSaveTicket={handleSaveTicket}
      />

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <PaymentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSubscriberForHistory(null);
        }}
        subscriber={subscriberForHistory}
        payments={payments}
        settings={settings}
        currentUser={currentUser}
        onAddPayment={handleAddPaymentFromHistory}
        onPrintReceipt={(sub, customAmt) => {
          setSubscriberForReceipt(sub);
          setReceiptCustomAmount(customAmt);
          setIsReceiptModalOpen(true);
        }}
        onDeletePayment={handleDeletePayment}
      />

      <UserLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={staffUsers}
        currentUser={currentUser}
        onLoginSuccess={handleSwitchStaffUser}
      />

      <ProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => {
          setIsProviderModalOpen(false);
          setProviderToEdit(null);
        }}
        providerToEdit={providerToEdit}
        subscribers={subscribers}
        onSave={handleSaveProvider}
      />

      <TowerModal
        isOpen={isTowerModalOpen}
        onClose={() => {
          setIsTowerModalOpen(false);
          setTowerToEdit(null);
        }}
        towerToEdit={towerToEdit}
        subscribers={subscribers}
        onSave={handleSaveTower}
      />
    </div>
  );
}
