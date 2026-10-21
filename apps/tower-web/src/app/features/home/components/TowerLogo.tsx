import { useEffect, useRef, useState } from 'react';
import { playHomeCue } from '../../sound';
import { BalloonPop } from './BalloonPop';

/**
 * The logo (docs/tower/design/screens.md#1-home): "Doodle Tower" in the display font, with the
 * game in it. The three O's are balloons, like the ones carrying a piece down: click one and it
 * pops, and a new one blows up a moment later. The T is the stone plinth with its grassy cap that
 * every tower stands on. The heading reads "Doodle Tower" to screen readers; the toys are hidden.
 *
 * Shapes are drawn in em-sized SVGs, 100 units to the em, with the same dark outline and drop
 * as the letters (`title-outline`).
 */

const OUTLINE = 'var(--color-dusk-950)';
/** The letters' outline is 0.09em, half of it hidden under the fill. */
const STROKE = 9;
/** The letters' drop shadow, 0.08em. */
const DROP = 8;

/** How long a popped balloon stays gone. */
const REGROW_MS = 2600;

type BalloonState = 'whole' | 'popped' | 'inflating';

/** One O: a balloon on a short string, the size of the letter. */
function LogoBalloon({ color, delay }: { color: string; delay: number }) {
  const [state, setState] = useState<BalloonState>('whole');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pop = (e: React.PointerEvent) => {
    if (state === 'popped') return;
    const pan = (e.clientX / window.innerWidth) * 2 - 1;
    playHomeCue('balloon-pop', pan);
    setState('popped');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      playHomeCue('inflate', pan);
      setState('inflating');
      timer.current = setTimeout(() => setState('whole'), 700);
    }, REGROW_MS);
  };

  return (
    <span
      data-testid="logo-balloon"
      data-state={state}
      className="relative mx-[0.01em] inline-block h-[0.72em] w-[0.64em] cursor-pointer"
      onPointerDown={pop}
    >
      {state === 'popped' ? (
        <svg viewBox="0 0 64 72" className="absolute inset-0 h-full w-full overflow-visible">
          <BalloonPop cx={32} cy={36} r={35} color={color} />
        </svg>
      ) : (
        <span
          className="absolute inset-0 animate-balloon-bob"
          style={{ animationDelay: `${delay}s` }}
        >
          <svg
            viewBox="0 0 64 72"
            className={`absolute inset-0 h-full w-full origin-bottom overflow-visible transition-transform duration-150 hover:scale-105 ${state === 'inflating' ? 'animate-inflate' : ''}`}
          >
            {/* The string, curling under the word. */}
            <path
              d="M32 76c-6 8 6 14 0 22s5 12 2 18"
              fill="none"
              stroke={OUTLINE}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* The drop, then the balloon and its knot, outlined like the letters. */}
            <g
              transform={`translate(0 ${DROP})`}
              fill={OUTLINE}
              stroke={OUTLINE}
              strokeWidth={STROKE}
            >
              <ellipse cx={32} cy={36} rx={30} ry={35} />
              <path d="M32 70 26 79h12Z" strokeLinejoin="round" />
            </g>
            <g fill={color} stroke={OUTLINE} strokeWidth={STROKE} paintOrder="stroke">
              <path d="M32 70 26 79h12Z" strokeLinejoin="round" />
              <ellipse cx={32} cy={36} rx={30} ry={35} />
            </g>
            <ellipse
              cx={20}
              cy={20}
              rx={6}
              ry={11}
              fill="white"
              opacity={0.6}
              transform="rotate(30 20 20)"
            />
          </svg>
        </span>
      )}
    </span>
  );
}

/** The T: a stone plinth with a grassy cap, like the one under every tower. */
function PlinthT() {
  const silhouette = (
    <>
      <rect x={16} y={16} width={32} height={56} rx={3} />
      <rect x={0} y={0} width={64} height={24} rx={6} />
    </>
  );
  return (
    <span className="relative mr-[0.02em] inline-block h-[0.72em] w-[0.64em]">
      <svg viewBox="0 0 64 72" className="absolute inset-0 h-full w-full overflow-visible">
        <g transform={`translate(0 ${DROP})`} fill={OUTLINE} stroke={OUTLINE} strokeWidth={STROKE}>
          {silhouette}
        </g>
        <g stroke={OUTLINE} strokeWidth={STROKE} paintOrder="stroke" strokeLinejoin="round">
          {/* The column, in courses of stone. */}
          <rect x={16} y={16} width={32} height={56} rx={3} fill="oklch(0.86 0.025 85)" />
          {/* The cap: a stone slab with grass spilling over its top. */}
          <rect x={0} y={0} width={64} height={24} rx={6} fill="oklch(0.86 0.025 85)" />
        </g>
        <g stroke="oklch(0.62 0.04 70)" strokeWidth={2.5} strokeLinecap="round">
          <path d="M18 38h28M18 56h28M32 24v14M25 38v18M39 56v14" />
          <path d="M22 12v10M44 12v10" />
        </g>
        <path
          d="M2 4Q2 0 6 0h52q4 0 4 4v8q-3 4-6 0-3 5-7 0-3 4-7 0-3 5-7 0-3 4-7 0-3 5-7 0-3 4-7 0-3 5-6 0Z"
          fill="oklch(0.76 0.19 140)"
        />
        <path d="M6 2h50" stroke="oklch(0.85 0.17 132)" strokeWidth={3} strokeLinecap="round" />
        <rect
          x={0}
          y={0}
          width={64}
          height={24}
          rx={6}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={STROKE / 2}
        />
      </svg>
    </span>
  );
}

export function TowerLogo() {
  return (
    <h1
      aria-label="Doodle Tower"
      className="title-outline text-center font-display text-8xl leading-none tracking-wide whitespace-nowrap select-none"
    >
      <span aria-hidden="true">
        D
        <LogoBalloon color="oklch(0.68 0.22 25)" delay={0} />
        <LogoBalloon color="oklch(0.85 0.17 92)" delay={-1.3} />
        dle{' '}
        <span className="text-sun">
          <PlinthT />
          <LogoBalloon color="oklch(0.7 0.16 230)" delay={-2.1} />
          wer
        </span>
      </span>
    </h1>
  );
}
