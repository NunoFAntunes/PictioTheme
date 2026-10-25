/**
 * Where avatars stand on an anchor, in viewport CSS px. Pure.
 */

/** A ledge: avatars stand side by side from `left` to `right`, feet at `y`. A point has no width. */
export type Ledge = {
  left: number;
  right: number;
  /** Where their feet go. */
  y: number;
  /** How big an avatar stands here: its drawing's longer side, in px. */
  size: number;
  /** A stretch to keep clear, like the clipboard's clip. Avatars fill outwards from it. */
  gap?: { left: number; right: number };
  /** They stand on a little cloud here. */
  cloud?: boolean;
};

/** Where one avatar stands: the middle of its feet, and its size. */
export type Stand = { x: number; y: number; size: number };

/** Gap between neighbours, as a share of their size. */
const SPACING = 1.1;
/** How tight they may squeeze before they shrink instead. */
const TIGHTEST = 0.7;

/** Spacing and size for `count` avatars packed from one end of a stretch `width` px long. */
function pack(width: number, count: number, size: number): { size: number; step: number } {
  if (count <= 1) return { size, step: 0 };
  const step = (width - size) / (count - 1);
  if (step >= size * SPACING) return { size, step: size * SPACING };
  if (step >= size * TIGHTEST) return { size, step };
  const smaller = width / (1 + TIGHTEST * (count - 1));
  return { size: smaller, step: smaller * TIGHTEST };
}

/** Where `count` avatars stand on `ledge`, slot by slot. */
export function standPoints(ledge: Ledge, count: number): Stand[] {
  if (count <= 0) return [];
  const { y, gap } = ledge;
  if (!gap) {
    const width = ledge.right - ledge.left;
    const { size, step } = pack(width, count, ledge.size);
    const middle = (ledge.left + ledge.right) / 2;
    const first = middle - (step * (count - 1)) / 2;
    return Array.from({ length: count }, (_, i) => ({ x: first + i * step, y, size }));
  }
  // Either side of the gap, nearest it first: slot 0 left of it, slot 1 right of it, and so on.
  const leftCount = Math.ceil(count / 2);
  const rightCount = count - leftCount;
  const leftSide = pack(gap.left - ledge.left, leftCount, ledge.size);
  const rightSide = pack(ledge.right - gap.right, rightCount, ledge.size);
  const size = Math.min(leftSide.size, rightCount ? rightSide.size : leftSide.size);
  const step = Math.min(
    leftCount > 1 ? leftSide.step : Infinity,
    rightCount > 1 ? rightSide.step : Infinity,
    size * SPACING,
  );
  return Array.from({ length: count }, (_, i) => {
    const k = Math.floor(i / 2);
    const x = i % 2 === 0 ? gap.left - size / 2 - k * step : gap.right + size / 2 + k * step;
    return { x, y, size };
  });
}
