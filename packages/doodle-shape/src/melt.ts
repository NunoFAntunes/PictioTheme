import { createGrid, dilate, erode, pickBlob, type Frame, type Grid } from './grid';

/**
 * The Melt curse (docs/tower/planning/power-ups.md): the piece droops in the middle like a
 * melting candle, so its top dips and its bottom bulges (it rocks), and its corners round off.
 *
 * The droop is a parabola over the piece's width, in logical canvas px: the column at `x` moves
 * down by `meltShift(melt, x)`. The client warps the doodle's bitmap with the same function, so
 * the ink sags with the shape.
 */
export type Melt = { cx: number; halfWidth: number; sag: number };

export const MELT_TUNING = {
  /** How far the middle droops, as a share of the piece's height. */
  sag: 0.35,
  /** Corners round off with this radius, as a share of the piece's smaller side (in cells). */
  round: 0.18,
} as const;

/** How far down the column at logical `x` moves. */
export function meltShift(melt: Melt, x: number): number {
  const u = (x - melt.cx) / melt.halfWidth;
  return Math.abs(u) >= 1 ? 0 : melt.sag * (1 - u * u);
}

function boundsOf(grid: Grid) {
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.data[r * grid.cols + c]) continue;
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
  }
  return { minC, maxC, minR, maxR };
}

/**
 * Melts the piece's cells: a taller grid (the droop needs room below), each column shifted down,
 * then an opening to round the corners. If rounding would eat most of a thin piece, it's skipped.
 */
export function meltGrid(main: Grid, frame: Frame): { cells: Grid; melt: Melt } {
  const { minC, maxC, minR, maxR } = boundsOf(main);
  const width = maxC - minC + 1;
  const height = maxR - minR + 1;
  const melt: Melt = {
    cx: frame.x0 + ((minC + maxC + 1) / 2) * frame.cell,
    halfWidth: (width / 2) * frame.cell,
    sag: MELT_TUNING.sag * height * frame.cell,
  };
  const extra = Math.ceil(melt.sag / frame.cell) + 1;
  const sagged = createGrid(main.cols, main.rows + extra);
  for (let c = 0; c < main.cols; c++) {
    // The shift of the column's centre, in whole cells.
    const shift = Math.round(meltShift(melt, frame.x0 + (c + 0.5) * frame.cell) / frame.cell);
    for (let r = 0; r < main.rows; r++) {
      if (main.data[r * main.cols + c]) sagged.data[(r + shift) * sagged.cols + c] = 1;
    }
  }
  const radius = Math.max(1, Math.round(MELT_TUNING.round * Math.min(width, height)));
  const count = (g: Grid) => g.data.reduce((n, v) => n + v, 0);
  const opened = dilate(erode(sagged, radius), radius);
  const blob = pickBlob(opened, 0, 1, 0);
  const cells = blob && count(blob.main) > 0.6 * count(sagged) ? blob.main : sagged;
  return { cells, melt };
}
