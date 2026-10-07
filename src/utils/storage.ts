import {
  Subscriber,
  PaymentRecord,
  SupportTicket,
  UpstreamProvider,
  SystemSettings,
  SubscriptionStatus,
  PaymentStatus,
  ReportPeriod,
  ReportSummary,
  StaffUser
} from '../types/isp';
import {
  INITIAL_SUBSCRIBERS,
  INITIAL_PAYMENTS,
  INITIAL_TICKETS,
  INITIAL_PROVIDERS,
  INITIAL_SETTINGS,
  INITIAL_STAFF_USERS,
  INITIAL_TOWERS
} from '../data/initialData';
import { TowerPoint } from '../types/isp';
import * as XLSX from 'xlsx';
import { toLocalDateStr, todayStr, parseLocalDate, diffDays } from './dates';

// Clean production storage keys for شبكة أولاد كشيش لخدمات الإنترنت (البصرة - الزبير)
const SUBSCRIBERS_KEY = 'sas_plus_subscribers_kashish_v1';
const PAYMENTS_KEY = 'sas_plus_payments_kashish_v1';
const TICKETS_KEY = 'sas_plus_tickets_kashish_v1';
const PROVIDERS_KEY = 'sas_plus_providers_kashish_v1';
const TOWERS_KEY = 'sas_plus_towers_kashish_v1';
const SETTINGS_KEY = 'sas_plus_settings_kashish_v1';
const ACTIVE_USER_KEY = 'sas_plus_active_user_kashish_v1';

// Purge any legacy demo mock data from earlier tests
const LEGACY_KEYS = [
  'sas_plus_subscribers_v1',
  'sas_plus_subscribers_v2',
  'sas_plus_subscribers_v3',
  'sas_plus_payments_v1',
  'sas_plus_payments_v2',
  'sas_plus_payments_v3',
  'sas_plus_tickets_v1',
  'sas_plus_tickets_v2',
  'sas_plus_tickets_v3',
  'sas_plus_subscribers',
  'sas_plus_payments',
  'sas_plus_tickets',
  'isp_subscribers',
  'isp_payments',
  'isp_tickets',
  // قائمة الموظفين القديمة كانت تحفظ كلمات المرور كنص واضح في المتصفح؛ أصبحت على الخادم
  'sas_plus_staff_users_kashish_v1',
];
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
  }
} catch (e) {
  // Ignore in SSR
}

export function calculateSubscriptionStatus(expiryDate: string, warningDays: number = 3): SubscriptionStatus {
  if (!expiryDate) return 'expired';
  const daysLeft = getDaysRemaining(expiryDate);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= warningDays) return 'expiring_soon';
  return 'active';
}

/** المبلغ المستحق في الدورة الحالية = سعر البيع × عدد الأشهر + الدين المُرحَّل */
export function getAmountDue(s: Pick<Subscriber, 'salePrice' | 'cycleMonths' | 'carriedDebt'>): number {
  return (s.salePrice || 0) * (s.cycleMonths && s.cycleMonths > 0 ? s.cycleMonths : 1) + (s.carriedDebt || 0);
}

/** المتبقي بذمة المشترك */
export function getRemainingDebt(s: Pick<Subscriber, 'salePrice' | 'cycleMonths' | 'carriedDebt' | 'paidAmount'>): number {
  return Math.max(0, getAmountDue(s) - (s.paidAmount || 0));
}

/**
 * حالة الدفع:
 * - مدفوع: المسدد >= المستحق
 * - قيد الدفع: دفع جزءاً، أو لم يدفع بعد لكن الاشتراك ما زال سارياً
 * - متأخر: لم يسدد كامل المستحق والاشتراك منتهٍ
 */
export function calculatePaymentStatus(paidAmount: number, amountDue: number, expiryDate?: string): PaymentStatus {
  if ((paidAmount || 0) >= (amountDue || 0)) return 'paid';
  if (expiryDate && getDaysRemaining(expiryDate) < 0) return 'overdue';
  return 'pending';
}

/** يعيد حساب حالة الاشتراك والدفع لمشترك واحد */
export function refreshSubscriberStatus(s: Subscriber, warningDays: number = 3): Subscriber {
  return {
    ...s,
    status: s.status === 'suspended' ? 'suspended' : calculateSubscriptionStatus(s.expiryDate, warningDays),
    paymentStatus: calculatePaymentStatus(s.paidAmount, getAmountDue(s), s.expiryDate),
  };
}

export function getDaysRemaining(expiryDate: string): number {
  if (!expiryDate) return 0;
  return diffDays(todayStr(), expiryDate);
}

// Storage loaders for Subscribers
// نميّز بين "لا توجد بيانات محفوظة" (أول تشغيل) و"قائمة فارغة محفوظة عمداً" (بعد المسح)
export function loadSubscribers(warningDays: number = 3): Subscriber[] {
  try {
    const raw = localStorage.getItem(SUBSCRIBERS_KEY);
    if (raw === null) return INITIAL_SUBSCRIBERS;
    const subs: Subscriber[] = JSON.parse(raw);
    if (!Array.isArray(subs)) return INITIAL_SUBSCRIBERS;
    return subs.map(s => refreshSubscriberStatus(s, warningDays));
  } catch (e) {
    console.error('Error loading subscribers:', e);
    return INITIAL_SUBSCRIBERS;
  }
}

export function saveSubscribers(subscribers: Subscriber[]): void {
  try {
    localStorage.setItem(SUBSCRIBERS_KEY, JSON.stringify(subscribers));
  } catch (e) {
    console.error('Error saving subscribers:', e);
  }
}

// Storage loaders for Payments
export function loadPayments(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    if (raw === null) return INITIAL_PAYMENTS;
    const payments: PaymentRecord[] = JSON.parse(raw);
    return Array.isArray(payments) ? payments : INITIAL_PAYMENTS;
  } catch (e) {
    return INITIAL_PAYMENTS;
  }
}

export function savePayments(payments: PaymentRecord[]): void {
  try {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
  } catch (e) {
    console.error('Error saving payments:', e);
  }
}

// Storage loaders for Tickets
export function loadTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(TICKETS_KEY);
    return raw ? JSON.parse(raw) : INITIAL_TICKETS;
  } catch (e) {
    return INITIAL_TICKETS;
  }
}

export function saveTickets(tickets: SupportTicket[]): void {
  try {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  } catch (e) {
    console.error('Error saving tickets:', e);
  }
}

// Storage loaders for Providers
export function loadProviders(): UpstreamProvider[] {
  try {
    const raw = localStorage.getItem(PROVIDERS_KEY);
    return raw ? JSON.parse(raw) : INITIAL_PROVIDERS;
  } catch (e) {
    return INITIAL_PROVIDERS;
  }
}

export function saveProviders(providers: UpstreamProvider[]): void {
  try {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
  } catch (e) {
    console.error('Error saving providers:', e);
  }
}

// Storage loaders for Towers & Transmission Points
export function loadTowers(): TowerPoint[] {
  try {
    const raw = localStorage.getItem(TOWERS_KEY);
    if (raw === null) return INITIAL_TOWERS;
    const parsed: TowerPoint[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TOWERS;
  } catch (e) {
    return INITIAL_TOWERS;
  }
}

export function saveTowers(towers: TowerPoint[]): void {
  try {
    localStorage.setItem(TOWERS_KEY, JSON.stringify(towers));
  } catch (e) {
    console.error('Error saving towers:', e);
  }
}

// Storage loaders for Settings
export function loadSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return INITIAL_SETTINGS;
    const parsed = JSON.parse(raw);
    // دمج مع القيم الافتراضية حتى لا تنقص حقول أضيفت لاحقاً
    return { ...INITIAL_SETTINGS, ...parsed };
  } catch (e) {
    return INITIAL_SETTINGS;
  }
}

export function saveSettings(settings: SystemSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

// Storage loader for Active Logged-in Staff User
export function loadActiveStaffUser(): StaffUser {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (!raw) return INITIAL_STAFF_USERS[0];
    const parsed: StaffUser = JSON.parse(raw);
    if (!parsed) return INITIAL_STAFF_USERS[0];
    // نسخ قديمة كانت تحفظ كلمة المرور هنا؛ لا نبقيها في المتصفح
    const { password: _pw, ...rest } = parsed;
    return rest as StaffUser;
  } catch (e) {
    return INITIAL_STAFF_USERS[0];
  }
}

export function saveActiveStaffUser(user: StaffUser): void {
  try {
    const { password: _pw, ...rest } = user;
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(rest));
  } catch (e) {
    console.error('Error saving active user:', e);
  }
}

// أرقام وصولات تسلسلية بدون تكرار: REC-2026-00001
export function nextReceiptNumber(payments: PaymentRecord[], date: string = todayStr()): string {
  const prefix = `REC-${date.slice(0, 4)}-`;
  let max = 0;
  payments.forEach(p => {
    if (p.receiptNumber && p.receiptNumber.startsWith(prefix)) {
      const n = parseInt(p.receiptNumber.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(5, '0')}`;
}

// أرقام تذاكر تسلسلية: TKT-26-0001
export function nextTicketNumber(tickets: SupportTicket[]): string {
  const prefix = `TKT-${new Date().getFullYear().toString().slice(-2)}-`;
  let max = 0;
  tickets.forEach(t => {
    if (t.ticketNumber && t.ticketNumber.startsWith(prefix)) {
      const n = parseInt(t.ticketNumber.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/**
 * كلفة الجملة المرتبطة بدفعة:
 * - الوصولات الجديدة تحفظ الكلفة وقت التسجيل (costAmount)
 * - الوصولات القديمة: التجديد/الاشتراك الأولي = كلفة الباقة × عدد الأشهر، وأقساط الديون والإضافات بلا كلفة جديدة
 */
export function getPaymentCost(p: PaymentRecord, subscribers: Subscriber[]): number {
  if (typeof p.costAmount === 'number') return p.costAmount;
  if (p.paymentType !== 'renewal' && p.paymentType !== 'initial') return 0;
  const sub = subscribers.find(s => s.id === p.subscriberId);
  return sub ? sub.costPrice * (p.cycleMonths || 1) : 0;
}

// Format Iraqi currency (e.g. 35,000 د.ع)
export function formatCurrency(amount: number, currency: 'IQD' | 'USD' = 'IQD'): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US')}`;
  }
  return `${amount.toLocaleString('en-US')} د.ع`;
}

// Convert Iraqi phone to international WhatsApp link format
export function formatIraqiPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '964' + cleaned.substring(1);
  } else if (!cleaned.startsWith('964') && cleaned.length === 10) {
    cleaned = '964' + cleaned;
  }
  return cleaned;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatIraqiPhoneForWhatsApp(phone);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

// WhatsApp Message Templates
export function getWhatsAppTemplates(sub: Subscriber, settings: SystemSettings) {
  const days = getDaysRemaining(sub.expiryDate);
  const remainingDebt = getRemainingDebt(sub);
  const renewalAmount = sub.salePrice + remainingDebt;

  const expiryReminder = `مرحباً أخي العزيز ${sub.name} 🌹
نود تذكيرك بأن اشتراك الإنترنت الخاص بك (${sub.planName}) لدى (${settings.ispName}) سينتهي خلال ${days > 0 ? `${days} أيام` : 'اليوم'} بتاريخ (${sub.expiryDate}).
مبلغ التجديد: ${formatCurrency(sub.salePrice, settings.currency)}${remainingDebt > 0 ? `\nمتبقٍ بذمتكم من الدورة الحالية: ${formatCurrency(remainingDebt, settings.currency)}` : ''}
يرجى التجديد لضمان استمرار الخدمة دون انقطاع.

${settings.whatsappFooter}`;

  const expiredNotice = `عزيزي المشترك ${sub.name} ⚠️
نود إعلامك بأن اشتراك الإنترنت (${sub.planName}) لدى (${settings.ispName}) قد انتهى بتاريخ (${sub.expiryDate})، والحساب حالياً متأخر ومستحق الدفع.
مبلغ التجديد المطلوب: ${formatCurrency(renewalAmount, settings.currency)}
يرجى تسديد الاشتراك ليتم تفعيل الخدمة فوراً.

${settings.whatsappFooter}`;

  const debtReminder = `السلام عليكم أخي ${sub.name} 🌺
تنبيه بمستحقات مالية متأخرة لاشتراك الإنترنت لدى (${settings.ispName}):
المبلغ المطلوب تسديده: ${formatCurrency(remainingDebt, settings.currency)}
نرجو منكم التكرم بالتسديد لتجنب إيقاف الخدمة.

مع فائق التقدير والاحترام،
${settings.ispName} - ${settings.contactPhone}`;

  const credentialsMessage = `مرحباً ${sub.name} 🔐
بيانات تسجيل الدخول الخاصة باشتراكك لدى (${settings.ispName}):
▫️ اسم المستخدم (User): ${sub.username}
▫️ كلمة المرور (Password): ${sub.password || 'غير محدد'}
▫️ نوع الباقة: ${sub.planName}
▫️ تاريخ الانتهاء: ${sub.expiryDate}
▫️ البرج / التغذية: ${sub.towerName}

يرجى الاحتفاظ بهذه البيانات في مكان آمن.
${settings.whatsappFooter}`;

  const paymentReceipt = `وصل استلام وتسديد إلكتروني 🧾
عزيزي المشترك ${sub.name}،
تم تسجيل دفعة مالية بقيمة: ${formatCurrency(sub.paidAmount, settings.currency)} لدى (${settings.ispName})
تاريخ التجديد والانتهاء: ${sub.expiryDate}
المتبقي بذمتكم: ${remainingDebt > 0 ? formatCurrency(remainingDebt, settings.currency) : '0 د.ع (خالص ومسدد)'}

نشكركم لثقتكم بنا،
${settings.ispName} - ${settings.contactPhone}`;

  return {
    expiryReminder,
    expiredNotice,
    debtReminder,
    credentialsMessage,
    paymentReceipt,
  };
}

// Generate Financial & Periodic Reports
export function generatePeriodReport(
  subscribers: Subscriber[],
  payments: PaymentRecord[],
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string
): ReportSummary {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  let periodLabel = 'هذا الشهر';

  if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    periodLabel = `هذا الشهر (${start.toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' })})`;
  } else if (period === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    periodLabel = `الشهر السابق (${start.toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' })})`;
  } else if (period === 'this_quarter') {
    const currentQ = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), currentQ * 3, 1);
    end = new Date(now.getFullYear(), (currentQ + 1) * 3, 0, 23, 59, 59);
    periodLabel = `الربع الحالي (Q${currentQ + 1} - ${now.getFullYear()})`;
  } else if (period === 'last_quarter') {
    const currentQ = Math.floor(now.getMonth() / 3);
    const lastQ = currentQ === 0 ? 3 : currentQ - 1;
    const year = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
    start = new Date(year, lastQ * 3, 1);
    end = new Date(year, (lastQ + 1) * 3, 0, 23, 59, 59);
    periodLabel = `الربع السابق (Q${lastQ + 1} - ${year})`;
  } else if (period === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    periodLabel = `العام المالي الحالي (${now.getFullYear()})`;
  } else if (period === 'custom' && customStart && customEnd) {
    start = parseLocalDate(customStart);
    end = parseLocalDate(customEnd);
    periodLabel = `فترة مخصصة من ${customStart} إلى ${customEnd}`;
  }

  const startStr = toLocalDateStr(start);
  const endStr = toLocalDateStr(end);

  const periodPayments = payments.filter(p => p.date >= startStr && p.date <= endStr);
  const totalRevenue = periodPayments.reduce((acc, p) => acc + p.amount, 0);

  const activeUsersCount = subscribers.filter(s => s.status === 'active' || s.status === 'expiring_soon').length;
  const overdueUsers = subscribers.filter(s => s.paymentStatus === 'overdue' || (s.status === 'expired' && getRemainingDebt(s) > 0));
  const overdueUsersCount = overdueUsers.length;
  const overdueTotalAmount = overdueUsers.reduce((acc, s) => acc + getRemainingDebt(s), 0);

  // الكلفة تُحسب لكل دفعة (وليس لكل مشترك)، بدون أي تقدير وهمي
  const totalWholesaleCost = periodPayments.reduce((acc, p) => acc + getPaymentCost(p, subscribers), 0);
  const totalNetProfit = totalRevenue - totalWholesaleCost;

  const DELETED_LABEL = 'غير محدد (مشترك محذوف)';
  const providerMap: Record<string, { revenue: number; cost: number; count: number }> = {};
  const towerMap: Record<string, { userCount: number; revenue: number }> = {};

  subscribers.forEach(s => {
    if (!providerMap[s.upstreamProvider]) providerMap[s.upstreamProvider] = { revenue: 0, cost: 0, count: 0 };
    providerMap[s.upstreamProvider].count += 1;
    if (!towerMap[s.towerName]) towerMap[s.towerName] = { userCount: 0, revenue: 0 };
    towerMap[s.towerName].userCount += 1;
  });

  // توزيع كل الدفعات (جميعها وليس أول دفعة فقط) حتى تتطابق المجاميع مع إجمالي الإيرادات
  periodPayments.forEach(p => {
    const sub = subscribers.find(s => s.id === p.subscriberId);
    const provider = p.provider || sub?.upstreamProvider || DELETED_LABEL;
    const tower = p.towerName || sub?.towerName || DELETED_LABEL;
    if (!providerMap[provider]) providerMap[provider] = { revenue: 0, cost: 0, count: 0 };
    providerMap[provider].revenue += p.amount;
    providerMap[provider].cost += getPaymentCost(p, subscribers);
    if (!towerMap[tower]) towerMap[tower] = { userCount: 0, revenue: 0 };
    towerMap[tower].revenue += p.amount;
  });

  const providerBreakdown = Object.entries(providerMap).map(([provider, data]) => ({
    provider,
    revenue: data.revenue,
    cost: data.cost,
    profit: data.revenue - data.cost,
    count: data.count,
  }));

  const towerBreakdown = Object.entries(towerMap).map(([tower, data]) => ({
    tower,
    userCount: data.userCount,
    revenue: data.revenue,
  }));

  return {
    periodLabel,
    startDate: startStr,
    endDate: endStr,
    totalRevenue,
    totalWholesaleCost,
    totalNetProfit,
    totalTransactionsCount: periodPayments.length,
    activeUsersCount,
    overdueUsersCount,
    overdueTotalAmount,
    providerBreakdown,
    towerBreakdown,
  };
}

// Export to Excel (XLSX)
export function exportSubscribersToExcel(subscribers: Subscriber[], filename = 'مشتركي_الإنترنت.xlsx'): void {
  const data = subscribers.map((s, idx) => ({
    'ت': idx + 1,
    'اسم المشترك': s.name,
    'رقم الهاتف': s.phone,
    'اسم المستخدم (User)': s.username,
    'كلمة المرور (Pass)': s.password || '',
    'المزود الرئيسي': s.upstreamProvider,
    'الباقة': s.planName,
    'كلفة الشراء (الجملة)': s.costPrice,
    'سعر البيع': s.salePrice,
    'الربح الصافي': s.salePrice - s.costPrice,
    'المبلغ المدفوع': s.paidAmount,
    'المستحق للدورة': getAmountDue(s),
    'المتبقي (المتأخر/الدين)': getRemainingDebt(s),
    'تاريخ البدء': s.startDate,
    'تاريخ الانتهاء': s.expiryDate,
    'الأيام المتبقية': getDaysRemaining(s.expiryDate),
    'حالة الاشتراك': s.status === 'active' ? 'نشط' : s.status === 'expiring_soon' ? 'قريب الانتهاء' : s.status === 'expired' ? 'منتهي' : 'معلق',
    'حالة الدفع': s.paymentStatus === 'paid' ? 'مدفوع' : s.paymentStatus === 'pending' ? 'قيد الدفع (جزئي)' : 'متأخر (Overdue)',
    'البرج / النقطة': s.towerName,
    'آي بي': s.ipAddress || '',
    'ماك': s.macAddress || '',
    'العنوان': s.address || '',
    'ملاحظات': s.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'المشتركين');
  XLSX.writeFile(workbook, filename);
}

// Export Period Report to Excel
export function exportReportToExcel(report: ReportSummary, filename = 'تقرير_الأرباح_والإيرادات.xlsx'): void {
  const summaryData = [
    { 'البيان': 'الفترة الزمنية', 'القيمة': report.periodLabel },
    { 'البيان': 'من تاريخ', 'القيمة': report.startDate },
    { 'البيان': 'إلى تاريخ', 'القيمة': report.endDate },
    { 'البيان': 'إجمالي الإيرادات المحصلة', 'القيمة': report.totalRevenue },
    { 'البيان': 'إجمالي كلفة المزودين (الجملة)', 'القيمة': report.totalWholesaleCost },
    { 'البيان': 'صافي الأرباح المحققة', 'القيمة': report.totalNetProfit },
    { 'البيان': 'عدد المشتركين النشطين', 'القيمة': report.activeUsersCount },
    { 'البيان': 'عدد الحسابات المتأخرة (Overdue)', 'القيمة': report.overdueUsersCount },
    { 'البيان': 'إجمالي المبالغ المتأخرة بالسوق', 'القيمة': report.overdueTotalAmount },
    { 'البيان': 'عدد عمليات الدفع المسجلة', 'القيمة': report.totalTransactionsCount },
  ];

  const providersData = report.providerBreakdown.map(p => ({
    'المزود الرئيسي': p.provider,
    'عدد المشتركين': p.count,
    'الإيرادات المحصلة': p.revenue,
    'كلفة الجملة': p.cost,
    'صافي الربح': p.profit,
  }));

  const towersData = report.towerBreakdown.map(t => ({
    'البرج / النقطة': t.tower,
    'عدد المشتركين': t.userCount,
    'إجمالي الإيراد': t.revenue,
  }));

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  const providersSheet = XLSX.utils.json_to_sheet(providersData);
  const towersSheet = XLSX.utils.json_to_sheet(towersData);

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص العام');
  XLSX.utils.book_append_sheet(workbook, providersSheet, 'حسب المزود');
  XLSX.utils.book_append_sheet(workbook, towersSheet, 'حسب الأبراج');

  XLSX.writeFile(workbook, filename);
}

// Import from Excel file
function formatExcelDate(raw: any, defaultDays = 30): string {
  const fallback = () => {
    const d = new Date();
    d.setDate(d.getDate() + defaultDays);
    return toLocalDateStr(d);
  };
  if (raw === undefined || raw === null || raw === '') return fallback();

  // خلية تاريخ (cellDates: true) تأتي ككائن Date
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return fallback();
    // تقريب لأقرب منتصف ليل محلي لتفادي انزياح اليوم بسبب فروقات التوقيت في SheetJS
    return toLocalDateStr(new Date(raw.getTime() + 12 * 3600 * 1000));
  }
  // رقم تسلسلي لإكسل (مثلاً 45290)
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    const utc = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
  }
  const str = String(raw).trim();
  // DD/MM/YYYY أو DD-MM-YYYY أو DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  // YYYY-MM-DD أو YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return toLocalDateStr(parsed);
  return fallback();
}

/** يرجع أول قيمة موجودة فعلاً (يقبل الصفر، ويتجاهل الفراغ) */
function pickCell(row: any, keys: string[]): any {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function pickText(row: any, keys: string[], fallback = ''): string {
  const v = pickCell(row, keys);
  return v === undefined ? fallback : String(v).trim();
}

function pickNumber(row: any, keys: string[], fallback: number): number {
  const v = pickCell(row, keys);
  if (v === undefined) return fallback;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return isNaN(n) ? fallback : n;
}

/** إعادة الصفر الأول لأرقام الهواتف العراقية التي حوّلها إكسل إلى رقم (7701234567 → 07701234567) */
function normalizeIraqiPhone(raw: any): string {
  if (raw === undefined || raw === null) return '';
  let p = String(raw).trim().replace(/\s+/g, '');
  if (/^7\d{9}$/.test(p)) p = '0' + p;
  return p;
}

/** مفتاح مقارنة الأسماء: يتجاهل المسافات والهمزات والتاء المربوطة حتى لا يُستورد المشترك مرتين */
export function normalizeNameKey(name: string): string {
  return (name || '')
    .trim()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652ـ]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function parseExcelSubscribers(file: File): Promise<Partial<Subscriber>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        const parsed: Partial<Subscriber>[] = rows.map((row, idx) => {
          const ipAddress = pickText(row, ['آي بي', 'الاي بي', 'عنوان IP', 'IP', 'ip', 'IP Address']);
          const macAddress = pickText(row, ['ماك', 'الماك', 'MAC', 'mac', 'MAC Address']);
          const address = pickText(row, ['العنوان', 'المنطقة', 'السكن', 'Address', 'address']);

          return {
            name: pickText(row, ['اسم المشترك', 'الاسم', 'الاسم الكامل', 'Name', 'name', 'Customer'], `مشترك ${idx + 1}`),
            phone: normalizeIraqiPhone(pickCell(row, ['رقم الهاتف', 'الهاتف', 'الموبايل', 'Phone', 'phone', 'Mobile'])),
            username: pickText(row, ['اسم المستخدم (User)', 'اسم المستخدم', 'اليوزر', 'User', 'Username', 'username', 'PPPoE']),
            // لا نضع كلمة مرور افتراضية مكشوفة؛ تبقى فارغة إذا لم تكن في الملف
            password: pickText(row, ['كلمة المرور (Pass)', 'كلمة المرور', 'الباسورد', 'Password', 'password', 'pass']),
            costPrice: pickNumber(row, ['كلفة الشراء (الجملة)', 'كلفة الشراء', 'كلفة المزود', 'سعر الجملة', 'Cost', 'cost'], 24000),
            salePrice: pickNumber(row, ['سعر البيع', 'السعر', 'قيمة الاشتراك', 'الاشتراك', 'Price', 'price'], 35000),
            paidAmount: pickNumber(row, ['المبلغ المدفوع', 'المدفوع', 'الواصل', 'Paid', 'paid'], 0),
            carriedDebt: pickNumber(row, ['دين سابق', 'الدين السابق', 'ديون سابقة', 'Debt', 'debt'], 0),
            upstreamProvider: pickText(row, ['المزود الرئيسي', 'المزود', 'الشركة', 'الوكيل', 'سيرفر', 'Provider', 'provider'], 'إيرثلنك (Earthlink)'),
            planName: pickText(row, ['الباقة', 'نوع الباقة', 'النوع', 'Plan', 'plan'], 'ستاندرد (Standard)'),
            towerName: pickText(row, ['البرج / النقطة', 'البرج', 'السكتر', 'الكابينة', 'Tower', 'tower']),
            ipAddress: ipAddress || undefined,
            macAddress: macAddress || undefined,
            startDate: formatExcelDate(pickCell(row, ['تاريخ البدء', 'تاريخ التفعيل', 'Start Date', 'start_date']), 0),
            expiryDate: formatExcelDate(pickCell(row, ['تاريخ الانتهاء', 'تاريخ التجديد', 'نهاية الاشتراك', 'Expiry Date', 'expiry_date']), 30),
            address: address || undefined,
            notes: pickText(row, ['ملاحظات', 'تفاصيل', 'Notes', 'notes'], 'مستورد من ملف إكسل'),
          };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
