import type { CSSProperties } from 'react';

/**
 * A balloon popping, in SVG: a bang star where it was, shreds of rubber flying off, and its string
 * dropping away. The same for the logo's O's and the menu's balloons. `cx`, `cy` is the balloon's
 * centre and `r` its half-height, in the SVG's units; everything is sized from them.
 */

const OUTLINE = 'var(--color-dusk-950)';

/** The bang, around the centre, in half-heights of the balloon. */
const STAR = [
  [0, -1.03],
  [0.2, -0.4],
  [0.86, -0.63],
  [0.43, -0.06],
  [0.91, 0.4],
  [0.26, 0.34],
  [0.11, 1.03],
  [-0.14, 0.4],
  [-0.8, 0.63],
  [-0.43, 0.06],
  [-0.91, -0.4],
  [-0.23, -0.34],
] as const;

/** Bits of rubber flying off: where they go (in half-heights) and how they spin. */
const SHREDS = [
  { dx: -1.43, dy: -1, r: '-200deg' },
  { dx: 1.29, dy: -1.14, r: '160deg' },
  { dx: -1.57, dy: 0.57, r: '120deg' },
  { dx: 1.57, dy: 0.43, r: '-140deg' },
  { dx: 0, dy: -1.57, r: '220deg' },
  { dx: 0.29, dy: 1.29, r: '-90deg' },
];

/** Each animated part turns and scales about itself. */
const OWN_BOX: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };

export function BalloonPop({
  cx,
  cy,
  r,
  color,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
}) {
  const star = `M${STAR.map(([x, y]) => `${cx + x * r} ${cy + y * r}`).join(' ')}Z`;
  const s = r / 35;
  const knot = cy + r * 1.14;
  return (
    <g aria-hidden="true" className="pointer-events-none">
      <path
        d={star}
        fill="var(--color-sun)"
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
        className="animate-balloon-burst"
        style={OWN_BOX}
      />
      {SHREDS.map(({ dx, dy, r: spin }, i) => (
        <rect
          key={i}
          x={cx - 0.1 * r}
          y={cy - 0.2 * r}
          width={0.34 * r}
          height={0.26 * r}
          rx={0.13 * r}
          fill={color}
          className="animate-balloon-shred"
          style={
            {
              ...OWN_BOX,
              '--dx': `${dx * r}px`,
              '--dy': `${dy * r}px`,
              '--r': spin,
            } as CSSProperties
          }
        />
      ))}
      {/* The string drops by half an em: set the em to the logo's, scaled to this balloon. */}
      <path
        d={`M${cx} ${knot}c${-6 * s} ${8 * s} ${6 * s} ${14 * s} 0 ${22 * s}s${5 * s} ${12 * s} ${2 * s} ${18 * s}`}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={3}
        strokeLinecap="round"
        className="animate-string-fall"
        style={{ transformBox: 'fill-box', transformOrigin: 'center top', fontSize: r * 2.86 }}
      />
    </g>
  );
}
