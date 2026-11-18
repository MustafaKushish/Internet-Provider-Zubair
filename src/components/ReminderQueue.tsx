import React from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { Subscriber, SystemSettings } from '../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt } from '../utils/storage';
import { formatMonthsAr, monthsLate } from '../utils/debt';
import { CheckCircle2, Send } from 'lucide-react';

/** نافذة الإرسال المتتالي: مشترك واحد في كل مرة مع معاينة الرسالة */
export const ReminderQueue: React.FC<{
  queue: Subscriber[];
  index: number;
  settings: SystemSettings;
  typeFor: (s: Subscriber) => 'expiry' | 'expired' | 'debt';
  messageFor: (s: Subscriber, type: 'expiry' | 'expired' | 'debt') => string;
  onSend: (s: Subscriber) => void;
  onSkip: () => void;
  onClose: () => void;
}> = ({ queue, index, settings, typeFor, messageFor, onSend, onSkip, onClose }) => {
  useEscapeKey(onClose);
  const sub = queue[index];
  const done = !sub;
  const type = sub ? typeFor(sub) : 'expiry';
  const message = sub ? messageFor(sub, type) : '';
  const debt = sub ? getRemainingDebt(sub) : 0;
  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="الإرسال المتتالي" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">الإرسال المتتالي</h3>
          <span className="text-xs text-slate-400">{Math.min(index + 1, queue.length)} / {queue.length}</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(Math.min(index, queue.length) / queue.length) * 100}%` }} />
        </div>
        {done ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-white">انتهت القائمة 👏</p>
            <p className="text-xs text-slate-400">تم المرور على {queue.length} مشترك.</p>
            <button type="button" onClick={onClose} className="mt-2 px-5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer">إغلاق</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-white">{sub.name}</div>
                <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{sub.phone}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${type === 'expired' ? 'bg-rose-950 border-rose-800 text-rose-300' : type === 'debt' ? 'bg-indigo-950 border-indigo-800 text-indigo-300' : 'bg-amber-950 border-amber-800 text-amber-300'}`}>
                {type === 'expired' ? `متأخر ${formatMonthsAr(monthsLate(sub.expiryDate))}` : type === 'debt' ? `دين ${formatCurrency(debt, settings.currency)}` : `ينتهي خلال ${getDaysRemaining(sub.expiryDate)} يوم`}
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto">{message}</pre>
            <div className="flex gap-2">
              <button type="button" onClick={() => onSend(sub)} autoFocus
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <Send className="w-4 h-4" /> إرسال واتساب والتالي
              </button>
              <button type="button" onClick={onSkip} className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold cursor-pointer">تخطي</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
