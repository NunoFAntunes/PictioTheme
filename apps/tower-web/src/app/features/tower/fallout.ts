import type { Piece } from '@pictiotheme/doodle-shape';
import type { BodyState } from '@pictiotheme/tower-physics';
import {
  createTowerVillage,
  landPiece,
  stepVillage,
  takeCues,
  type Cue,
  type RubbleCell,
  type Village,
} from '../scenery';
import { GROUND, LANE } from './camera';
import { paintPiece, type PieceLook } from './piece-look';

/**
 * A tower's village life, and what happens to the pieces that fall off it
 * (docs/tower/design/visual-identity.md#villagers). The physics forgets a fumbled piece once
 * it's 2 units under the platform, almost on the ground; here it carries on falling with the
 * speed it had, lands on the lane with a thump and lies there, cut into a grid of cells, for the
 * villagers to break up one cell at a time.
 *
 * Purely cosmetic and per player: it only watches the bodies it's given each frame. A body that
 * disappears while under the platform's top has fallen; one that disappears from the platform
 * (a rematch, a resync) has not.
 */

type Grid = { minX: number; minY: number; size: number; cols: number; rows: number };

type Track = {
  look: PieceLook;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  va: number;
};

type Faller = {
  key: number;
  look: PieceLook;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  va: number;
};

export type TowerLife = {
  village: Village;
  tracks: Map<number, Track>;
  fallers: Faller[];
  /** Fallen pieces' looks and grids, by rubble id, while any of them is still about. */
  fallen: Map<number, { look: PieceLook; grid: Grid; angle: number }>;
  nextKey: number;
};

/** A body that vanishes this far under the platform's top fell off. */
const FELL_BELOW = -0.5;
/** Fallen pieces rest with their lowest point a little into the lane. */
const REST = LANE - 0.1;

export function createTowerLife(seed: number, platformWidth: number): TowerLife {
  return {
    village: createTowerVillage(seed, platformWidth / 2, GROUND),
    tracks: new Map(),
    fallers: [],
    fallen: new Map(),
    nextKey: 1,
  };
}

/** The lowest point and the extent along x of an outline turned by `angle`, about its centroid. */
function extent(outline: readonly number[], angle: number) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  let bottom = Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (let i = 0; i + 1 < outline.length; i += 2) {
    const lx = outline[i] as number;
    const ly = outline[i + 1] as number;
    const x = cos * lx - sin * ly;
    bottom = Math.min(bottom, sin * lx + cos * ly);
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return { bottom, left, right };
}

function inside(outline: readonly number[], x: number, y: number): boolean {
  let hit = false;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[2 * i] as number;
    const yi = outline[2 * i + 1] as number;
    const xj = outline[2 * j] as number;
    const yj = outline[2 * j + 1] as number;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Cuts a piece into square cells, about nine to a piece, and lists the ones it covers. */
function gridFor(piece: Piece): {
  grid: Grid;
  filled: { index: number; cx: number; cy: number }[];
} {
  const o = piece.outline;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < o.length; i += 2) {
    minX = Math.min(minX, o[i] as number);
    maxX = Math.max(maxX, o[i] as number);
    minY = Math.min(minY, o[i + 1] as number);
    maxY = Math.max(maxY, o[i + 1] as number);
  }
  const size = Math.max(0.22, Math.min(0.7, Math.sqrt(piece.area / 9)));
  const cols = Math.max(1, Math.ceil((maxX - minX) / size));
  const rows = Math.max(1, Math.ceil((maxY - minY) / size));
  const grid = { minX, minY, size, cols, rows };
  const filled: { index: number; cx: number; cy: number }[] = [];
  const samples = [
    [0.5, 0.5],
    [0.2, 0.2],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.8, 0.8],
  ] as const;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = minX + c * size;
      const y0 = minY + r * size;
      if (samples.some(([u, w]) => inside(o, x0 + u * size, y0 + w * size)))
        filled.push({ index: r * cols + c, cx: x0 + size / 2, cy: y0 + size / 2 });
    }
  }
  if (!filled.length) filled.push({ index: 0, cx: minX + size / 2, cy: minY + size / 2 });
  return { grid, filled };
}

function land(life: TowerLife, f: Faller): void {
  const ext = extent(f.look.piece.outline, f.angle);
  const y = REST - ext.bottom;
  const { grid, filled } = gridFor(f.look.piece);
  const sin = Math.sin(f.angle);
  const cos = Math.cos(f.angle);
  const cells: RubbleCell[] = filled.map((c) => ({
    index: c.index,
    x: f.x + cos * c.cx - sin * c.cy,
    y: y + sin * c.cx + cos * c.cy,
  }));
  life.fallen.set(f.key, { look: f.look, grid, angle: f.angle });
  landPiece(life.village, {
    id: f.key,
    x: f.x,
    y,
    angle: f.angle,
    left: f.x + ext.left,
    right: f.x + ext.right,
    cells,
  });
}

/**
 * Call once per frame with the tower's bodies and their looks. Notices pieces that fell, carries
 * them down to the lane, and steps the village (not with `still`, for reduced motion: then the
 * villagers hold their poses and a fallen piece lands at once). Returns the sounds to play.
 */
export function updateTowerLife(
  life: TowerLife,
  bodies: readonly BodyState[],
  looks: ReadonlyMap<number, PieceLook>,
  dt: number,
  still = false,
): Cue[] {
  const seen = new Set<number>();
  for (const body of bodies) {
    const look = looks.get(body.id);
    if (!look) continue;
    seen.add(body.id);
    const prev = life.tracks.get(body.id);
    const k = prev && dt > 0 ? 1 / dt : 0;
    life.tracks.set(body.id, {
      look,
      x: body.x,
      y: body.y,
      angle: body.angle,
      vx: prev ? (body.x - prev.x) * k : 0,
      vy: prev ? (body.y - prev.y) * k : 0,
      va: prev ? (body.angle - prev.angle) * k : 0,
    });
  }
  for (const [id, track] of life.tracks) {
    if (seen.has(id)) continue;
    life.tracks.delete(id);
    if (track.y > FELL_BELOW) continue;
    const faller: Faller = {
      key: life.nextKey++,
      look: track.look,
      x: track.x,
      y: track.y,
      angle: track.angle,
      vx: Math.max(-6, Math.min(6, track.vx)),
      vy: Math.max(-14, Math.min(0, track.vy)),
      va: Math.max(-8, Math.min(8, track.va)),
    };
    if (still) land(life, faller);
    else life.fallers.push(faller);
  }

  const falling: Faller[] = [];
  for (const f of life.fallers) {
    f.vy -= 9.81 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.angle += f.va * dt;
    if (f.y + extent(f.look.piece.outline, f.angle).bottom <= REST) land(life, f);
    else falling.push(f);
  }
  life.fallers = falling;

  if (!still) stepVillage(life.village, dt);
  // Forget the looks nothing needs any more.
  for (const key of life.fallen.keys()) {
    const used =
      life.village.rubble.some((r) => r.id === key) ||
      life.village.chunks.some((c) => c.rubble === key);
    if (!used) life.fallen.delete(key);
  }
  return takeCues(life.village);
}

// ── Drawing ──

function cellRect(ctx: CanvasRenderingContext2D, grid: Grid, index: number, ppu: number): void {
  const c = index % grid.cols;
  const r = Math.floor(index / grid.cols);
  const x0 = grid.minX + c * grid.size;
  const y1 = grid.minY + (r + 1) * grid.size;
  // A hair of overlap so the cells don't show seams.
  ctx.rect(x0 * ppu - 0.5, -y1 * ppu - 0.5, grid.size * ppu + 1, grid.size * ppu + 1);
}

/** The pieces still falling, the heaps on the lane and the bits flying off them. */
export function drawFallout(
  ctx: CanvasRenderingContext2D,
  life: TowerLife,
  S: (x: number, y: number) => { x: number; y: number },
  ppu: number,
): void {
  for (const f of life.fallers) {
    const at = S(f.x, f.y);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(-f.angle);
    paintPiece(ctx, f.look, ppu);
    ctx.restore();
  }
  for (const heap of life.village.rubble) {
    const fallen = life.fallen.get(heap.id);
    if (!fallen) continue;
    const at = S(heap.x, heap.y);
    // It lands with a little squash.
    const settle = Math.min(1, heap.age / 0.3);
    const squash = 1 - 0.18 * Math.sin(settle * Math.PI) * (1 - settle * 0.5);
    const base = S(heap.x, REST);
    ctx.save();
    ctx.translate(at.x, base.y);
    ctx.scale(1 + (1 - squash) * 0.6, squash);
    ctx.translate(0, at.y - base.y);
    ctx.rotate(-heap.angle);
    ctx.beginPath();
    for (const cell of heap.cells) cellRect(ctx, fallen.grid, cell.index, ppu);
    ctx.clip();
    paintPiece(ctx, fallen.look, ppu);
    ctx.restore();
  }
  for (const chunk of life.village.chunks) {
    const fallen = life.fallen.get(chunk.rubble);
    if (!fallen) continue;
    const { grid } = fallen;
    const c = chunk.cell % grid.cols;
    const r = Math.floor(chunk.cell / grid.cols);
    const cx = grid.minX + (c + 0.5) * grid.size;
    const cy = grid.minY + (r + 0.5) * grid.size;
    const at = S(chunk.x, chunk.y);
    const fade = Math.max(0, 1 - chunk.age / 0.9);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(at.x, at.y);
    ctx.rotate(-(fallen.angle + chunk.angle));
    ctx.scale(0.5 + fade * 0.5, 0.5 + fade * 0.5);
    ctx.translate(-cx * ppu, cy * ppu);
    ctx.beginPath();
    cellRect(ctx, grid, chunk.cell, ppu);
    ctx.clip();
    paintPiece(ctx, fallen.look, ppu);
    ctx.restore();
  }
}
