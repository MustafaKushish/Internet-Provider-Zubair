import { useEffect, useRef } from 'react';

/** إغلاق النافذة بزر Escape (إلا إذا كانت نافذة تأكيد مفتوحة فوقها) */
export function useEscapeKey(onClose: () => void, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role=alertdialog]')) return;
      ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}
