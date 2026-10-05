import { useEffect, useRef, useState } from 'react';

const COUNT_MS = 900;

/**
 * The number to show while a score counts up (or down) to `value`. It always ends on `value`,
 * which comes from the server (rule W7); with reduced motion it jumps straight there.
 */
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const set = (n: number) => {
      shownRef.current = n;
      setShown(n);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      set(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}
