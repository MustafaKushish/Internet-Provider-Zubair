export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired' | 'suspended';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssueType =
  | 'connection_problem'   // انقطاع الاتصال
  | 'billing_dispute'      // نزاع مالي أو مشكلة بالاشتراك
  | 'slow_speed'           // بطء في السرعة
  | 'router_config'        // إعدادات الراوتر
  | 'nanostation_signal'   // ضعف إشارة النانو
  | 'cable_fiber_cut'      // قطع كيبل أو فايبر
  | 'other';               // أخرى

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  username: string;
  password?: string;
  upstreamProvider: string;
  planName: string;
  costPrice: number;      // سعر الشراء من المزود (كلفة الجملة) بالدينار العراقي
  salePrice: number;      // سعر البيع للمشترك (رسوم الاشتراك)
  paidAmount: number;     // المبلغ المسدد في هذه الدورة
  startDate: string;      // YYYY-MM-DD
  expiryDate: string;     // YYYY-MM-DD
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  ipAddress?: string;
  macAddress?: string;
  towerName: string;      // البرج / السكتر / الكابينة
  address?: string;
  notes?: string;
  createdAt: string;
  lastPaymentDate?: string;
  cycleMonths?: number;    // عدد أشهر الدورة الحالية (افتراضياً 1)
  carriedDebt?: number;    // دين سابق مُرحَّل من الدورات السابقة
  currentCycleId?: string; // معرّف الدورة الحالية لربط الوصولات بها
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  subscriberId: string;
  subscriberName: string;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'zain_cash' | 'qi_card' | 'transfer';
  paymentType: 'renewal' | 'debt_installment' | 'initial' | 'addon';
  cycleMonths?: number;
  notes?: string;
  collectedBy?: string;
  remainingBalanceAfter?: number;
  costAmount?: number;     // كلفة الجملة المرتبطة بهذه الدفعة وقت تسجيلها
  provider?: string;       // المزود وقت الدفع (للتقارير حتى لو حُذف المشترك)
  towerName?: string;      // البرج وقت الدفع
  cycleId?: string;        // الدورة التي يتبع لها الوصل
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subscriberId: string;
  subscriberName: string;
  phone: string;
  towerName?: string;
  issueType: IssueType;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  technicianName?: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  reportedBy?: 'user' | 'support_staff';
}

export interface ProviderPlan {
  id: string;
  name: string;
  defaultCost: number;
  defaultSalePrice: number;
  speed?: string;
}

export interface UpstreamProvider {
  id: string;
  name: string;
  contact?: string;
  plans: ProviderPlan[];
}

export interface TowerPoint {
  id: string;
  name: string;
  location?: string;
  notes?: string;
  ipRange?: string;
}

export interface SystemSettings {
  ispName: string;
  agentName: string;
  contactPhone: string;
  address: string;
  currency: 'IQD' | 'USD';
  warningDaysBeforeExpiry: number;
  whatsappFooter: string;
}

export type ReportPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';

export interface ReportSummary {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;         // إجمالي الإيرادات المحصلة
  totalWholesaleCost: number;   // إجمالي كلفة المزودين
  totalNetProfit: number;       // صافي الأرباح
  totalTransactionsCount: number;
  activeUsersCount: number;     // عدد المشتركين النشطين
  overdueUsersCount: number;    // عدد الحسابات المتأخرة (Overdue)
  overdueTotalAmount: number;   // إجمالي المبالغ المتأخرة
  providerBreakdown: { provider: string; revenue: number; cost: number; profit: number; count: number }[];
  towerBreakdown: { tower: string; userCount: number; revenue: number }[];
}

export type UserRole = 'admin' | 'accountant' | 'technician';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  password?: string;      // تُستخدم فقط عند إرسال كلمة مرور جديدة للخادم، ولا تُحفظ في المتصفح
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword?: boolean; // إجبار تغيير كلمة المرور عند أول دخول
}

