// Service Worker: يجعل المنظومة قابلة للتثبيت وتفتح بسرعة حتى مع إنترنت ضعيف.
// - الصفحة الرئيسية: من الشبكة أولاً (حتى تصل التحديثات فوراً)، ومن النسخة المحفوظة عند انقطاع الإنترنت
// - ملفات /assets/ (أسماؤها تتغير مع كل نسخة): من النسخة المحفوظة أولاً
// - طلبات /api/ لا تُحفظ أبداً (بيانات حساسة وتتغير باستمرار)
const CACHE = 'sas-plus-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })),
    );
  }
});

// ---- إشعارات الخلفية (Web Push) ----
// يصل «نبض» فارغ من الخادم؛ نجلب النص (أرقام فقط) من /api/push/digest ثم نعرض الإشعار.
// إن فشل الجلب نعرض إشعاراً عاماً (المتصفح يشترط عرض إشعار عند كل نبض).
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title = 'أولاد كشيش';
    let body = 'لديك تنبيهات جديدة في المنظومة.';
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const res = await fetch('/api/push/digest?h=' + (await sha256Hex(sub.endpoint)), { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          title = d.title || title;
          body = d.body || body;
        }
      }
    } catch (e) { /* نعرض النص العام */ }
    await self.registration.showNotification(title, {
      body,
      tag: 'sas-digest',
      renotify: true,
      dir: 'rtl',
      lang: 'ar',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: '/' },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    }),
  );
});
