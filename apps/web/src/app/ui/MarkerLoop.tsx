import { useLayoutEffect, useRef, useState } from 'react';

/*
 * A marker loop round something on the notepads (the house rules' choices, the deck picker's
 * categories and its playing deck): drawn round the chosen one, wiped off the one it left, and
 * sketched faintly in pencil round the one you point at.
 */

export type LoopShape = { d: string; tilt: string };

/**
 * Loops in a 100×40 box, scaled to fit round what they circle. Each ends past where it started,
 * like a quick pen stroke; neighbours get different ones.
 */
export const LOOPS = [
  {
    d: 'M14 9C35 1 80 1 94 12 103 21 90 36 58 38 28 40 2 34 3 21 4 10 22 4 44 3 52 3 60 4 68 7',
    tilt: '-rotate-2',
  },
  {
    d: 'M86 6C60 0 18 4 6 15-3 26 14 38 44 38 76 38 99 29 96 16 93 6 70 1 50 3 44 3 38 4 32 6',
    tilt: 'rotate-1',
  },
  {
    d: 'M6 28C0 16 18 4 50 3 82 2 100 12 97 25 94 36 64 40 38 38 14 36 4 26 12 14 18 9 26 6 34 5',
    tilt: '-rotate-1',
  },
] as const satisfies readonly LoopShape[];

/** Twice round, a bit wild: for 🌀 Chaos. */
export const DOUBLE_LOOP: LoopShape = {
  d: 'M50 4C80 3 97 10 96 20 95 32 72 37 50 37 25 37 4 31 4 20 4 9 24 2 52 3 78 4 93 12 92 21 91 30 70 35 48 35 28 35 10 29 11 19',
  tilt: 'rotate-2',
};

/** The `n`th loop, so neighbours differ. */
export function loopAt(n: number): LoopShape {
  return LOOPS[n % LOOPS.length] ?? LOOPS[0];
}

/** `d` (all absolute coordinate pairs) scaled from the 100×40 box to `width`×`height`. */
function stretch(d: string, width: number, height: number): string {
  let x = true;
  return d.replace(/-?\d*\.?\d+/g, (n) => {
    const scaled = Number(n) * ((x ? width / 100 : height / 40) || 0);
    x = !x;
    return scaled.toFixed(1);
  });
}

/**
 * The loop, laid over its (relatively positioned) parent with a little overhang; pass `className`
 * to place it otherwise. The preview shows when a `group` ancestor is hovered or focused. The loop
 * is rebuilt at its size in pixels rather than stretched by the SVG: a stretched stroke's length on
 * screen drifts from the length the dashes are measured in (by zoom and width), cutting it short.
 */
export function MarkerLoop({
  loop: { d, tilt },
  state,
  onErased,
  className = '-top-2 -left-3 h-[calc(100%+1rem)] w-[calc(100%+1.5rem)]',
}: {
  loop: LoopShape;
  state: 'on' | 'erasing' | 'preview';
  onErased?: () => void;
  className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) => (s?.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stroke = {
    on: 'stroke-pop-purple motion-safe:animate-loop-draw',
    erasing: 'stroke-pop-purple motion-safe:animate-loop-erase motion-reduce:hidden',
    preview:
      'stroke-ink/25 opacity-0 transition-opacity group-enabled:group-hover:opacity-100 group-focus-visible:opacity-100',
  }[state];
  return (
    <svg
      ref={svg}
      aria-hidden="true"
      viewBox={size ? `0 0 ${size.width} ${size.height}` : undefined}
      className={`pointer-events-none absolute overflow-visible ${className} ${tilt}`}
    >
      {/* Drawn once it's measured, so the stroke starts from nothing at its real size. */}
      {size && (
        <path
          d={stretch(d, size.width, size.height)}
          pathLength={1}
          strokeDasharray={1}
          fill="none"
          strokeWidth={state === 'preview' ? 2 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={stroke}
          onAnimationEnd={state === 'erasing' ? onErased : undefined}
        />
      )}
    </svg>
  );
}
