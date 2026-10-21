import {
  dismissBuilders,
  gatherBuilders,
  landPiece,
  type Cue,
  type RubbleCell,
  type Village,
} from './village';

/**
 * Things dropped from the page into the backdrop's village (the home page's menu, when all its
 * balloons are popped): each falls from where it was on screen, lands on the lane (squashing
 * whoever is under it), and lies there as a heap for the villagers to break up, like a piece
 * fallen off a tower (`tower/fallout.ts`). Then the villagers can be called to build.
 *
 * The page talks to the backdrop through a small mailbox: it posts orders (`dropOnBackdrop`,
 * `callBuilders`, `dismissBackdropBuilders`), the backdrop takes them each frame and posts back
 * what happened (`onBackdrop`): the village's sounds, and `cleared` once everything dropped is gone.
 */

/** Where the backdrop's lane is, for a window of `width` × `height` CSS px. */
export function backdropLayout(width: number, height: number) {
  const ground = Math.min(110, Math.max(64, height * 0.12));
  const horizon = height - ground;
  const feet = horizon + ground * 0.62;
  const unitPx = (ground * 0.78) / 1.25;
  return { ground, horizon, feet, unitPx, halfSpan: width / 2 / unitPx };
}

// ── The mailbox ──

/** A picture of something on the page, and where it is (CSS px, in the viewport). */
export type Drop = {
  image: HTMLCanvasElement;
  rect: { x: number; y: number; width: number; height: number };
};

export type BackdropOrder =
  | { kind: 'drop'; drops: Drop[] }
  /** `x` in CSS px across the window. */
  | { kind: 'build'; x: number; width: number; count: number }
  | { kind: 'dismiss' };

export type BackdropEvent =
  /** A village sound, with its pan (−1 to 1). */
  | { kind: 'cue'; cue: Cue; pan: number }
  /** Everything dropped has landed and been cleaned up. */
  | { kind: 'cleared' };

let orders: BackdropOrder[] = [];
const listeners = new Set<(event: BackdropEvent) => void>();

export function dropOnBackdrop(drops: Drop[]): void {
  orders.push({ kind: 'drop', drops });
}

/** Calls villagers to build at `x` (CSS px), spread over `width` px. */
export function callBuilders(x: number, width: number, count = 3): void {
  orders.push({ kind: 'build', x, width, count });
}

export function dismissBackdropBuilders(): void {
  orders.push({ kind: 'dismiss' });
}

export function onBackdrop(listener: (event: BackdropEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function takeBackdropOrders(): BackdropOrder[] {
  const taken = orders;
  orders = [];
  return taken;
}

export function emitBackdrop(event: BackdropEvent): void {
  for (const listener of listeners) listener(event);
}

// ── Falling and lying about ──

type Faller = {
  key: number;
  image: HTMLCanvasElement;
  /** Size, in world units. */
  w: number;
  h: number;
  /** The centre, in world units. */
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  va: number;
};

type Fallen = {
  image: HTMLCanvasElement;
  w: number;
  h: number;
  angle: number;
  cols: number;
  rows: number;
};

export type DropLife = {
  fallers: Faller[];
  fallen: Map<number, Fallen>;
  nextKey: number;
  /** Something was dropped and isn't cleaned up yet. */
  busy: boolean;
};

const GRAVITY = 9.81;
/** Dropped things rest with their lowest point a little into the grass, in front of the feet. */
const REST = -0.15;
/** About how many bits a dropped thing breaks into: few, so the menu is back soon. */
const CELLS = 4;
/** Keys well away from the ones a village might use. */
const FIRST_KEY = 10_000;

export function createDropLife(): DropLife {
  return { fallers: [], fallen: new Map(), nextKey: FIRST_KEY, busy: false };
}

/** The lowest point and the extent along x of a w × h box turned by `angle`, about its centre. */
function extent(w: number, h: number, angle: number) {
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const halfW = (w * cos + h * sin) / 2;
  const halfH = (w * sin + h * cos) / 2;
  return { bottom: -halfH, left: -halfW, right: halfW };
}

/** Turns orders into fallers, in world units (`toWorld` maps CSS px to the village). */
export function addDrops(
  life: DropLife,
  drops: readonly Drop[],
  unitPx: number,
  toWorld: (px: number, py: number) => { x: number; y: number },
  rnd: () => number,
): void {
  for (const { image, rect } of drops) {
    const centre = toWorld(rect.x + rect.width / 2, rect.y + rect.height / 2);
    life.fallers.push({
      key: life.nextKey++,
      image,
      w: rect.width / unitPx,
      h: rect.height / unitPx,
      x: centre.x,
      y: centre.y,
      angle: 0,
      vx: (rnd() - 0.5) * 1.2,
      vy: rnd() * 1.5,
      va: (rnd() - 0.5) * 1.4,
    });
  }
  if (drops.length) life.busy = true;
}

function land(life: DropLife, village: Village, f: Faller): void {
  const ext = extent(f.w, f.h, f.angle);
  const y = REST - ext.bottom;
  const size = Math.sqrt((f.w * f.h) / CELLS);
  const cols = Math.max(1, Math.round(f.w / size));
  const rows = Math.max(1, Math.round(f.h / size));
  const sin = Math.sin(f.angle);
  const cos = Math.cos(f.angle);
  const cells: RubbleCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = -f.w / 2 + ((c + 0.5) * f.w) / cols;
      const ly = -f.h / 2 + ((r + 0.5) * f.h) / rows;
      cells.push({ index: r * cols + c, x: f.x + cos * lx - sin * ly, y: y + sin * lx + cos * ly });
    }
  }
  life.fallen.set(f.key, { image: f.image, w: f.w, h: f.h, angle: f.angle, cols, rows });
  landPiece(village, {
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
 * Moves the fallers on by `dt` (or lands them at once, `still`), and forgets what's been cleaned
 * up. Returns true the moment everything dropped is gone. Call before stepping the village.
 */
export function stepDrops(life: DropLife, village: Village, dt: number, still = false): boolean {
  const falling: Faller[] = [];
  for (const f of life.fallers) {
    if (!still) {
      f.vy -= GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.angle += f.va * dt;
    }
    if (still || f.y + extent(f.w, f.h, f.angle).bottom <= REST) land(life, village, f);
    else falling.push(f);
  }
  life.fallers = falling;
  for (const key of life.fallen.keys()) {
    const used =
      village.rubble.some((r) => r.id === key) || village.chunks.some((c) => c.rubble === key);
    if (!used) life.fallen.delete(key);
  }
  if (life.busy && !life.fallers.length && !life.fallen.size) {
    life.busy = false;
    return true;
  }
  return false;
}

/** Carries out the build orders on the village. */
export function orderBuilders(
  village: Village,
  order: Extract<BackdropOrder, { kind: 'build' | 'dismiss' }>,
  unitPx: number,
  toWorld: (px: number, py: number) => { x: number; y: number },
): void {
  if (order.kind === 'dismiss') dismissBuilders(village);
  else gatherBuilders(village, toWorld(order.x, 0).x, order.count, order.width / unitPx);
}

// ── Drawing ──

/** Clips to a cell of a fallen thing's grid, in its own px about its centre. */
function cellRect(ctx: CanvasRenderingContext2D, f: Fallen, index: number, ppu: number): void {
  const c = index % f.cols;
  const r = Math.floor(index / f.cols);
  const cw = f.w / f.cols;
  const ch = f.h / f.rows;
  const x0 = -f.w / 2 + c * cw;
  const y1 = -f.h / 2 + (r + 1) * ch;
  // A hair of overlap so the cells don't show seams.
  ctx.rect(x0 * ppu - 0.5, -y1 * ppu - 0.5, cw * ppu + 1, ch * ppu + 1);
}

function paint(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  w: number,
  h: number,
  ppu: number,
) {
  ctx.drawImage(image, (-w / 2) * ppu, (-h / 2) * ppu, w * ppu, h * ppu);
}

/** What's falling, the heaps on the lane and the bits flying off them. */
export function drawDrops(
  ctx: CanvasRenderingContext2D,
  life: DropLife,
  village: Village,
  S: (x: number, y: number) => { x: number; y: number },
  ppu: number,
): void {
  for (const f of life.fallers) {
    const at = S(f.x, f.y);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(-f.angle);
    paint(ctx, f.image, f.w, f.h, ppu);
    ctx.restore();
  }
  for (const heap of village.rubble) {
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
    for (const cell of heap.cells) cellRect(ctx, fallen, cell.index, ppu);
    ctx.clip();
    paint(ctx, fallen.image, fallen.w, fallen.h, ppu);
    ctx.restore();
  }
  for (const chunk of village.chunks) {
    const fallen = life.fallen.get(chunk.rubble);
    if (!fallen) continue;
    const c = chunk.cell % fallen.cols;
    const r = Math.floor(chunk.cell / fallen.cols);
    const cx = -fallen.w / 2 + ((c + 0.5) * fallen.w) / fallen.cols;
    const cy = -fallen.h / 2 + ((r + 0.5) * fallen.h) / fallen.rows;
    const at = S(chunk.x, chunk.y);
    const fade = Math.max(0, 1 - chunk.age / 0.9);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(at.x, at.y);
    ctx.rotate(-(fallen.angle + chunk.angle));
    ctx.scale(0.5 + fade * 0.5, 0.5 + fade * 0.5);
    ctx.translate(-cx * ppu, cy * ppu);
    ctx.beginPath();
    cellRect(ctx, fallen, chunk.cell, ppu);
    ctx.clip();
    paint(ctx, fallen.image, fallen.w, fallen.h, ppu);
    ctx.restore();
  }
}
