import { apiRequest, ApiError } from './api';

/**
 * مزامنة تلقائية بين بيانات المتصفح والخادم
 *
 * - "الظل" (shadow) يحفظ آخر نسخة يعرفها الجهاز من الخادم لكل سجل
 * - أي اختلاف بين البيانات المحلية والظل = تغيير محلي يُرفع للخادم
 * - السحب يجلب ما تغيّر على الخادم منذ آخر رقم نسخة (cursor)
 * - التعديل المحلي غير المرفوع لا يُستبدل بنسخة الخادم (آخر تعديل هو الذي يُعتمد)
 * - البيانات تبقى محفوظة في المتصفح، فالعمل يستمر بدون إنترنت ويُرفع عند عودة الاتصال
 */

export type CollectionName = 'subscribers' | 'payments' | 'tickets' | 'providers' | 'towers' | 'settings';
export const COLLECTIONS: CollectionName[] = ['subscribers', 'payments', 'tickets', 'providers', 'towers', 'settings'];

type Item = { id: string; [key: string]: any };

export interface CollectionAdapter {
  get: () => Item[];
  set: (updater: (prev: Item[]) => Item[]) => void;
  /** تحويل البيانات القادمة من الخادم (مثلاً إعادة حساب حالة المشترك) */
  fromServer?: (data: any) => Item;
}

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  lastSyncAt: number | null;
  pending: number;
  message?: string;
}

interface PersistedState {
  epoch: string | null;
  cursor: number;
  initialized: boolean;
  shadow: Record<string, Record<string, string>>;
}

interface ServerRecord {
  collection: CollectionName;
  id: string;
  version: number;
  deleted: boolean;
  data: any;
}

interface PushResult {
  collection: CollectionName;
  id: string;
  status: 'ok' | 'rejected';
  deleted?: boolean;
  data?: any;
  reason?: string;
  current?: ServerRecord | null;
}

const STATE_KEY = 'sas_plus_sync_state_v1';
const PUSH_CHUNK = 20;

/** JSON بترتيب مفاتيح ثابت حتى تكون المقارنة موثوقة */
function stable(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(v => (v === undefined ? 'null' : stable(v))).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
}

/** الحقول المحسوبة تلقائياً لا تُرفع (تتغير يومياً على كل جهاز) */
function normalize(collection: CollectionName, item: Item): Item {
  if (collection === 'subscribers') {
    const { paymentStatus: _p, status, ...rest } = item;
    return status === 'suspended' ? { ...rest, status } : (rest as Item);
  }
  return item;
}

function canonical(collection: CollectionName, item: Item): string {
  return stable(normalize(collection, item));
}

function emptyState(): PersistedState {
  return { epoch: null, cursor: 0, initialized: false, shadow: {} };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return emptyState();
    const s = JSON.parse(raw);
    return { ...emptyState(), ...s, shadow: s.shadow || {} };
  } catch {
    return emptyState();
  }
}

type Op = { id: string; item: Item | null };

/** تطبيق عمليات على مصفوفة: استبدال/حذف بالمعرّف، والجديد يُضاف في الأعلى */
function applyOps(prev: Item[], ops: Op[]): Item[] {
  if (!ops.length) return prev;
  const byId = new Map(ops.map(o => [o.id, o.item]));
  const out: Item[] = [];
  const seen = new Set<string>();
  for (const it of prev) {
    if (byId.has(it.id)) {
      seen.add(it.id);
      const rep = byId.get(it.id);
      if (rep) out.push(rep);
    } else {
      out.push(it);
    }
  }
  const added = ops.filter(o => o.item && !seen.has(o.id)).map(o => o.item as Item);
  return [...added, ...out];
}

export class SyncEngine {
  private state: PersistedState = loadState();
  private running = false;
  private again = false;
  private status: SyncStatus = { phase: 'idle', lastSyncAt: null, pending: 0 };

  constructor(
    private adapters: () => Record<CollectionName, CollectionAdapter>,
    private onStatus: (s: SyncStatus) => void,
    private onAuthError: () => void,
    private onRejected: (messages: string[]) => void,
  ) {}

  private save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
    } catch {
      // مساحة التخزين ممتلئة أو غير متاحة؛ تُعاد المزامنة الكاملة لاحقاً
    }
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.onStatus(this.status);
  }

  private shadowOf(c: CollectionName) {
    return (this.state.shadow[c] ||= {});
  }

  /** عدد التغييرات المحلية التي لم تُرفع بعد */
  pendingCount(): number {
    return COLLECTIONS.reduce((n, c) => n + this.diff(c).length, 0);
  }

  private diff(c: CollectionName) {
    const adapter = this.adapters()[c];
    const shadow = this.shadowOf(c);
    const changes: { collection: CollectionName; id: string; deleted?: boolean; data?: Item }[] = [];
    const seen = new Set<string>();
    for (const item of adapter.get()) {
      if (!item || !item.id) continue;
      seen.add(item.id);
      if (shadow[item.id] !== canonical(c, item)) {
        changes.push({ collection: c, id: item.id, data: normalize(c, item) });
      }
    }
    for (const id of Object.keys(shadow)) {
      if (!seen.has(id)) changes.push({ collection: c, id, deleted: true });
    }
    return changes;
  }

  /** دورة مزامنة كاملة: رفع ثم سحب. الاستدعاءات المتزامنة تُدمج في دورة واحدة */
  async sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.setStatus({ phase: 'syncing', message: undefined });
    try {
      do {
        this.again = false;
        if (!this.state.initialized) {
          await this.initialSync();
        } else {
          await this.push();
          await this.pull();
        }
      } while (this.again);
      this.setStatus({ phase: 'synced', lastSyncAt: Date.now(), pending: 0 });
    } catch (err) {
      const e = err as ApiError;
      if (e?.status === 401) {
        this.setStatus({ phase: 'error', message: e.message });
        this.onAuthError();
      } else {
        this.setStatus({
          phase: e?.offline ? 'offline' : 'error',
          message: e?.message,
          pending: this.pendingCount(),
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async fetchAll(since: number): Promise<{ epoch: string; records: ServerRecord[]; cursor: number }> {
    const all: ServerRecord[] = [];
    let cursor = since;
    let epoch = '';
    for (;;) {
      const res = await apiRequest<{ epoch: string; records: ServerRecord[]; cursor: number; hasMore: boolean }>(
        `/api/sync?since=${cursor}`,
      );
      epoch = res.epoch;
      all.push(...res.records);
      cursor = res.cursor;
      if (!res.hasMore) break;
    }
    return { epoch, records: all, cursor };
  }

  /**
   * أول مزامنة على هذا الجهاز:
   * - الخادم فارغ → تُرفع بيانات هذا الجهاز (نقل البيانات القديمة للسحابة)
   * - الخادم فيه بيانات → تحل محل البيانات المحلية
   */
  private async initialSync() {
    const { epoch, records, cursor } = await this.fetchAll(0);
    const live = records.filter(r => !r.deleted);
    const adapters = this.adapters();
    this.state = { epoch, cursor, initialized: true, shadow: {} };

    if (live.length > 0) {
      // الأحدث أولاً كما تعرضه المنظومة
      const sorted = [...live].sort((a, b) => b.version - a.version);
      for (const c of COLLECTIONS) {
        const own = sorted.filter(r => r.collection === c);
        const shadow = this.shadowOf(c);
        own.forEach(r => { shadow[r.id] = canonical(c, r.data); });
        const ad = adapters[c];
        // الإعدادات غير الموجودة على الخادم تبقى المحلية (وتُرفع)
        if (c === 'settings' && own.length === 0) continue;
        const items = own.map(r => (ad.fromServer ? ad.fromServer(r.data) : r.data));
        ad.set(() => items);
      }
      this.save();
      // الإعدادات المحلية غير الموجودة على الخادم تُرفع في الدورة القادمة
      return;
    }
    this.save();
    await this.push();
  }

  private async pull() {
    const { epoch, records, cursor } = await this.fetchAll(this.state.cursor);
    if (this.state.epoch && epoch && epoch !== this.state.epoch) {
      // قاعدة البيانات على الخادم أُعيد إنشاؤها: نبدأ من جديد
      this.state = emptyState();
      this.save();
      await this.initialSync();
      return;
    }
    this.applyRemote(records);
    this.state.cursor = Math.max(this.state.cursor, cursor);
    this.state.epoch = epoch || this.state.epoch;
    this.save();
  }

  private applyRemote(records: ServerRecord[]) {
    if (!records.length) return;
    const adapters = this.adapters();
    for (const c of COLLECTIONS) {
      const own = records.filter(r => r.collection === c);
      if (!own.length) continue;
      const ad = adapters[c];
      const shadow = this.shadowOf(c);
      const local = new Map(ad.get().map(it => [it.id, it]));
      const ops: Op[] = [];
      for (const r of own) {
        const li = local.get(r.id);
        // تعديل محلي لم يُرفع بعد يبقى كما هو وسيُرفع في الدورة القادمة
        const pending = li ? canonical(c, li) !== shadow[r.id] : shadow[r.id] !== undefined;
        if (r.deleted) {
          delete shadow[r.id];
          if (!pending || !li) ops.push({ id: r.id, item: null });
        } else {
          shadow[r.id] = canonical(c, r.data);
          if (!pending) ops.push({ id: r.id, item: ad.fromServer ? ad.fromServer(r.data) : r.data });
        }
      }
      if (ops.length) ad.set(prev => applyOps(prev, ops));
    }
  }

  private async push() {
    // الوصولات تُرفع قبل المشتركين: الخادم يقبل زيادة "المدفوع" فقط إذا وُجدت وصولات تغطيها
    const order: CollectionName[] = ['payments', ...COLLECTIONS.filter(c => c !== 'payments')];
    const changes = order.flatMap(c => this.diff(c));
    if (!changes.length) return;
    this.setStatus({ pending: changes.length });
    const rejected: string[] = [];

    for (let i = 0; i < changes.length; i += PUSH_CHUNK) {
      const chunk = changes.slice(i, i + PUSH_CHUNK);
      const sent = new Map(chunk.map(ch => [`${ch.collection}\u0000${ch.id}`, ch.data ? canonical(ch.collection, ch.data) : null]));
      const { results } = await apiRequest<{ results: PushResult[] }>('/api/sync', { body: { changes: chunk } });

      const adapters = this.adapters();
      const opsBy: Partial<Record<CollectionName, Op[]>> = {};
      for (const r of results) {
        const shadow = this.shadowOf(r.collection);
        const ad = adapters[r.collection];
        const ops = (opsBy[r.collection] ||= []);
        if (r.status === 'ok') {
          if (r.deleted) {
            delete shadow[r.id];
          } else {
            const serverCanon = canonical(r.collection, r.data);
            shadow[r.id] = serverCanon;
            // الخادم عدّل السجل (مثلاً رقم وصل مكرر) → نأخذ نسخته
            if (serverCanon !== sent.get(`${r.collection}\u0000${r.id}`)) {
              ops.push({ id: r.id, item: ad.fromServer ? ad.fromServer(r.data) : r.data });
            }
          }
        } else {
          // مرفوض (صلاحيات): نعيد السجل إلى حالته على الخادم
          if (r.current && !r.current.deleted) {
            shadow[r.id] = canonical(r.collection, r.current.data);
            ops.push({ id: r.id, item: ad.fromServer ? ad.fromServer(r.current.data) : r.current.data });
          } else {
            delete shadow[r.id];
            ops.push({ id: r.id, item: null });
          }
          if (r.reason) rejected.push(r.reason);
        }
      }
      for (const c of COLLECTIONS) {
        const ops = opsBy[c];
        if (ops && ops.length) adapters[c].set(prev => applyOps(prev, ops));
      }
      this.save();
    }
    if (rejected.length) this.onRejected([...new Set(rejected)]);
  }

  /** عند تسجيل خروج نهائي أو تغيير الخادم */
  reset() {
    this.state = emptyState();
    this.save();
  }
}
