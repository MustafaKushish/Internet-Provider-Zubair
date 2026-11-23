/**
 * الصلاحيات في مكان واحد: يستخدمها المتصفح (src) والخادم (worker) معاً،
 * فلا يمكن أن يختلف ما تعرضه الواجهة عمّا يسمح به الخادم.
 * لا تستورد هنا شيئاً من src أو worker.
 */

export type Role = 'admin' | 'accountant' | 'technician';
export const ROLES: readonly Role[] = ['admin', 'accountant', 'technician'];

export const ALL_ROLES: Role[] = ['admin', 'accountant', 'technician'];
/** المكتب: المدير والمحاسب (الفني لا يرى الأموال) */
export const OFFICE_ROLES: Role[] = ['admin', 'accountant'];
export const ADMIN_ONLY: Role[] = ['admin'];

export const isRole = (r: unknown): r is Role => typeof r === 'string' && (ROLES as readonly string[]).includes(r);

// ---------- أقسام الواجهة ----------

export const TAB_ACCESS: Record<string, Role[]> = {
  home: ALL_ROLES,
  more: ALL_ROLES,
  subscribers: ALL_ROLES,
  reminders: ALL_ROLES,
  tickets: ALL_ROLES,
  towers: ALL_ROLES,
  dashboard: OFFICE_ROLES,
  reports: OFFICE_ROLES,
  providers: OFFICE_ROLES,
  advisor: OFFICE_ROLES,
  cash: OFFICE_ROLES,
  debts: OFFICE_ROLES,
  marketing: OFFICE_ROLES,
  users: ADMIN_ONLY,
  settings: ADMIN_ONLY,
};

export const canAccessTab = (role: Role, tab: string): boolean => (TAB_ACCESS[tab] || []).includes(role);

// ---------- مجموعات البيانات ----------

export type Collection = 'subscribers' | 'payments' | 'tickets' | 'providers' | 'towers' | 'settings' | 'expenses';
export const COLLECTION_NAMES: Collection[] = ['subscribers', 'payments', 'tickets', 'providers', 'towers', 'settings', 'expenses'];

/** من يحق له الإنشاء / التعديل / الحذف في كل مجموعة (الخادم يفرضها، والواجهة تستعملها لإخفاء الأزرار) */
export const COLLECTION_RULES: Record<Collection, { create: Role[]; update: Role[]; delete: Role[] }> = {
  subscribers: { create: ALL_ROLES, update: ALL_ROLES, delete: ADMIN_ONLY },
  payments: { create: ALL_ROLES, update: OFFICE_ROLES, delete: ADMIN_ONLY },
  tickets: { create: ALL_ROLES, update: ALL_ROLES, delete: ALL_ROLES },
  providers: { create: OFFICE_ROLES, update: OFFICE_ROLES, delete: OFFICE_ROLES },
  towers: { create: OFFICE_ROLES, update: OFFICE_ROLES, delete: OFFICE_ROLES },
  settings: { create: ADMIN_ONLY, update: ADMIN_ONLY, delete: [] },
  // المصاريف التشغيلية (إيجار، مولد، رواتب…): يسجلها المكتب، والحذف للمدير فقط
  expenses: { create: OFFICE_ROLES, update: OFFICE_ROLES, delete: ADMIN_ONLY },
};

/** مجموعات مالية لا تُرسل لهذه الأدوار عند السحب */
export const HIDDEN_FROM: Partial<Record<Collection, Role[]>> = {
  expenses: ['technician'],
};
