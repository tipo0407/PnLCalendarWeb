import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates a numeric value toward `value` using easeOutCubic.
 * Re-targets mid-flight when `value` changes (e.g. switching months).
 */
export function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  useEffect(() => {
    displayRef.current = display;
  }, [display]);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}
