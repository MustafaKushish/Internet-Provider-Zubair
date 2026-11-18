/**
 * التراجع (للمدير فقط): بعد كل عملية نحفظ النسخة السابقة من السجلات التي تغيّرت فقط (لا كل البيانات)،
 * فيُعاد كل سجل إلى ما كان عليه دون المساس بسجلات أخرى عدّلها جهاز آخر في هذه الأثناء.
 * دوال صرفة بلا React لسهولة الاختبار.
 */

export type UndoCollection = 'subscribers' | 'payments' | 'tickets' | 'providers' | 'towers' | 'expenses';
export const UNDO_COLLECTIONS: UndoCollection[] = ['subscribers', 'payments', 'tickets', 'providers', 'towers', 'expenses'];
export const MAX_UNDO = 30;

type Item = { id: string; [key: string]: any };
export type UndoState = Record<UndoCollection, Item[]>;

export interface UndoChange {
  c: UndoCollection;
  id: string;
  before: Item | null; // null = أُنشئ بهذه العملية (يُحذف عند التراجع)
  after: Item | null;  // null = حُذف بهذه العملية (يُعاد عند التراجع)
}

export interface UndoEntry {
  id: string;
  label: string;
  at: string;
  by: string;
  changes: UndoChange[];
}

/** نص ثابت الترتيب لمقارنة سجلين مهما اختلف ترتيب الحقول */
export function canon(v: unknown): string {
  if (v === null || v === undefined) return '';
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : val);
}

/** السجلات التي اختلفت بين حالتين */
export function diffStates(before: UndoState, after: UndoState): UndoChange[] {
  const changes: UndoChange[] = [];
  for (const c of UNDO_COLLECTIONS) {
    if (before[c] === after[c]) continue;
    const b = new Map(before[c].map(i => [i.id, i]));
    const a = new Map(after[c].map(i => [i.id, i]));
    for (const [id, item] of a) {
      const old = b.get(id) ?? null;
      if (old !== item && canon(old) !== canon(item)) changes.push({ c, id, before: old, after: item });
    }
    for (const [id, old] of b) if (!a.has(id)) changes.push({ c, id, before: old, after: null });
  }
  return changes;
}

/** عدد السجلات التي تغيّرت بعد العملية (مثلاً من جهاز آخر) وسيُستبدل تغييرها عند التراجع */
export function countConflicts(entry: UndoEntry, current: UndoState): number {
  return entry.changes.filter(ch => {
    const now = current[ch.c].find(i => i.id === ch.id) ?? null;
    return canon(now) !== canon(ch.after);
  }).length;
}

/** يعيد قائمة واحدة إلى ما قبل العملية */
export function revertList<T extends { id: string }>(list: T[], changes: UndoChange[]): T[] {
  const byId = new Map(changes.map(ch => [ch.id, ch]));
  const next = list.flatMap(item => {
    const ch = byId.get(item.id);
    if (!ch) return [item];
    byId.delete(item.id);
    return ch.before ? [ch.before as unknown as T] : []; // أُنشئ بالعملية: يُحذف
  });
  // سجلات حُذفت بالعملية أو غابت: تعود
  byId.forEach(ch => { if (ch.before) next.push(ch.before as unknown as T); });
  return next;
}
