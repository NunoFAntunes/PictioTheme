import { useState } from 'react';

/** The little tower's blocks, bottom up: x, width, colour, and how far each one tips. */
const BLOCKS = [
  { x: 6, w: 36, fill: 'var(--color-crew-teal)', tip: '0deg' },
  { x: 10, w: 28, fill: 'var(--color-sun)', tip: '-4deg' },
  { x: 4, w: 30, fill: 'var(--color-coral)', tip: '7deg' },
  { x: 14, w: 18, fill: 'var(--color-grass)', tip: '-10deg' },
] as const;

const BLOCK_H = 11;

/**
 * The "still being built" sign on the home page: a candy-striped road barrier over a note that
 * the game is in development, with a wobbly tower of blocks beside it. Click the tower and it
 * comes down, then stacks itself back up.
 */
export function UnderConstruction() {
  const [knocks, setKnocks] = useState(0);
  const [falling, setFalling] = useState(false);

  return (
    <aside
      aria-labelledby="under-construction-title"
      className="w-full max-w-md -rotate-1 motion-safe:animate-[plank-sway_7s_ease-in-out_infinite]"
    >
      {/* The barrier plank, on two little legs. */}
      <div className="candy-stripes relative z-10 mx-2 rounded-lg border-3 border-white px-3 py-1 text-center shadow-[0_4px_0_var(--color-coral-dark)]">
        <h2
          id="under-construction-title"
          className="title-outline font-display text-lg tracking-wider uppercase"
        >
          Under construction
        </h2>
      </div>
      <div className="mx-10 flex justify-between" aria-hidden>
        <span className="h-2.5 w-2 rounded-b bg-pebble-dark" />
        <span className="h-2.5 w-2 rounded-b bg-pebble-dark" />
      </div>

      <div className="card-panel flex items-center gap-3 rounded-2xl px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (falling) return;
            setFalling(true);
            setKnocks((k) => k + 1);
          }}
          aria-label="Knock the tower over"
          title={knocks > 2 ? 'Told you it wasn’t finished' : 'Poke it'}
          className="shrink-0 rounded-xl p-1 hover:bg-card-dark"
        >
          <svg viewBox="0 0 48 56" className="h-14 w-12 overflow-visible" aria-hidden>
            <rect x="0" y="52" width="48" height="4" rx="2" fill="var(--color-grass-dark)" />
            <g
              className={
                falling
                  ? 'animate-[tower-topple_1.1s_ease-in_forwards]'
                  : 'motion-safe:animate-[tower-teeter_2.4s_ease-in-out_infinite]'
              }
              style={{ transformBox: 'view-box', transformOrigin: '24px 52px' }}
              onAnimationEnd={(e) => {
                // The topple ends; the teeter loops forever and never does.
                if (e.animationName !== 'tower-topple') return;
                window.setTimeout(() => setFalling(false), 900);
              }}
            >
              {BLOCKS.map((b, i) => (
                <rect
                  key={i}
                  x={b.x}
                  y={52 - BLOCK_H * (i + 1)}
                  width={b.w}
                  height={BLOCK_H - 1}
                  rx="2.5"
                  fill={b.fill}
                  stroke="var(--color-ink)"
                  strokeWidth="1.5"
                  style={{
                    rotate: b.tip,
                    transformBox: 'fill-box',
                    transformOrigin: 'center bottom',
                  }}
                />
              ))}
            </g>
          </svg>
        </button>

        <p className="text-sm leading-snug font-medium text-ink/85">
          <strong className="font-display tracking-wide text-ink">
            Doodle Tower is still being built!
          </strong>{' '}
          Expect bugs, things wobbling in ways nobody planned, and powers that are far too strong
          (or not strong enough) while we balance it all out.
        </p>
      </div>
    </aside>
  );
}
