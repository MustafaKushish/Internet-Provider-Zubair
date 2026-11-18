import { describe, expect, it } from 'vitest';
import { UndoEntry, UndoState, canon, countConflicts, diffStates, revertList } from '../undo';

const empty = (): UndoState => ({ subscribers: [], payments: [], tickets: [], providers: [], towers: [], expenses: [] });
const entryOf = (before: UndoState, after: UndoState): UndoEntry => ({ id: 'e', label: 't', at: '', by: 'a', changes: diffStates(before, after) });

describe('undo diff and revert', () => {
  const s1 = { id: 's1', name: 'أحمد', paidAmount: 0 };
  const s2 = { id: 's2', name: 'علي', paidAmount: 5 };

  it('finds nothing when nothing changed (even with reordered fields)', () => {
    const a = { ...empty(), subscribers: [s1] };
    const b = { ...empty(), subscribers: [{ paidAmount: 0, name: 'أحمد', id: 's1' }] };
    expect(diffStates(a, b)).toEqual([]);
  });

  it('undoes an update', () => {
    const before = { ...empty(), subscribers: [s1, s2] };
    const after = { ...empty(), subscribers: [{ ...s1, paidAmount: 40000 }, s2] };
    const e = entryOf(before, after);
    expect(e.changes).toHaveLength(1);
    expect(revertList(after.subscribers, e.changes)).toEqual([s1, s2]);
  });

  it('undoes a creation by removing the record', () => {
    const before = { ...empty(), payments: [] };
    const after = { ...empty(), payments: [{ id: 'p1', amount: 10 }] };
    expect(revertList(after.payments, entryOf(before, after).changes)).toEqual([]);
  });

  it('undoes a deletion by restoring the record', () => {
    const before = { ...empty(), subscribers: [s1, s2] };
    const after = { ...empty(), subscribers: [s2] };
    const restored = revertList(after.subscribers, entryOf(before, after).changes);
    expect(restored).toHaveLength(2);
    expect(restored.find(x => x.id === 's1')).toEqual(s1);
  });

  it('leaves records changed elsewhere untouched', () => {
    const before = { ...empty(), subscribers: [s1, s2] };
    const after = { ...empty(), subscribers: [{ ...s1, paidAmount: 9 }, s2] };
    const e = entryOf(before, after);
    const other = [{ ...s1, paidAmount: 9 }, { ...s2, name: 'تعديل من جهاز آخر' }];
    expect(revertList(other, e.changes)).toEqual([s1, { ...s2, name: 'تعديل من جهاز آخر' }]);
  });

  it('counts records changed after the action', () => {
    const before = { ...empty(), subscribers: [s1] };
    const after = { ...empty(), subscribers: [{ ...s1, paidAmount: 9 }] };
    const e = entryOf(before, after);
    expect(countConflicts(e, after)).toBe(0);
    expect(countConflicts(e, { ...empty(), subscribers: [{ ...s1, paidAmount: 77 }] })).toBe(1);
    expect(countConflicts(e, empty())).toBe(1);
  });

  it('a multi-collection action (renewal) is undone as one', () => {
    const before = { ...empty(), subscribers: [s1] };
    const after = { ...empty(), subscribers: [{ ...s1, paidAmount: 40000 }], payments: [{ id: 'p1', amount: 40000 }] };
    const e = entryOf(before, after);
    expect(e.changes.map(c => c.c).sort()).toEqual(['payments', 'subscribers']);
  });

  it('canon ignores key order', () => expect(canon({ b: 1, a: { d: 1, c: 2 } })).toBe(canon({ a: { c: 2, d: 1 }, b: 1 })));
});
