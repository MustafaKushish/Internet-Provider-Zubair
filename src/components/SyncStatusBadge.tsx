import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { SyncStatus } from '../sync/syncEngine';

interface SyncStatusBadgeProps {
  previewMode?: boolean;
  status: SyncStatus;
  notice: string | null;
  onDismissNotice: () => void;
  onSyncNow: () => void;
}

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return 'الآن';
  const min = Math.round(sec / 60);
  if (min < 60) return `قبل ${min} د`;
  return `قبل ${Math.round(min / 60)} س`;
}

// شارة صغيرة ثابتة تبيّن حالة المزامنة مع الخادم
export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ previewMode, status, notice, onDismissNotice, onSyncNow }) => {
  const { phase, pending, lastSyncAt, message } = status;

  if (previewMode) {
    return (
      <div className="fixed bottom-[4.75rem] lg:bottom-3 left-3 z-40 no-print max-w-[calc(100vw-1.5rem)]">
        <div className="flex items-center gap-1.5 rounded-full border border-amber-800 bg-amber-950/95 px-3 py-1.5 text-[11px] font-semibold text-amber-300 shadow-lg">
          <CloudOff className="w-3.5 h-3.5" />
          <span className="truncate">وضع المعاينة • البيانات على هذا الجهاز فقط</span>
        </div>
      </div>
    );
  }

  let icon = <Cloud className="w-3.5 h-3.5" />;
  let label = 'متصل بالخادم';
  let tone = 'border-slate-700 text-slate-300 bg-slate-900/95';

  if (phase === 'syncing') {
    icon = <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
    label = pending > 0 ? `جارٍ رفع ${pending} تغيير…` : 'جارٍ المزامنة…';
    tone = 'border-cyan-800 text-cyan-300 bg-cyan-950/95';
  } else if (phase === 'synced') {
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    label = `محفوظ على الخادم ${timeAgo(lastSyncAt)}`;
    tone = 'border-emerald-800 text-emerald-300 bg-emerald-950/95';
  } else if (phase === 'offline') {
    icon = <CloudOff className="w-3.5 h-3.5" />;
    label = pending > 0 ? `بدون إنترنت • ${pending} تغيير بانتظار الرفع` : 'بدون إنترنت • البيانات محفوظة على الجهاز';
    tone = 'border-amber-800 text-amber-300 bg-amber-950/95';
  } else if (phase === 'error') {
    icon = <AlertTriangle className="w-3.5 h-3.5" />;
    label = message || 'تعذرت المزامنة';
    tone = 'border-rose-800 text-rose-300 bg-rose-950/95';
  }

  // عند الحفظ بنجاح تكفي أيقونة صغيرة حتى لا تغطي الأزرار؛ النص يظهر عند المرور بالماوس
  const quiet = phase === 'synced' || phase === 'idle';

  return (
    <div className="fixed bottom-[4.75rem] lg:bottom-3 left-3 z-40 flex flex-col items-start gap-2 no-print max-w-[calc(100vw-1.5rem)]">
      {notice && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-800 bg-rose-950/95 px-3 py-2 text-xs text-rose-200 shadow-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
          <span className="min-w-0">{notice}</span>
          <button type="button" onClick={onDismissNotice} className="text-rose-300 hover:text-white cursor-pointer" aria-label="إغلاق">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onSyncNow}
        title={`${label} • اضغط للمزامنة الآن`}
        aria-label={label}
        className={`group flex items-center gap-1.5 rounded-full border text-[11px] font-semibold shadow-lg cursor-pointer ${quiet ? 'p-2 opacity-80 hover:opacity-100 hover:px-3 hover:py-1.5' : 'px-3 py-1.5'} ${tone}`}
      >
        {icon}
        <span className={quiet ? 'hidden group-hover:inline truncate' : 'truncate'}>{label}</span>
      </button>
    </div>
  );
};
