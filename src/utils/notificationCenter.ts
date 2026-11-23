/**
 * سجل الإشعارات داخل المنظومة (نافذة الجرس). كل notify() يُسجَّل هنا أيضاً.
 * محلي على الجهاز (localStorage)، آخر 40 إشعاراً، والتكرار خلال دقيقة يُدمج في سطر واحد.
 * يحفظ أيضاً مفاتيح تنبيهات «الآن» التي شوهدت حتى لا تُحسب جديدة مرة أخرى.
 */
export type NoticeTone = 'info' | 'success' | 'error' | 'warning';

export interface Notice {
  id: number;
  message: string;
  tone: NoticeTone;
  at: number;
  read: boolean;
  /** كم مرة تكرر (دمج) */
  times?: number;
}

interface State {
  notices: Notice[];
  seenAlerts: string[];
}

const KEY = 'sas_plus_notice_log_v1';
const MAX = 40;
const MERGE_MS = 60_000;

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s && Array.isArray(s.notices)) return { notices: s.notices.slice(0, MAX), seenAlerts: Array.isArray(s.seenAlerts) ? s.seenAlerts : [] };
  } catch { /* تخزين غير متاح */ }
  return { notices: [], seenAlerts: [] };
}

let state: State = typeof window === 'undefined' ? { notices: [], seenAlerts: [] } : load();
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ممتلئ */ }
  listeners.forEach(l => l());
}

export const subscribeNotices = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getNoticeState = () => state;

/** يضيف إشعاراً؛ نفس النص خلال دقيقة = يُدمج ويصبح غير مقروء من جديد */
export function logNotice(message: string, tone: NoticeTone, now = Date.now()): void {
  const [first, ...rest] = state.notices;
  if (first && first.message === message && now - first.at < MERGE_MS) {
    set({ ...state, notices: [{ ...first, at: now, read: false, times: (first.times || 1) + 1 }, ...rest] });
    return;
  }
  const id = Math.max(0, ...state.notices.map(n => n.id)) + 1;
  set({ ...state, notices: [{ id, message, tone, at: now, read: false }, ...state.notices].slice(0, MAX) });
}

/** يعلّم كل الإشعارات مقروءة ويحفظ مفاتيح التنبيهات المعروضة كمشاهدة */
export function markAllSeen(alertKeys: string[]): void {
  const unread = state.notices.some(n => !n.read);
  const newKeys = alertKeys.filter(k => !state.seenAlerts.includes(k));
  if (!unread && !newKeys.length) return;
  set({ notices: state.notices.map(n => (n.read ? n : { ...n, read: true })), seenAlerts: [...newKeys, ...state.seenAlerts].slice(0, 60) });
}

export function removeNotice(id: number): void {
  set({ ...state, notices: state.notices.filter(n => n.id !== id) });
}

export function clearNotices(): void {
  set({ ...state, notices: [] });
}

/** عدد الجديد: إشعارات غير مقروءة + تنبيهات لم تُشاهد بعد */
export function unseenCount(s: State, alertKeys: string[]): number {
  return s.notices.filter(n => !n.read).length + alertKeys.filter(k => !s.seenAlerts.includes(k)).length;
}

/** «قبل 5 د» / «قبل ساعتين» / «أمس» */
export function timeAgoAr(at: number, now = Date.now()): string {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} د`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : `قبل ${h} ${h <= 10 ? 'ساعات' : 'ساعة'}`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'أمس' : d === 2 ? 'قبل يومين' : `قبل ${d} ${d <= 10 ? 'أيام' : 'يوماً'}`;
}
