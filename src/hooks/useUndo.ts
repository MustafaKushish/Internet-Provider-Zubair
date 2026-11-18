import { useCallback, useEffect, useRef, useState } from 'react';
import { appConfirm, notify } from '../components/ui/Dialogs';
import { uid } from '../utils/dates';
import { MAX_UNDO, UNDO_COLLECTIONS, UndoCollection, UndoEntry, UndoState, countConflicts, diffStates, revertList } from '../utils/undo';

const KEY = 'sas_undo_stack_v1';

type Setters = { [C in UndoCollection]: (updater: (prev: any[]) => any[]) => void };

interface Options {
  enabled: boolean; // المدير فقط، وغير مقفل
  state: UndoState;
  setters: Setters;
  by: string;
}

const loadStack = (): UndoEntry[] => {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
};

/**
 * استدعِ begin('وصف العملية') في أول سطر من أي دالة تغيّر البيانات؛ بعد اكتمال التغيير يقارن الخطاف
 * الحالة قبله وبعده ويحفظ ما تغيّر. المخزن في sessionStorage (يبقى بعد تحديث الصفحة ويُمسح عند الخروج).
 */
export function useUndo({ enabled, state, setters, by }: Options) {
  const live = useRef(state);
  live.current = state;
  const pending = useRef<{ label: string; before: UndoState } | null>(null);
  const [stack, setStack] = useState<UndoEntry[]>(loadStack);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const begin = useCallback((label: string) => {
    // العمليات المتداخلة (مثل إضافة مشترك بدفعة أولى) تُحسب عملية واحدة باسم أولها
    if (!enabled || pending.current) return;
    pending.current = { label, before: live.current };
  }, [enabled]);

  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const changes = diffStates(p.before, state);
    if (changes.length) setStack(s => [...s, { id: uid('undo'), label: p.label, at: new Date().toISOString(), by, changes }].slice(-MAX_UNDO));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, UNDO_COLLECTIONS.map(c => state[c]));

  useEffect(() => {
    if (!enabled) { setStack([]); pending.current = null; }
  }, [enabled]);

  useEffect(() => {
    try {
      if (stack.length) sessionStorage.setItem(KEY, JSON.stringify(stack));
      else sessionStorage.removeItem(KEY);
    } catch { /* ممتلئ: يبقى التراجع في الذاكرة فقط */ }
  }, [stack]);

  const undo = useCallback(async () => {
    const entry = stackRef.current[stackRef.current.length - 1];
    if (!enabled || !entry) return;
    const conflicts = countConflicts(entry, live.current);
    const d = new Date(entry.at);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const ok = await appConfirm(
      `سيُلغى: ${entry.label}\nنُفّذت الساعة ${time} (${entry.changes.length} سجل)` +
        (conflicts ? `\nتنبيه: ${conflicts} سجل تغيّر بعد هذه العملية، وسيُستبدل تغييره.` : ''),
      { title: 'تأكيد التراجع', confirmLabel: 'تراجع', danger: false },
    );
    if (!ok) return;
    for (const c of UNDO_COLLECTIONS) {
      const mine = entry.changes.filter(ch => ch.c === c);
      if (mine.length) setters[c](prev => revertList(prev, mine));
    }
    setStack(s => s.filter(e => e.id !== entry.id));
    notify(`تم التراجع عن: ${entry.label}`, 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { begin, undo, last: stack[stack.length - 1] || null, count: stack.length };
}
