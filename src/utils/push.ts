import { PREVIEW_MODE, apiRequest } from '../sync/api';

/**
 * إشعارات الخلفية: تصل حتى لو كان التطبيق مغلقاً أو مقفلاً (يرسلها الخادم يومياً عبر cron).
 * على آيفون تعمل فقط بعد «إضافة إلى الشاشة الرئيسية».
 */

export type PushResult = { ok: true } | { ok: false; reason: string };

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

const toBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const sameKey = (a: ArrayBuffer | null, b: Uint8Array<ArrayBuffer>): boolean => {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
};

/** يسجّل هذا الجهاز لدى الخادم (آمن للتكرار: يعيد استخدام الاشتراك الموجود) */
export async function enablePush(): Promise<PushResult> {
  if (PREVIEW_MODE) return { ok: false, reason: 'غير متاح في وضع المعاينة.' };
  if (!isPushSupported()) {
    return { ok: false, reason: 'هذا المتصفح لا يدعم إشعارات الخلفية. على آيفون: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه منها.' };
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { ok: false, reason: 'لم يجهز التطبيق بعد. أعد تحميل الصفحة وحاول ثانية.' };
    const { key } = await apiRequest<{ key: string }>('/api/push/key');
    const serverKey = toBytes(key);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
      await sub.unsubscribe(); // مفتاح الخادم تغيّر: نبدأ اشتراكاً جديداً
      sub = null;
    }
    sub = sub || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey }));
    await apiRequest('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
    return { ok: true };
  } catch (e) {
    console.warn('push subscribe failed', e);
    const err = e as { name?: string; message?: string };
    if (err.name === 'NotAllowedError') return { ok: false, reason: 'لم تُمنح صلاحية الإشعارات لهذا الموقع. فعّلها من إعدادات المتصفح ثم اضغط الجرس.' };
    // رسائل الخادم (عربية) تُعرض كما هي؛ أخطاء المتصفح الإنجليزية تُستبدل برسالة مفهومة
    const msg = err.message || '';
    return { ok: false, reason: /[\u0600-\u06FF]/.test(msg) ? msg : 'تعذر الاتصال بخدمة الإشعارات. تأكد من الإنترنت وحاول بعد قليل.' };
  }
}

/** بعد الدخول: إن كانت الصلاحية ممنوحة نتأكد بصمت أن الجهاز ما زال مسجلاً لدى الخادم */
export async function refreshPush(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  await enablePush();
}

/** إشعار تجريبي فوري لأجهزة المستخدم؛ يعيد عدد الأجهزة التي قبلها الخادم */
export async function sendTestPush(): Promise<number> {
  const r = await apiRequest<{ results: number[] }>('/api/push/test', { method: 'POST', body: {} });
  return r.results.filter(c => c >= 200 && c < 300).length;
}
