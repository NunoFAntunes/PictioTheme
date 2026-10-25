import type { CSSProperties } from 'react';
import type { Game } from '../../site';

/**
 * DoodleWhirl's half: its home page in miniature (apps/web's index.astro). A sheet of ruled paper
 * dropped on the desk, the logo in coloured sticker letters, pencil doodles on the desk, and now and
 * then a paper plane. What's on the paper is sized by the paper, so the logo always fits on it.
 */

const POPS = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

/** Pencil doodles on the desk, around the paper: where, how big, and the drawing. */
const DOODLES: { at: CSSProperties; size: string; d: string }[] = [
  // A star.
  {
    at: { top: '9%', left: '8%', rotate: '-12deg' },
    size: '4.5rem',
    d: 'M50 6 61 38 95 39 68 59 78 92 50 72 22 92 32 59 5 39 39 38Z',
  },
  // A spiral.
  {
    at: { bottom: '11%', left: '10%', rotate: '20deg' },
    size: '5rem',
    d: 'M50 50c0-6 9-6 9 0 0 10-17 10-17 0 0-14 25-14 25 0 0 19-34 19-34 0 0-24 43-24 43 0',
  },
  // A heart.
  {
    at: { top: '14%', right: '16%', rotate: '14deg' },
    size: '3.5rem',
    d: 'M50 88C20 66 6 48 10 30 14 12 38 10 50 30 62 10 86 12 90 30 94 48 80 66 50 88Z',
  },
  // A little sun.
  {
    at: { bottom: '8%', right: '18%', rotate: '-8deg' },
    size: '4.5rem',
    d: 'M50 32a18 18 0 1 0 .1 0M50 6v12M50 82v12M6 50h12M82 50h12M19 19l8 8M73 73l8 8M81 19l-8 8M27 73l-8 8',
  },
];

/** A folded paper plane, thrown across the desk now and then (global.css). */
function PaperPlane() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 40"
      className="paper-plane absolute top-0 left-0 w-[min(12cqi,5rem)] drop-shadow-[0_12px_6px_rgb(0_0_0/0.15)]"
    >
      <g stroke="var(--color-ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
        <path d="M2 18 62 2 24 26Z" fill="var(--color-paper)" />
        <path d="M24 26 62 2 30 38Z" fill="oklch(0.93 0.03 85)" />
        <path d="M24 26 26 34 30 38" fill="none" />
      </g>
    </svg>
  );
}

export function DoodleWhirlPreview({ game }: { game: Game }) {
  return (
    <div className="absolute inset-0 bg-desk">
      <div className="pane-content">
        {DOODLES.map(({ at, size, d }, i) => (
          <svg
            key={d}
            aria-hidden="true"
            viewBox="0 0 100 100"
            className="pane-doodle absolute text-doodle"
            style={{ ...at, width: size, height: size }}
          >
            <path
              d={d}
              pathLength={1}
              style={{ '--delay': `${200 + i * 180}ms` } as CSSProperties}
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ))}
        <PaperPlane />
        <div className="pane-art @container relative w-[min(86cqi,34rem)] -rotate-2 rounded-sm bg-paper bg-[repeating-linear-gradient(to_bottom,transparent_0_2.25rem,var(--color-paper-line)_2.25rem_calc(2.25rem+1px))] pt-[min(3.5rem,7cqh)] pb-[min(2.5rem,5cqh)] text-center text-ink shadow-[0_2px_0_rgb(0_0_0/0.06),0_30px_60px_-24px_rgb(0_0_0/0.45)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-[7cqi] w-px bg-pop-tomato/50"
          />
          <div className="rotate-1 px-[6cqi]">
            <h2 className="font-logo text-[12.5cqi] leading-none">
              <span className="sr-only">{game.name}</span>
              <span aria-hidden="true" className="inline-flex">
                {[...game.name].map((char, i) => (
                  <span
                    key={i}
                    className="sticker-letter inline-block px-[0.01em]"
                    style={
                      {
                        color: POPS[i % POPS.length],
                        '--tilt': `${i % 2 ? 6 : -6}deg`,
                        '--i': i,
                        marginLeft: i === 6 ? '0.14em' : undefined,
                      } as CSSProperties
                    }
                  >
                    {char}
                  </span>
                ))}
              </span>
            </h2>
            <p className="mx-auto mt-[min(1.5rem,3cqh)] max-w-[22rem] text-lg leading-snug font-bold">
              {game.tagline}
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink/55">{game.players}</p>
            <span className="pane-play mt-[min(1.5rem,3cqh)] inline-block -rotate-2 rounded-lg border-[2px_2.5px_3px_2px] border-ink bg-pop-sun px-6 py-2 text-xl font-black shadow-[3px_4px_0_var(--color-ink)]">
              Play →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
