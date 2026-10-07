import { StaffUser } from '../types/isp';

// عنوان الخادم: نفس الموقع افتراضياً، ويمكن تغييره عند البناء عبر VITE_API_BASE
const API_BASE: string = (import.meta as any).env?.VITE_API_BASE || '';
const TOKEN_KEY = 'sas_plus_api_token_v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public offline = false) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // التخزين غير متاح
  }
}

export async function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'لا يوجد اتصال بالخادم. تحقق من الإنترنت.', true);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ليس JSON (مثلاً صفحة خطأ من الشبكة)
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `خطأ من الخادم (${res.status})`, res.status >= 502 && res.status <= 504);
  }
  return data as T;
}

type AuthResult = { token: string; user: StaffUser };

export const authApi = {
  status: () => apiRequest<{ ok: boolean; needsSetup: boolean }>('/api/status'),
  setup: (name: string, username: string, password: string) =>
    apiRequest<AuthResult>('/api/setup', { body: { name, username, password } }),
  login: (username: string, password: string) =>
    apiRequest<AuthResult>('/api/auth/login', { body: { username, password } }),
  logout: () => apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => apiRequest<{ user: StaffUser }>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ user: StaffUser }>('/api/auth/password', { body: { currentPassword, newPassword } }),
};

export const usersApi = {
  list: () => apiRequest<{ users: StaffUser[] }>('/api/users'),
  create: (u: Partial<StaffUser>) => apiRequest<{ users: StaffUser[] }>('/api/users', { body: u }),
  update: (id: string, u: Partial<StaffUser>) =>
    apiRequest<{ users: StaffUser[] }>(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body: u }),
  remove: (id: string) => apiRequest<{ users: StaffUser[] }>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/** تسجيل الدخول وحفظ رمز الجلسة */
export async function loginAndStore(username: string, password: string): Promise<StaffUser> {
  const res = await authApi.login(username, password);
  setToken(res.token);
  return res.user;
}
