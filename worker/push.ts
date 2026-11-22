/**
 * إشعارات الخلفية (Web Push) بلا خدمة خارجية:
 * - كل جهاز يسجّل اشتراكه (endpoint) بعد تفعيل الجرس؛ المستلمون: المدير والمحاسب فقط
 * - cron يومي (07:00 بغداد) يحسب الملخص من بيانات D1 ويرسل «نبضة» فارغة موقّعة بـ VAPID
 * - المتصفح يستيقظ (حتى لو كان التطبيق مغلقاً أو مقفلاً) ويجلب النص من /api/push/digest
 * - مفاتيح VAPID تُنشأ تلقائياً عند أول استخدام وتُحفظ في جدول meta
 */
import { baghdadToday, computeDigest, digestText, worthSending, type Digest, type DigestSubscriber } from '../shared/digest';
import { generateVapidKeys, vapidAuthorization, type VapidKeys } from '../shared/vapid';

export const PUSH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS push_subs (
    endpoint_hash TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_ok INTEGER
  )`,
];

const MAX_PER_RUN = 40; // الخطة المجانية: 50 طلباً خارجياً لكل تشغيل
// خدمات الإشعارات المعروفة فقط (حتى لا يُستعمل الخادم لطلبات إلى عناوين أخرى)
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isAllowedEndpoint(endpoint: unknown, allowLocal: boolean): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 600) return false;
  try {
    const u = new URL(endpoint);
    if (allowLocal && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) return true;
    return u.protocol === 'https:' && PUSH_HOSTS.some(re => re.test(u.hostname));
  } catch {
    return false;
  }
}

async function readMeta(db: D1Database, key: string): Promise<string | null> {
  const r = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>();
  return r?.value ?? null;
}

export async function getVapid(db: D1Database): Promise<VapidKeys> {
  let jwk = await readMeta(db, 'vapid_private_jwk');
  let pub = await readMeta(db, 'vapid_public');
  if (!jwk || !pub) {
    const fresh = await generateVapidKeys();
    // INSERT OR IGNORE: لو أنشأ طلبان متزامنان مفاتيح، يفوز الأول ويقرأ الآخر مفتاحه
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('vapid_private_jwk', ?)`).bind(JSON.stringify(fresh.privateJwk)),
      db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('vapid_public', ?)`).bind(fresh.publicKey),
    ]);
    jwk = await readMeta(db, 'vapid_private_jwk');
    pub = await readMeta(db, 'vapid_public');
  }
  return { privateJwk: JSON.parse(jwk!), publicKey: pub! };
}

export async function savePushSubscription(db: D1Database, userId: string, role: string, endpoint: string, origin: string): Promise<void> {
  await db.batch([
    db.prepare(`INSERT INTO push_subs (endpoint_hash, endpoint, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(endpoint_hash) DO UPDATE SET user_id = excluded.user_id, role = excluded.role`)
      .bind(await sha256Hex(endpoint), endpoint, userId, role, Date.now()),
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('app_origin', ?)`).bind(origin),
  ]);
}

export async function removePushSubscription(db: D1Database, endpoint: string): Promise<void> {
  await db.prepare('DELETE FROM push_subs WHERE endpoint_hash = ?').bind(await sha256Hex(endpoint)).run();
}

interface SubRow { endpoint_hash: string; endpoint: string }

async function loadDigest(db: D1Database): Promise<{ digest: Digest; ispName: string }> {
  const { results } = await db.prepare(`SELECT data FROM records WHERE collection = 'subscribers' AND deleted = 0`).all<{ data: string }>();
  const subs = (results || []).map(r => { try { return JSON.parse(r.data) as DigestSubscriber; } catch { return {}; } });
  const settingsRow = await db.prepare(`SELECT data FROM records WHERE collection = 'settings' AND deleted = 0 LIMIT 1`).first<{ data: string }>();
  let warn = 3, ispName = 'أولاد كشيش';
  try {
    const st = settingsRow ? JSON.parse(settingsRow.data) : {};
    if (Number.isFinite(st.warningDaysBeforeExpiry)) warn = st.warningDaysBeforeExpiry;
    if (typeof st.ispName === 'string' && st.ispName.trim()) ispName = st.ispName.trim();
  } catch { /* الإعدادات الافتراضية */ }
  return { digest: computeDigest(subs, warn, baghdadToday()), ispName };
}

/** نص الإشعار لجهاز مسجّل (يطلبه الـ service worker عند وصول النبضة) */
export async function digestForDevice(db: D1Database, endpointHash: string): Promise<{ title: string; body: string } | null> {
  const row = await db.prepare('SELECT endpoint_hash FROM push_subs WHERE endpoint_hash = ?').bind(endpointHash).first();
  if (!row) return null;
  const { digest, ispName } = await loadDigest(db);
  return digestText(digest, ispName);
}

async function sendTickle(db: D1Database, keys: VapidKeys, row: SubRow, subject: string): Promise<number> {
  try {
    const res = await fetch(row.endpoint, {
      method: 'POST',
      headers: { Authorization: await vapidAuthorization(keys, row.endpoint, subject), TTL: '43200', Urgency: 'normal' },
    });
    if (res.status === 404 || res.status === 410) {
      await db.prepare('DELETE FROM push_subs WHERE endpoint_hash = ?').bind(row.endpoint_hash).run(); // الجهاز ألغى الاشتراك
    } else if (res.ok) {
      await db.prepare('UPDATE push_subs SET last_ok = ? WHERE endpoint_hash = ?').bind(Date.now(), row.endpoint_hash).run();
    }
    return res.status;
  } catch {
    return 0;
  }
}

async function subjectFor(db: D1Database): Promise<string> {
  return (await readMeta(db, 'app_origin')) || 'mailto:admin@example.com';
}

/** تجربة فورية لأجهزة المستخدم الحالي */
export async function sendTestToUser(db: D1Database, userId: string): Promise<number[]> {
  const { results } = await db.prepare('SELECT endpoint_hash, endpoint FROM push_subs WHERE user_id = ? LIMIT 10').bind(userId).all<SubRow>();
  const keys = await getVapid(db), subject = await subjectFor(db);
  return Promise.all((results || []).map(r => sendTickle(db, keys, r, subject)));
}

/** يعمل من cron يومياً: يرسل فقط إذا وُجد من ينتهي اشتراكه قريباً أو انتهى مؤخراً */
export async function runDailyPush(db: D1Database): Promise<{ sent: number; skipped: string | null }> {
  const { digest } = await loadDigest(db);
  if (!worthSending(digest)) return { sent: 0, skipped: 'لا تنبيهات اليوم' };
  const { results } = await db.prepare(`SELECT endpoint_hash, endpoint FROM push_subs WHERE role IN ('admin', 'accountant') LIMIT ${MAX_PER_RUN}`).all<SubRow>();
  if (!results?.length) return { sent: 0, skipped: 'لا توجد أجهزة مسجلة' };
  const keys = await getVapid(db), subject = await subjectFor(db);
  const codes = await Promise.all(results.map(r => sendTickle(db, keys, r, subject)));
  return { sent: codes.filter(c => c >= 200 && c < 300).length, skipped: null };
}
