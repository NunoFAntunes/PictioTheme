/**
 * The zig-zag line the two games share the screen along: from top to bottom (left to right on a
 * phone, where they're stacked), leaning a little and zig-zagging like a hand-torn edge. Each half
 * is a `clip-path` polygon with this edge, around `var(--split)`, the share of the screen the
 * first game has (global.css animates it). The halves stop `GAP` short of the line, so the ink
 * behind them draws it.
 */

/** How far the line leans: the top is this far past the split, the bottom this far before it. */
const LEAN = 5;
/**
 * The zig-zag, point by point across the line, a little uneven so it looks drawn. The first
 * stretch hangs straight down from the top, under the "you" sticker that pins it (global.css).
 */
const TEETH = [0, 1, -1.2, 1.9, -1.5, 1.3, -1.8, 1.4, -1.1, 1.7, 0];
/** Half the line's width, in px. */
const GAP = 3;

type Axis = 'wide' | 'tall';

/** How far the line is from the split `along` the way down (0–1), in vw (wide) or vh (tall). */
export function lineOffset(along: number): number {
  const at = along * (TEETH.length - 1);
  const i = Math.min(Math.floor(at), TEETH.length - 2);
  const point = (n: number) => LEAN * (1 - (2 * n) / (TEETH.length - 1)) + (TEETH[n] ?? 0);
  return point(i) + (point(i + 1) - point(i)) * (at - i);
}

function edge(axis: Axis, side: -1 | 1): string[] {
  // The lean and teeth are in vw across a wide screen and vh down a tall one, so they keep their
  // shape whatever the split.
  const unit = axis === 'wide' ? 'vw' : 'vh';
  return TEETH.map((tooth, i) => {
    const along = (i / (TEETH.length - 1)) * 100;
    const offset = LEAN * (1 - (2 * i) / (TEETH.length - 1)) + tooth;
    const across = `calc(var(--split) + ${offset.toFixed(2)}${unit} + ${side * GAP}px)`;
    return axis === 'wide' ? `${across} ${along}%` : `${along}% ${across}`;
  });
}

/** The first game's half (left, or top) and the second's, as `clip-path` values. */
export function clipPaths(axis: Axis): { first: string; second: string } {
  // The line runs top to bottom (wide) or left to right (tall); each polygon goes round its half.
  const before = edge(axis, -1);
  const after = edge(axis, 1);
  const first =
    axis === 'wide' ? ['0 0', ...before, '0 100%'] : ['0 0', '100% 0', ...before.toReversed()];
  const second =
    axis === 'wide'
      ? ['100% 0', '100% 100%', ...after.toReversed()]
      : [...after, '100% 100%', '0 100%'];
  return { first: `polygon(${first.join(', ')})`, second: `polygon(${second.join(', ')})` };
}
