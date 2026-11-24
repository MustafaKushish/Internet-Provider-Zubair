import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { AdvisorPanelProps } from './views/AdvisorView';

const loadPanel = () => import('./views/AdvisorView').then(m => ({ default: m.AdvisorPanel }));
const Panel = React.lazy(loadPanel);

/**
 * المستشار الذكي كزر عائم صغير (أسفل اليمين؛ اليسار محجوز لشارة المزامنة) يفتح نافذة محادثة من أي صفحة.
 * الكود الثقيل يُحمَّل عند أول لمسة؛ بعدها تبقى المحادثة حيّة حتى لو أُغلقت النافذة.
 */
export const AdvisorFab: React.FC<{ raised: boolean } & AdvisorPanelProps> = ({ raised, ...panelProps }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);

  const toggle = () => { setLoaded(true); setOpen(true); setUnread(false); };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={toggle}
          onPointerEnter={() => { void loadPanel(); }}
          aria-label="اسأل المستشار الذكي"
          title="المستشار الذكي"
          className={`fixed right-3 z-40 w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-black/40 border border-white/20 hover:brightness-110 no-print ${raised ? 'bottom-[calc(6.25rem+env(safe-area-inset-bottom))] lg:bottom-4' : 'bottom-4'}`}
        >
          <Sparkles className={`w-5 h-5 ${busy ? 'animate-pulse' : ''}`} />
          {busy && <span className="absolute inset-0 rounded-full ring-2 ring-cyan-300/60 animate-ping" aria-hidden="true" />}
          {unread && !busy && <span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900" aria-label="إجابة جديدة" />}
        </button>
      )}
      {loaded && (
        <React.Suspense fallback={null}>
          <Panel {...panelProps} open={open} onClose={() => setOpen(false)} onBusy={setBusy} onAnswered={() => { if (!open) setUnread(true); }} />
        </React.Suspense>
      )}
    </>
  );
};
