import React from 'react';
import { Undo2 } from 'lucide-react';
import { UndoEntry } from '../utils/undo';

/** زر «تراجع» عائم للمدير: يعرض آخر عملية ويلغيها بعد تأكيد */
export const UndoBar: React.FC<{ entry: UndoEntry | null; count: number; raised: boolean; onUndo: () => void }> = ({ entry, count, raised, onUndo }) => {
  if (!entry) return null;
  return (
    <div className={`animate-rise fixed right-3 z-40 no-print ${raised ? 'bottom-[calc(10rem+env(safe-area-inset-bottom))] lg:bottom-20' : 'bottom-20'}`} key={entry.id}>
      <button
        type="button"
        onClick={onUndo}
        className="h-12 pl-4 pr-3 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-amber-600 hover:bg-amber-500 text-white shadow-xl shadow-black/40 flex items-center gap-2 cursor-pointer"
      >
        <Undo2 className="w-5 h-5 flex-shrink-0" />
        <span className="text-base font-semibold">تراجع</span>
        <span className="text-sm text-amber-100 truncate max-w-[14rem]">عن: {entry.label}</span>
        {count > 1 && <span className="text-sm bg-amber-800/70 rounded-full px-2 tabular-nums flex-shrink-0">{count}</span>}
      </button>
    </div>
  );
};
