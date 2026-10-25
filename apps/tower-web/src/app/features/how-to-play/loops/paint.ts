import { bloat, makePiece, SAMPLE_DRAWINGS, type Piece } from '@pictiotheme/doodle-shape';
import type { Stroke } from '@pictiotheme/protocol';
import { CURSE_TUNING } from '@pictiotheme/protocol/tower';
import { renderPieceBitmap, type PieceBitmap } from '../../piece';
import { displayFont, drawBalloon, drawCloud, MEADOW, PROPS, seeded } from '../../scenery';

/**
 * Painting the guide's looping pictures in the game's own look (docs/tower/design/
 * visual-identity.md): the sky, the plinths, the bunting, balloons, and real pieces, cut out of
 * doodle-shape's sample drawings the way the tower shows them. Canvas 2D, in stage px: every loop
 * is drawn on a stage `STAGE_W` px wide and as tall as the box allows (`H`), anchored to the
 * ground at the bottom.
 */

export const STAGE_W = 340;

export type Stage = { ctx: CanvasRenderingContext2D; W: number; H: number };

/** A looping picture: a pure function of the time since it started. */
export type Loop = {
  duration: number;
  /** The moment shown still, with reduced motion. */
  poster: number;
  draw: (stage: Stage, t: number) => void;
};

export const INK = 'oklch(0.27 0.08 275)';
const FROST = 'oklch(0.9 0.07 225 / 0.42)';
const FROST_EDGE = 'oklch(0.97 0.03 225 / 0.95)';
const PENNANTS = [
  'oklch(0.68 0.22 25)',
  'oklch(0.86 0.17 92)',
  'oklch(0.7 0.16 230)',
  'oklch(0.78 0.18 145)',
  'oklch(0.72 0.2 330)',
];
export const CREW = { orange: 'oklch(0.74 0.19 50)', teal: 'oklch(0.72 0.14 200)' };
export const GOLD = 'oklch(0.86 0.17 92)';

let bodyFont: string | null = null;
/** The page's text face (Fredoka), for the guess line. */
function uiFont(): string {
  bodyFont ??=
    getComputedStyle(document.documentElement).getPropertyValue('--font-fredoka').trim() ||
    'system-ui, sans-serif';
  return bodyFont;
}

/** One of doodle-shape's sample drawings, by its word. */
export function sample(word: string): readonly Stroke[] {
  return SAMPLE_DRAWINGS.find((d) => d.word === word)?.strokes ?? [];
}

/** A sample drawing as a piece: its shape, its cut-out look, and how far it reaches (world units). */
export type Cutout = {
  strokes: readonly Stroke[];
  piece: Piece;
  bitmap: PieceBitmap;
  minY: number;
  maxY: number;
  halfW: number;
};

/** A curse's look: melted (Melt, Blob) and grown (Big ice, Blob), as the game makes them. */
export type CursedLook = { melt?: boolean; bloat?: boolean };

const cutouts = new Map<string, Cutout | null>();

/** Strokes made into a piece and cut out, once per `key`. */
export function cutoutOf(
  key: string,
  strokes: readonly Stroke[],
  { melt = false, bloat: grow = false }: CursedLook = {},
): Cutout | null {
  const id = `${key}:${melt ? 'melt' : ''}:${grow ? 'bloat' : ''}`;
  if (!cutouts.has(id)) {
    const shape = makePiece(strokes, undefined, undefined, { melt });
    if (!shape.ok) {
      cutouts.set(id, null);
    } else {
      const piece = grow ? bloat(shape.piece, CURSE_TUNING.bloat) : shape.piece;
      const o = piece.outline;
      const xs = o.filter((_, i) => i % 2 === 0);
      const ys = o.filter((_, i) => i % 2 === 1);
      cutouts.set(id, {
        strokes,
        piece,
        bitmap: renderPieceBitmap(strokes, shape.piece, shape.preview),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        halfW: Math.max(-Math.min(...xs), Math.max(...xs)),
      });
    }
  }
  return cutouts.get(id) ?? null;
}

/** One of the sample drawings as a piece, plain or cursed. */
export const cutout = (word: string, look: CursedLook = {}) => cutoutOf(word, sample(word), look);

/** Where a piece's centre sits when it rests on `ground` (screen y, down). */
export const restingY = (c: Cutout, ground: number, ppu: number) => ground + c.minY * ppu;
/** The screen y of a piece's top, with its centre at `y`. */
export const topOf = (c: Cutout, y: number, ppu: number) => y - c.maxY * ppu;

/**
 * Draws a cut-out piece with its centre at (`x`, `y`), `ppu` px per metre. `squash` flattens it
 * (a landing), `frost` lays the Slippery curse's ice over it.
 */
export function drawCutout(
  ctx: CanvasRenderingContext2D,
  c: Cutout,
  x: number,
  y: number,
  ppu: number,
  { angle = 0, alpha = 1, scale = 1, squash = 0, frost = 0 } = {},
): void {
  if (alpha <= 0 || scale <= 0) return;
  const { piece, bitmap } = c;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale * (1 + squash), scale * (1 - squash));
  ctx.save();
  ctx.scale(piece.scale * ppu, piece.scale * ppu);
  ctx.drawImage(
    bitmap.canvas,
    bitmap.x - piece.origin.x,
    bitmap.y - piece.origin.y,
    bitmap.width,
    bitmap.height,
  );
  ctx.restore();
  if (frost > 0) {
    const o = piece.outline;
    ctx.scale(ppu, -ppu);
    ctx.beginPath();
    ctx.moveTo(o[0] as number, o[1] as number);
    for (let k = 2; k + 1 < o.length; k += 2) ctx.lineTo(o[k] as number, o[k + 1] as number);
    ctx.closePath();
    ctx.globalAlpha = alpha * frost;
    ctx.lineJoin = 'round';
    ctx.fillStyle = FROST;
    ctx.fill();
    ctx.strokeStyle = FROST_EDGE;
    ctx.lineWidth = 3 / ppu;
    ctx.stroke();
  }
  ctx.restore();
}

/** The sky, a few soft clouds drifting by, and the meadow from `ground` down. */
export function meadow({ ctx, W, H }: Stage, ground: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, MEADOW.skyTop);
  sky.addColorStop(1, MEADOW.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'oklch(1 0 0 / 0.75)';
  for (let i = 0; i < 3; i++) {
    const x = ((i * 137 + t * 0.008 * (1 + i * 0.3)) % (W + 120)) - 60;
    const y = 26 + i * 34;
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y - 6, 15, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 12, y - 3, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = MEADOW.hillFar;
  ctx.beginPath();
  ctx.ellipse(W * 0.25, ground + 6, W * 0.45, 26, 0, Math.PI, 0);
  ctx.ellipse(W * 0.8, ground + 6, W * 0.4, 20, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = MEADOW.grass;
  ctx.fillRect(0, ground, W, H - ground);
  ctx.fillStyle = MEADOW.grassLight;
  ctx.fillRect(0, ground, W, 3);
}

/** A tower's stone plinth standing on the meadow, its grassy cap's top at `top`. */
export function plinth(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  width: number,
  ground: number,
): void {
  const pillar = width * 0.62;
  ctx.fillStyle = MEADOW.stone;
  ctx.fillRect(cx - pillar / 2, top, pillar, ground - top + 2);
  ctx.fillStyle = MEADOW.stoneShade;
  ctx.fillRect(cx + pillar / 2 - 6, top, 6, ground - top + 2);
  ctx.strokeStyle = MEADOW.stoneLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = top + 16, row = 0; y < ground; y += 12, row++) {
    ctx.moveTo(cx - pillar / 2, y);
    ctx.lineTo(cx + pillar / 2, y);
    for (let x = cx - pillar / 2 + (row % 2 ? 10 : 20); x < cx + pillar / 2 - 4; x += 22) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(y + 12, ground));
    }
  }
  ctx.stroke();
  ctx.fillStyle = MEADOW.dirt;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top + 4, width, 9, [0, 0, 6, 6]);
  ctx.fill();
  ctx.fillStyle = MEADOW.grass;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top, width, 7, [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = MEADOW.grassLight;
  ctx.fillRect(cx - width / 2 + 4, top, width - 8, 2);
}

/** The topping-out bunting across the stage at `y`; gold and white while a tower tops out. */
export function bunting(
  { ctx, W }: Stage,
  y: number,
  t: number,
  cheering = false,
  from = 0,
  to = W,
): void {
  ctx.strokeStyle = 'oklch(1 0 0 / 0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(from, y);
  ctx.lineTo(to, y);
  ctx.stroke();
  const step = 15;
  for (let i = 0, x = from + 3; x < to - 6; x += step, i++) {
    const flutter = cheering ? Math.sin(t / 100 + i) * 2.5 : Math.sin(t / 500 + i * 0.8);
    ctx.fillStyle = cheering
      ? i % 2
        ? GOLD
        : 'oklch(1 0 0)'
      : (PENNANTS[i % PENNANTS.length] as string);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + step - 4, y);
    ctx.lineTo(x + (step - 4) / 2 + flutter, y + 10);
    ctx.closePath();
    ctx.fill();
  }
}

/** A bunch of three balloons holding something up from (`x`, `y`). */
export function balloons(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const colors = MEADOW.balloons;
  for (const [i, dx] of [-11, 0, 11].entries()) {
    drawBalloon(ctx, x + dx, y - 34 - (i === 1 ? 6 : 0), 8, colors[i] as string, 20, t / 1000 + i);
  }
}

/** A sheet of paper, as the drawing pad shows it. */
export function paper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'oklch(0.3 0.1 265 / 0.18)';
  ctx.beginPath();
  ctx.roundRect(x, y + 3, w, h, 10);
  ctx.fill();
  ctx.fillStyle = 'oklch(1 0 0)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

/**
 * A drawing in the box (`x`, `y`, `w`, `h`), drawn as far as `progress` (0–1) along its lines, as
 * if the drawer were drawing it.
 */
export function doodle(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  box: { x: number; y: number; w: number; h: number },
  progress: number,
  /** The drawing to fit in the box, if not just these strokes (a drawing in two parts). */
  fitTo: readonly Stroke[] = strokes,
): void {
  const brush = (all: readonly Stroke[]) =>
    all.filter((s): s is Extract<Stroke, { pts: number[] }> => s.tool === 'brush');
  const lines = brush(strokes);
  let [x0, y0, x1, y1, total] = [Infinity, Infinity, -Infinity, -Infinity, 0];
  for (const s of brush(fitTo)) {
    for (let i = 0; i + 1 < s.pts.length; i += 3) {
      const [px, py] = [s.pts[i] as number, s.pts[i + 1] as number];
      [x0, y0, x1, y1] = [Math.min(x0, px), Math.min(y0, py), Math.max(x1, px), Math.max(y1, py)];
    }
  }
  for (const s of lines) total += Math.floor(s.pts.length / 3);
  if (!total || progress <= 0) return;
  const scale = Math.min((box.w - 16) / Math.max(1, x1 - x0), (box.h - 16) / Math.max(1, y1 - y0));
  const dx = box.x + (box.w - (x1 - x0) * scale) / 2;
  const dy = box.y + (box.h - (y1 - y0) * scale) / 2;
  let left = Math.ceil(progress * total);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of lines) {
    if (left <= 0) break;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1.5, s.size * scale);
    ctx.beginPath();
    for (let i = 0; i + 1 < s.pts.length && left > 0; i += 3, left--) {
      const px = dx + ((s.pts[i] as number) - x0) * scale;
      const py = dy + ((s.pts[i + 1] as number) - y0) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

/** Display text (Lilita One), white with a soft dark outline like the tower's labels. */
export function shout(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  { fill = 'oklch(1 0 0)', alpha = 1 } = {},
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${displayFont()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = 'oklch(0.27 0.08 275 / 0.7)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A rounded tag with text: a verdict, a crew's name, a timer. */
export function tag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  { fill = 'oklch(1 0 0)', ink = INK, size = 12, scale = 1 } = {},
): void {
  if (scale <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `${size}px ${displayFont()}`;
  const w = ctx.measureText(text).width + size;
  const h = size * 1.7;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/** A chunky game button that presses down into its base. */
export function button(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  {
    fill,
    ink,
    base,
    pressed = false,
    alpha = 1,
  }: {
    fill: string;
    ink: string;
    base: string;
    pressed?: boolean;
    alpha?: number;
  },
): void {
  if (alpha <= 0) return;
  const drop = pressed ? 3 : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y + 3, box.w, box.h, 9);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y + drop, box.w, box.h, 9);
  ctx.fill();
  if (pressed) {
    ctx.strokeStyle = 'oklch(1 0 0 / 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = `13px ${displayFont()}`;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2 + drop + 1);
  ctx.restore();
}

/** A keyboard key, lit while it's pressed. */
export function key(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  pressed: boolean,
): void {
  const h = 20;
  const drop = pressed ? 2 : 0;
  ctx.fillStyle = 'oklch(0.8 0.06 265)';
  ctx.beginPath();
  ctx.roundRect(x, y + 2, w, h, 5);
  ctx.fill();
  ctx.fillStyle = pressed ? GOLD : 'oklch(1 0 0)';
  ctx.beginPath();
  ctx.roundRect(x, y + drop, w, h, 5);
  ctx.fill();
  ctx.font = `12px ${displayFont()}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + drop + 1);
}

/** The guess line: a white field with what's typed, and a caret while typing. */
export function guessField(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  { caret, edge }: { caret: boolean; edge: string },
): void {
  ctx.fillStyle = 'oklch(1 0 0)';
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 10);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `600 15px ${uiFont()}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const shown = text || 'Your guess…';
  if (!text) ctx.fillStyle = 'oklch(0.27 0.08 275 / 0.4)';
  ctx.fillText(shown, box.x + 12, box.y + box.h / 2 + 1);
  if (caret) {
    const cx = box.x + 13 + (text ? ctx.measureText(text).width : 0);
    ctx.fillStyle = INK;
    ctx.fillRect(cx, box.y + 8, 1.5, box.h - 16);
  }
}

/** The mouse pointer, its tip at (`x`, `y`); smaller while it clicks. */
export function pointer(ctx: CanvasRenderingContext2D, x: number, y: number, clicking = false) {
  ctx.save();
  ctx.translate(x, y);
  const s = clicking ? 0.85 : 1;
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4.5, 13);
  ctx.lineTo(7.5, 20);
  ctx.lineTo(10.5, 18.6);
  ctx.lineTo(7.6, 12);
  ctx.lineTo(13, 12);
  ctx.closePath();
  ctx.fillStyle = 'oklch(1 0 0)';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** A burst of confetti from (`x`, `y`), `k` 0–1 of the way through. */
export function confetti(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  if (k <= 0 || k >= 1) return;
  const rand = seeded(7);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const v = 40 + rand() * 60;
    const px = x + Math.cos(a) * v * k;
    const py = y + Math.sin(a) * v * k + 90 * k * k;
    ctx.fillStyle = PENNANTS[i % PENNANTS.length] as string;
    ctx.globalAlpha = 1 - k;
    ctx.fillRect(px, py, 4, 6);
  }
  ctx.globalAlpha = 1;
}

/** The sky washing over everything as a loop ends, `k` 0–1. */
export function veil({ ctx, W, H }: Stage, k: number): void {
  if (k <= 0) return;
  ctx.fillStyle = MEADOW.skyHorizon;
  ctx.globalAlpha = k;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

/** A piece in a stack: its centre and the screen y of its top. */
export type Placed = { c: Cutout; x: number; y: number; top: number };

/** Pieces stacked straight up from `ground`, centred on `cx` (each nudged sideways, px). */
export function stackUp(
  words: readonly string[],
  cx: number,
  ground: number,
  ppu: number,
  nudge: readonly number[] = [],
): Placed[] {
  const placed: Placed[] = [];
  let top = ground;
  words.forEach((word, i) => {
    const c = cutout(word);
    if (!c) return;
    const y = restingY(c, top, ppu);
    top = topOf(c, y, ppu);
    placed.push({ c, x: cx + (nudge[i] ?? 0), y, top });
  });
  return placed;
}

/** A warning over a tower before a spell hits it (2 s in a match), pulsing. */
export function warning(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  t: number,
) {
  tag(ctx, text, x, y, {
    fill: 'oklch(0.63 0.22 25)',
    ink: 'oklch(1 0 0)',
    size: 12,
    scale: 1 + 0.06 * Math.sin(t / 90),
  });
}

/**
 * The Fog spell over a tower, as the tower view draws it: everything above `bottom` hidden, a
 * soft edge, and a row of drifting puffs along it. `k` 0–1 as it rolls in and lifts.
 */
export function fog({ ctx, W }: Stage, bottom: number, k: number, t: number, ppu: number): void {
  if (k <= 0) return;
  const soft = 1.2 * ppu;
  const veil = ctx.createLinearGradient(0, bottom, 0, bottom - soft);
  veil.addColorStop(0, 'oklch(0.93 0.01 250 / 0)');
  veil.addColorStop(1, `oklch(0.93 0.01 250 / ${k})`);
  ctx.fillStyle = veil;
  ctx.fillRect(0, bottom - soft, W, soft);
  ctx.fillStyle = `oklch(0.93 0.01 250 / ${k})`;
  ctx.fillRect(0, 0, W, Math.max(0, bottom - soft));
  const puff = 2.2 * ppu;
  for (let x = -puff; x < W + puff; x += puff * 0.7) {
    const drift = Math.sin(t / 1600 + x * 0.013) * 0.15 * ppu;
    drawCloud(ctx, PROPS.cloud[0], x + drift, bottom - soft * 0.4, puff, k * 0.9);
  }
}

/**
 * A loop with a power's name in the top right corner, over everything (the fog too), so the
 * picture says which one it is.
 */
export function named(loop: Loop, label: { icon: string; name: string }): Loop {
  return {
    ...loop,
    draw(stage, t) {
      loop.draw(stage, t);
      const { ctx, W } = stage;
      ctx.font = `13px ${displayFont()}`;
      const text = `${label.icon} ${label.name}`;
      const w = ctx.measureText(text).width + 13;
      tag(ctx, text, W - 10 - w / 2, 18, { size: 13 });
    },
  };
}
