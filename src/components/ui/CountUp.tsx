import React, { useEffect, useRef, useState } from 'react';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** رقم يعدّ تصاعدياً حتى قيمته (وينتقل بنعومة عند تغيّرها) */
export const CountUp: React.FC<{ value: number; format?: (v: number) => string; duration?: number }> = ({
  value,
  format = v => v.toLocaleString('en-US'),
  duration = 900,
}) => {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0));
  const fromRef = useRef(shown);

  useEffect(() => {
    if (reduceMotion()) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(2, -10 * t); // ease-out-expo
      const v = t >= 1 ? value : Math.round(from + (value - from) * eased);
      fromRef.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{format(shown)}</span>;
};
