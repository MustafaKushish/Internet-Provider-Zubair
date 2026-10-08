/**
 * واجهة المزامنة لمنظومة ساس بلس على Cloudflare Workers + D1
 *
 * - تسجيل الدخول والصلاحيات تُفحص هنا على الخادم (لا في المتصفح)
 * - كلمات مرور الموظفين محفوظة كـ PBKDF2 (لا تُرسل للمتصفح أبداً)
 * - البيانات (مشتركين، وصولات، تذاكر، مزودين، أبراج، إعدادات) تُخزَّن كسجلات JSON
 *   لكل منها رقم نسخة متصاعد، والأجهزة تسحب ما تغيّر منذ آخر رقم رأته
 */

import { handleAdvisorChat } from './advisor';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  ANTHROPIC_API_KEY?: string; // سرّ في Cloudflare للمستشار الذكي
}

type Role = 'admin' | 'accountant' | 'technician';
type Collection = 'subscribers' | 'payments' | 'tickets' | 'providers' | 'towers' | 'settings';

const ALL: Role[] = ['admin', 'accountant', 'technician'];

// من يحق له الإنشاء / التعديل / الحذف في كل مجموعة
const RULES: Record<Collection, { create: Role[]; update: Role[]; delete: Role[] }> = {
  subscribers: { create: ALL, update: ALL, delete: ['admin'] },
  payments: { create: ALL, update: ['admin', 'accountant'], delete: ['admin'] },
  tickets: { create: ALL, update: ALL, delete: ALL },
  providers: { create: ['admin', 'accountant'], update: ['admin', 'accountant'], delete: ['admin', 'accountant'] },
  towers: { create: ['admin', 'accountant'], update: ['admin', 'accountant'], delete: ['admin', 'accountant'] },
  settings: { create: ['admin'], update: ['admin'], delete: [] },
};

const SESSION_HOURS = 24;
// الخطة المجانية في Cloudflare تسمح بـ 10ms من وقت المعالج لكل طلب؛ 5000 دورة ≈ 3ms.
// الحماية من التخمين يوفرها أيضاً قفل الحساب بعد 10 محاولات خاطئة.
const PBKDF2_ITERATIONS = 5_000;
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;
const MAX_CHANGES_PER_PUSH = 20; // الخطة المجانية: 50 استعلاماً لكل طلب
const MAX_RECORD_BYTES = 100_000;
const PULL_LIMIT = 200;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_failures (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    count INTEGER NOT NULL,
    last_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT,
    PRIMARY KEY (collection, id)
  )`,
  `CREATE INDEX IF NOT EXISTS records_version ON records(version)`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '0')`,
  `INSERT OR IGNORE INTO meta (key, value) VALUES ('epoch', lower(hex(randomblob(8))))`,
  `CREATE TABLE IF NOT EXISTS ai_usage (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)
  )`,
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map(s => db.prepare(s))).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

// ---------- أدوات عامة ----------

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'طلب غير صالح.');
  }
}

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function pbkdf2(password: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toHex(bits);
}

/** يُخزَّن عدد الدورات مع الهاش (pbkdf2$5000$...) حتى يمكن تغييره لاحقاً دون كسر الحسابات */
async function hashPassword(password: string, saltHex: string): Promise<string> {
  return `pbkdf2$${PBKDF2_ITERATIONS}$${await pbkdf2(password, saltHex, PBKDF2_ITERATIONS)}`;
}

async function verifyPassword(password: string, saltHex: string, stored: string): Promise<boolean> {
  const m = /^pbkdf2\$(\d+)\$([0-9a-f]+)$/.exec(stored);
  const iterations = m ? Number(m[1]) : 100_000; // صيغة قديمة بدون بادئة
  const expected = m ? m[2] : stored;
  return timingSafeEqual(await pbkdf2(password, saltHex, iterations), expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function validatePassword(pw: unknown): string {
  const p = typeof pw === 'string' ? pw.trim() : '';
  if (p.length < 8) throw new HttpError(400, 'يجب أن تتكون كلمة المرور من 8 خانات على الأقل.');
  if (p.length > 200) throw new HttpError(400, 'كلمة المرور طويلة جداً.');
  return p;
}

function validateRole(r: unknown): Role {
  if (r === 'admin' || r === 'accountant' || r === 'technician') return r;
  throw new HttpError(400, 'الدور غير صالح.');
}

// ---------- المستخدمون والجلسات ----------

interface UserRow {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  password_salt: string;
  role: Role;
  phone: string | null;
  is_active: number;
  must_change_password: number;
  created_at: string;
  last_login: string | null;
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    phone: u.phone || '',
    isActive: !!u.is_active,
    mustChangePassword: !!u.must_change_password,
    createdAt: u.created_at,
    lastLogin: u.last_login || undefined,
  };
}

async function createSession(db: D1Database, userId: string) {
  const token = randomHex(32);
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256(token), userId, now + SESSION_HOURS * 3600_000),
    db.prepare('UPDATE staff_users SET last_login = ? WHERE id = ?').bind(new Date(now).toISOString(), userId),
  ]);
  return token;
}

async function authenticate(req: Request, db: D1Database): Promise<{ user: UserRow; tokenHash: string }> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'يجب تسجيل الدخول.');
  const tokenHash = await sha256(token);
  const user = await db
    .prepare(`SELECT u.* FROM sessions s JOIN staff_users u ON u.id = s.user_id
              WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(tokenHash, Date.now())
    .first<UserRow>();
  if (!user || !user.is_active) throw new HttpError(401, 'انتهت الجلسة، يرجى تسجيل الدخول من جديد.');
  return { user, tokenHash };
}

function requireAdmin(user: UserRow) {
  if (user.role !== 'admin') throw new HttpError(403, 'هذه العملية مخصصة للمدير العام فقط.');
}

async function countUsers(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM staff_users').first<{ n: number }>();
  return r?.n ?? 0;
}

async function handleSetup(req: Request, db: D1Database) {
  const body = await readJson<{ name?: string; username?: string; password?: string }>(req);
  const username = (body.username || '').trim();
  const name = (body.name || '').trim() || 'المدير العام';
  if (!username) throw new HttpError(400, 'اسم المستخدم مطلوب.');
  const password = validatePassword(body.password);
  if ((await countUsers(db)) > 0) throw new HttpError(409, 'تم إعداد المنظومة مسبقاً.');

  const salt = randomHex(16);
  const id = `user_${randomHex(8)}`;
  // INSERT مشروط حتى لا ينجح طلبا إعداد متزامنان معاً
  const res = await db
    .prepare(`INSERT INTO staff_users (id, name, username, password_hash, password_salt, role, phone, is_active, must_change_password, created_at)
              SELECT ?, ?, ?, ?, ?, 'admin', '', 1, 0, ? WHERE NOT EXISTS (SELECT 1 FROM staff_users)`)
    .bind(id, name, username, await hashPassword(password, salt), salt, new Date().toISOString().slice(0, 10))
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'تم إعداد المنظومة مسبقاً.');
  const user = await db.prepare('SELECT * FROM staff_users WHERE id = ?').bind(id).first<UserRow>();
  return json({ token: await createSession(db, id), user: publicUser(user!) });
}

async function handleLogin(req: Request, db: D1Database) {
  const body = await readJson<{ username?: string; password?: string }>(req);
  const username = (body.username || '').trim();
  const password = (body.password || '').trim();
  if (!username || !password) throw new HttpError(400, 'أدخل اسم المستخدم وكلمة المرور.');

  const now = Date.now();
  const fail = await db.prepare('SELECT count, last_at FROM login_failures WHERE username = ?')
    .bind(username).first<{ count: number; last_at: number }>();
  if (fail && fail.count >= MAX_FAILED_LOGINS && now - fail.last_at < LOCKOUT_MINUTES * 60_000) {
    throw new HttpError(429, `محاولات دخول خاطئة كثيرة. حاول مجدداً بعد ${LOCKOUT_MINUTES} دقيقة.`);
  }

  const user = await db.prepare('SELECT * FROM staff_users WHERE username = ?').bind(username).first<UserRow>();
  const ok = user ? await verifyPassword(password, user.password_salt, user.password_hash) : false;
  if (!user || !ok) {
    const reset = !fail || now - fail.last_at >= LOCKOUT_MINUTES * 60_000;
    await db.prepare(`INSERT INTO login_failures (username, count, last_at) VALUES (?, 1, ?)
                      ON CONFLICT(username) DO UPDATE SET count = ${reset ? '1' : 'count + 1'}, last_at = excluded.last_at`)
      .bind(username, now).run();
    throw new HttpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة.');
  }
  if (!user.is_active) throw new HttpError(403, 'هذا الحساب معطل حالياً من قبل إدارة المنظومة.');

  await db.prepare('DELETE FROM login_failures WHERE username = ?').bind(username).run();
  const token = await createSession(db, user.id);
  return json({ token, user: publicUser({ ...user, last_login: new Date(now).toISOString() }) });
}

async function handleChangeOwnPassword(req: Request, db: D1Database, user: UserRow, tokenHash: string) {
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(req);
  // عند التغيير الإجباري (أول دخول) تكفي الجلسة التي أُنشئت للتو بكلمة المرور المؤقتة
  // حد أقصى عمليتا تشفير لكل طلب حتى يبقى ضمن حد وقت المعالج
  const next = validatePassword(body.newPassword);
  if (!user.must_change_password) {
    const current = (body.currentPassword || '').trim();
    if (!(await verifyPassword(current, user.password_salt, user.password_hash))) {
      throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة.');
    }
    if (next === current) throw new HttpError(400, 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.');
  } else if (await verifyPassword(next, user.password_salt, user.password_hash)) {
    throw new HttpError(400, 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.');
  }
  const salt = randomHex(16);
  await db.batch([
    db.prepare('UPDATE staff_users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?')
      .bind(await hashPassword(next, salt), salt, user.id),
    // تسجيل خروج بقية الأجهزة بعد تغيير كلمة المرور
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, tokenHash),
  ]);
  return json({ user: publicUser({ ...user, must_change_password: 0 }) });
}

async function listUsers(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM staff_users ORDER BY created_at, name').all<UserRow>();
  return results.map(publicUser);
}

async function activeAdminsExcept(db: D1Database, id: string): Promise<number> {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM staff_users WHERE role = 'admin' AND is_active = 1 AND id != ?`)
    .bind(id).first<{ n: number }>();
  return r?.n ?? 0;
}

async function usernameTaken(db: D1Database, username: string, exceptId: string): Promise<boolean> {
  const r = await db.prepare('SELECT id FROM staff_users WHERE username = ? AND id != ?').bind(username, exceptId).first();
  return !!r;
}

async function handleCreateUser(req: Request, db: D1Database) {
  const body = await readJson<any>(req);
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim();
  if (!name || !username) throw new HttpError(400, 'الاسم واسم المستخدم مطلوبان.');
  const password = validatePassword(body.password);
  const role = validateRole(body.role);
  if (await usernameTaken(db, username, '')) throw new HttpError(409, 'اسم المستخدم مستخدم مسبقاً لحساب آخر.');
  const salt = randomHex(16);
  const id = `user_${randomHex(8)}`;
  await db.prepare(`INSERT INTO staff_users (id, name, username, password_hash, password_salt, role, phone, is_active, must_change_password, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
    .bind(id, name, username, await hashPassword(password, salt), salt, role, String(body.phone || '').trim(),
      body.isActive === false ? 0 : 1, new Date().toISOString().slice(0, 10))
    .run();
  return json({ users: await listUsers(db) });
}

async function handleUpdateUser(req: Request, db: D1Database, me: UserRow, id: string) {
  const body = await readJson<any>(req);
  const target = await db.prepare('SELECT * FROM staff_users WHERE id = ?').bind(id).first<UserRow>();
  if (!target) throw new HttpError(404, 'الحساب غير موجود.');

  const name = body.name !== undefined ? String(body.name).trim() : target.name;
  const username = body.username !== undefined ? String(body.username).trim() : target.username;
  const role = body.role !== undefined ? validateRole(body.role) : target.role;
  const isActive = body.isActive !== undefined ? !!body.isActive : !!target.is_active;
  if (!name || !username) throw new HttpError(400, 'الاسم واسم المستخدم مطلوبان.');
  if (await usernameTaken(db, username, id)) throw new HttpError(409, 'اسم المستخدم مستخدم مسبقاً لحساب آخر.');
  if (target.role === 'admin' && (role !== 'admin' || !isActive) && (await activeAdminsExcept(db, id)) === 0) {
    throw new HttpError(400, 'لا يمكن تعطيل أو تغيير دور آخر حساب مدير نشط في المنظومة.');
  }

  const stmts = [
    db.prepare('UPDATE staff_users SET name = ?, username = ?, role = ?, phone = ?, is_active = ? WHERE id = ?')
      .bind(name, username, role, body.phone !== undefined ? String(body.phone).trim() : target.phone, isActive ? 1 : 0, id),
  ];
  const newPassword = typeof body.password === 'string' && body.password.trim() ? validatePassword(body.password) : null;
  if (newPassword) {
    const salt = randomHex(16);
    // كلمة مرور يضعها المدير لموظف آخر تُعتبر مؤقتة ويُطلب تغييرها عند الدخول
    stmts.push(db.prepare('UPDATE staff_users SET password_hash = ?, password_salt = ?, must_change_password = ? WHERE id = ?')
      .bind(await hashPassword(newPassword, salt), salt, id === me.id ? 0 : 1, id));
  }
  if (newPassword || !isActive) {
    stmts.push(db.prepare('DELETE FROM sessions WHERE user_id = ? AND user_id != ?').bind(id, me.id));
  }
  await db.batch(stmts);
  return json({ users: await listUsers(db) });
}

async function handleDeleteUser(db: D1Database, me: UserRow, id: string) {
  if (id === me.id) throw new HttpError(400, 'لا يمكنك حذف الحساب الذي تستخدمه حالياً.');
  const target = await db.prepare('SELECT * FROM staff_users WHERE id = ?').bind(id).first<UserRow>();
  if (!target) throw new HttpError(404, 'الحساب غير موجود.');
  if (target.role === 'admin' && (await activeAdminsExcept(db, id)) === 0) {
    throw new HttpError(400, 'لا يمكن حذف آخر حساب مدير في المنظومة.');
  }
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM staff_users WHERE id = ?').bind(id),
  ]);
  return json({ users: await listUsers(db) });
}

// ---------- المزامنة ----------

const COLLECTIONS = Object.keys(RULES) as Collection[];

interface RecordRow {
  collection: Collection;
  id: string;
  data: string | null;
  deleted: number;
  version: number;
}

function outRecord(r: RecordRow) {
  return {
    collection: r.collection,
    id: r.id,
    version: r.version,
    deleted: !!r.deleted,
    data: r.deleted || !r.data ? null : JSON.parse(r.data),
  };
}

async function getMeta(db: D1Database) {
  const { results } = await db.prepare(`SELECT key, value FROM meta WHERE key IN ('version', 'epoch')`).all<{ key: string; value: string }>();
  const m = Object.fromEntries(results.map(r => [r.key, r.value]));
  return { version: Number(m.version || 0), epoch: m.epoch || '' };
}

async function handlePull(url: URL, db: D1Database) {
  const since = Math.max(0, Number(url.searchParams.get('since') || 0) || 0);
  const meta = await getMeta(db);
  const { results } = await db
    .prepare('SELECT collection, id, data, deleted, version FROM records WHERE version > ? ORDER BY version LIMIT ?')
    .bind(since, PULL_LIMIT)
    .all<RecordRow>();
  const cursor = results.length ? results[results.length - 1].version : since;
  return json({
    epoch: meta.epoch,
    records: results.map(outRecord),
    cursor,
    hasMore: results.length === PULL_LIMIT,
  });
}

interface IncomingChange {
  collection: Collection;
  id: string;
  deleted?: boolean;
  data?: any;
}

/** يمنع تكرار أرقام الوصولات والتذاكر عندما تنشئ أجهزة مختلفة وصولاً في نفس الوقت */
async function fixSequenceNumbers(db: D1Database, accepted: { change: IncomingChange; isNew: boolean }[]) {
  const specs = [
    { collection: 'payments', field: 'receiptNumber', re: /^(REC-\d{4}-)(\d+)$/, pad: 5 },
    { collection: 'tickets', field: 'ticketNumber', re: /^(TKT-\d{2}-)(\d+)$/, pad: 4 },
  ] as const;
  for (const spec of specs) {
    const fresh = accepted.filter(a => a.isNew && !a.change.deleted && a.change.collection === spec.collection);
    if (!fresh.length) continue;
    const { results } = await db
      .prepare(`SELECT id, json_extract(data, '$.${spec.field}') AS num FROM records
                WHERE collection = ? AND deleted = 0 AND json_extract(data, '$.${spec.field}') IS NOT NULL`)
      .bind(spec.collection)
      .all<{ id: string; num: string }>();
    const used = new Map<string, string>(results.map(r => [r.num, r.id]));
    const maxByPrefix = new Map<string, number>();
    for (const num of used.keys()) {
      const m = spec.re.exec(num);
      if (m) maxByPrefix.set(m[1], Math.max(maxByPrefix.get(m[1]) || 0, parseInt(m[2], 10)));
    }
    for (const a of fresh) {
      const num = String(a.change.data?.[spec.field] || '');
      const m = spec.re.exec(num);
      const owner = used.get(num);
      if (m && owner && owner !== a.change.id) {
        const next = (maxByPrefix.get(m[1]) || 0) + 1;
        const renamed = `${m[1]}${String(next).padStart(spec.pad, '0')}`;
        a.change.data = { ...a.change.data, [spec.field]: renamed };
        maxByPrefix.set(m[1], next);
        used.set(renamed, a.change.id);
      } else if (m) {
        maxByPrefix.set(m[1], Math.max(maxByPrefix.get(m[1]) || 0, parseInt(m[2], 10)));
        used.set(num, a.change.id);
      }
    }
  }
}

async function handlePush(req: Request, db: D1Database, user: UserRow) {
  const body = await readJson<{ changes?: IncomingChange[] }>(req);
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_CHANGES_PER_PUSH) throw new HttpError(400, `الحد الأقصى ${MAX_CHANGES_PER_PUSH} تغييراً في الطلب الواحد.`);

  for (const c of changes) {
    if (!COLLECTIONS.includes(c.collection) || typeof c.id !== 'string' || !c.id || c.id.length > 120) {
      throw new HttpError(400, 'تغيير غير صالح في الطلب.');
    }
    if (!c.deleted) {
      if (!c.data || typeof c.data !== 'object' || Array.isArray(c.data)) throw new HttpError(400, 'بيانات غير صالحة.');
      if (JSON.stringify(c.data).length > MAX_RECORD_BYTES) throw new HttpError(400, 'السجل كبير جداً.');
    }
  }

  // الحالة الحالية على الخادم لكل السجلات المعنية (استعلام واحد عبر json_each)
  const keys = JSON.stringify(changes.map(c => [c.collection, c.id]));
  const { results: existingRows } = await db
    .prepare(`SELECT r.collection, r.id, r.data, r.deleted, r.version FROM records r
              JOIN json_each(?) j ON r.collection = json_extract(j.value, '$[0]') AND r.id = json_extract(j.value, '$[1]')`)
    .bind(keys)
    .all<RecordRow>();
  const existing = new Map(existingRows.map(r => [`${r.collection}\u0000${r.id}`, r]));

  const results: any[] = [];
  const accepted: { change: IncomingChange; isNew: boolean }[] = [];
  for (const c of changes) {
    const cur = existing.get(`${c.collection}\u0000${c.id}`);
    const live = !!cur && !cur.deleted;
    const rule = RULES[c.collection];
    if (c.deleted && !live) {
      results.push({ collection: c.collection, id: c.id, status: 'ok', version: cur?.version ?? 0, deleted: true, data: null });
      continue;
    }
    const allowed = c.deleted ? rule.delete : live ? rule.update : rule.create;
    if (!allowed.includes(user.role)) {
      results.push({
        collection: c.collection,
        id: c.id,
        status: 'rejected',
        reason: 'لا تملك صلاحية هذه العملية.',
        current: cur ? outRecord(cur) : null,
      });
      continue;
    }
    accepted.push({ change: c, isNew: !live });
  }

  await fixSequenceNumbers(db, accepted);

  if (accepted.length) {
    const n = accepted.length;
    const now = Date.now();
    const stmts: D1PreparedStatement[] = [
      db.prepare(`UPDATE meta SET value = CAST(value AS INTEGER) + ? WHERE key = 'version'`).bind(n),
    ];
    accepted.forEach(({ change }, k) => {
      stmts.push(
        db.prepare(`INSERT INTO records (collection, id, data, deleted, version, updated_at, updated_by)
                    VALUES (?, ?, ?, ?, (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'version') - ?, ?, ?)
                    ON CONFLICT(collection, id) DO UPDATE SET
                      data = excluded.data, deleted = excluded.deleted, version = excluded.version,
                      updated_at = excluded.updated_at, updated_by = excluded.updated_by
                    RETURNING version`)
          .bind(change.collection, change.id, change.deleted ? null : JSON.stringify(change.data),
            change.deleted ? 1 : 0, n - 1 - k, now, user.id),
      );
    });
    // دفعة واحدة = معاملة واحدة، فلا تتداخل أرقام النسخ بين طلبين متزامنين
    const out = await db.batch<{ version: number }>(stmts);
    accepted.forEach(({ change }, k) => {
      results.push({
        collection: change.collection,
        id: change.id,
        status: 'ok',
        version: out[k + 1].results[0]?.version,
        deleted: !!change.deleted,
        data: change.deleted ? null : change.data,
      });
    });
  }

  return json({ results });
}

// ---------- التوجيه ----------

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const db = env.DB;
  await ensureSchema(db);
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;

  if (path === '/api/status' && method === 'GET') {
    return json({ ok: true, needsSetup: (await countUsers(db)) === 0 });
  }
  if (path === '/api/setup' && method === 'POST') return handleSetup(req, db);
  if (path === '/api/auth/login' && method === 'POST') return handleLogin(req, db);

  const { user, tokenHash } = await authenticate(req, db);

  if (path === '/api/auth/me' && method === 'GET') return json({ user: publicUser(user) });
  if (path === '/api/auth/logout' && method === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return json({ ok: true });
  }
  if (path === '/api/auth/password' && method === 'POST') return handleChangeOwnPassword(req, db, user, tokenHash);

  // الموظف الملزم بتغيير كلمة المرور لا يصل للبيانات قبل تغييرها
  if (user.must_change_password) throw new HttpError(403, 'يجب تغيير كلمة المرور أولاً.');

  if (path === '/api/users' && method === 'GET') return json({ users: await listUsers(db) });
  if (path === '/api/users' && method === 'POST') { requireAdmin(user); return handleCreateUser(req, db); }
  const userMatch = /^\/api\/users\/([^/]+)$/.exec(path);
  if (userMatch && method === 'PUT') { requireAdmin(user); return handleUpdateUser(req, db, user, decodeURIComponent(userMatch[1])); }
  if (userMatch && method === 'DELETE') { requireAdmin(user); return handleDeleteUser(db, user, decodeURIComponent(userMatch[1])); }

  if (path === '/api/sync' && method === 'GET') return handlePull(url, db);
  if (path === '/api/sync' && method === 'POST') return handlePush(req, db, user);
  if (path === '/api/ai/chat' && method === 'POST') return handleAdvisorChat(req, env, user);

  throw new HttpError(404, 'المسار غير موجود.');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env, url);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        console.error(err);
        return json({ error: 'خطأ داخلي في الخادم.' }, 500);
      }
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('Not found', { status: 404 });
  },
};
