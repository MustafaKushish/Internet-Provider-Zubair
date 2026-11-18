import { useEffect, useRef } from 'react';
import { registerBackClose } from './backStack';

/**
 * إغلاق النافذة بزر Escape أو بزر «رجوع» في الهاتف/المتصفح
 * (Escape لا يعمل إذا كانت نافذة تأكيد مفتوحة فوقها)
 */
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
    const unregister = registerBackClose(() => ref.current());
    return () => {
      window.removeEventListener('keydown', onKey);
      unregister();
    };
  }, [active]);
}
