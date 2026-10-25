import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { STAGE_W, type Loop } from '../loops/paint';

/** Whether the guide's pictures are paused (its Pause button). */
export const LoopsPaused = createContext(false);

const REDUCE = '(prefers-reduced-motion: reduce)';

/** Whether the player asked for less motion: the pictures then hold still. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCE);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/**
 * Plays a loop on a canvas that fills its box, the stage scaled to its width. Paused, it holds
 * the moment it was at; with reduced motion, it shows the loop's still frame. A tab in the
 * background doesn't skip it ahead. `onLoop` is told each time it comes round to the start.
 */
export function LoopCanvas({ loop, onLoop }: { loop: Loop; onLoop?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paused = useContext(LoopsPaused);
  const still = useReducedMotion();
  const holding = useRef(paused || still);
  const looped = useRef(onLoop);
  useEffect(() => {
    holding.current = paused || still;
    looped.current = onLoop;
  }, [paused, still, onLoop]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (!holding.current) {
        const before = Math.floor(elapsed / loop.duration);
        elapsed += Math.min(100, now - last);
        if (Math.floor(elapsed / loop.duration) > before) looped.current?.();
      }
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w && h) {
        if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
        if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
        const k = w / STAGE_W;
        ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
        ctx.clearRect(0, 0, STAGE_W, h / k);
        const t = window.matchMedia(REDUCE).matches ? loop.poster : elapsed % loop.duration;
        loop.draw({ ctx, W: STAGE_W, H: h / k }, t);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loop]);

  return <canvas ref={ref} aria-hidden="true" className="h-full w-full" />;
}
