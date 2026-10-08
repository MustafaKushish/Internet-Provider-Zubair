import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * نوافذ تأكيد وتنبيهات داخل المنظومة بدلاً من confirm() و alert() الخاصة بالمتصفح
 * (تعمل في كل المتصفحات وداخل الإطارات، وتطابق تصميم المنظومة)
 *
 *   if (await appConfirm('هل أنت متأكد؟')) { ... }
 *   notify('تم الحفظ', 'success');
 */

type Tone = 'info' | 'success' | 'error' | 'warning';

interface ConfirmRequest {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

let seq = 0;
let pushConfirm: ((r: ConfirmRequest) => void) | null = null;
let pushToast: ((t: Toast) => void) | null = null;

export function appConfirm(
  message: string,
  options: { title?: string; confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  return new Promise(resolve => {
    const req: ConfirmRequest = {
      id: ++seq,
      title: options.title || 'تأكيد العملية',
      message,
      confirmLabel: options.confirmLabel || 'تأكيد',
      danger: options.danger ?? true,
      resolve,
    };
    if (pushConfirm) pushConfirm(req);
    else resolve(false);
  });
}

export function notify(message: string, tone: Tone = 'info'): void {
  if (pushToast) pushToast({ id: ++seq, message, tone });
}

const TOAST_STYLE: Record<Tone, string> = {
  info: 'border-cyan-800 bg-cyan-950/95 text-cyan-100',
  success: 'border-emerald-800 bg-emerald-950/95 text-emerald-100',
  error: 'border-rose-800 bg-rose-950/95 text-rose-100',
  warning: 'border-amber-800 bg-amber-950/95 text-amber-100',
};

const TOAST_ICON: Record<Tone, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />,
  error: <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />,
};

export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    pushConfirm = r => setQueue(q => [...q, r]);
    pushToast = t => {
      setToasts(list => [...list.slice(-3), t]);
      const ms = Math.min(9000, 3500 + t.message.length * 40);
      setTimeout(() => setToasts(list => list.filter(x => x.id !== t.id)), ms);
    };
    return () => {
      pushConfirm = null;
      pushToast = null;
    };
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const answer = (ok: boolean) => {
    if (!current) return;
    current.resolve(ok);
    setQueue(q => q.slice(1));
  };

  return (
    <>
      {current && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${current.danger ? 'bg-rose-600/20 text-rose-400' : 'bg-cyan-600/20 text-cyan-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 id="app-confirm-title" className="text-sm font-bold text-white">{current.title}</h2>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">{current.message}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => answer(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                ref={confirmBtn}
                type="button"
                onClick={() => answer(true)}
                className={`px-5 py-2 rounded-lg text-white text-xs font-bold cursor-pointer ${current.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}
              >
                {current.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 w-[min(28rem,calc(100vw-2rem))] no-print" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} role="status" className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs shadow-xl ${TOAST_STYLE[t.tone]}`}>
              {TOAST_ICON[t.tone]}
              <span className="min-w-0 flex-1 whitespace-pre-line leading-relaxed">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts(list => list.filter(x => x.id !== t.id))}
                className="opacity-70 hover:opacity-100 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
