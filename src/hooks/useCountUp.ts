import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number toward `target` with an ease-out curve.
 * Counts from 0 on mount, then from the previous value on later changes.
 * Renders the final value instantly when the user prefers reduced motion.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(0);
  // Tracks the currently rendered value so a target change mid-animation
  // continues from where the count is, instead of rewinding to the start.
  const displayRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || displayRef.current === target) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const from = displayRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return display;
}
