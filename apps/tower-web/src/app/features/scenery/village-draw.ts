import { drawProp, MEADOW } from './meadow';
import { characterSprite, type Pose } from './sprites';
import {
  VILLAGER_HEIGHT,
  villagerLook,
  type Bubble,
  type Village,
  type Villager,
  type VillagerLook,
} from './village';

/**
 * Draws a village (`village.ts`): the props of its jobs, the villagers with their tools, speech
 * bubbles and stars, and the crumbs flying about. Fallen pieces are the tower renderer's.
 */

export type VillageView = {
  /** World → screen px. */
  S: (x: number, y: number) => { x: number; y: number };
  /** Screen px per world unit. */
  unit: number;
  /** The world y the villagers stand on. */
  feet: number;
  /** What's in view along the lane, in world units. */
  minX: number;
  maxX: number;
  /** The tower is topping out: everyone not otherwise busy cheers. */
  cheering: boolean;
};

const INK = 'oklch(0.3 0.05 265)';
const WOOD = 'oklch(0.68 0.11 62)';
const WOOD_DARK = 'oklch(0.5 0.09 55)';
const STEEL = 'oklch(0.62 0.02 250)';
const CAN = 'oklch(0.66 0.13 195)';
const WATER = 'oklch(0.78 0.11 230)';
const DUST = 'oklch(0.86 0.04 80)';
const STAR = 'oklch(0.88 0.17 95)';
const BANG = 'oklch(0.62 0.22 28)';

let font = '';
/** The display font (Lilita One), for canvas text. */
export function displayFont(): string {
  if (!font) {
    font =
      getComputedStyle(document.documentElement).getPropertyValue('--font-lilita').trim() ||
      'system-ui, sans-serif';
  }
  return font;
}

// ── Props ──

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = WOOD;
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = Math.max(1, w * 0.07);
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, w * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.moveTo(x - w / 2 + w * 0.15, y - h);
  ctx.lineTo(x + w / 2 - w * 0.15, y);
  ctx.stroke();
}

export function drawVillageProps(ctx: CanvasRenderingContext2D, v: Village, view: VillageView) {
  const { S, unit, feet } = view;
  for (const p of v.props) {
    if (p.x < view.minX - 2 || p.x > view.maxX + 2) continue;
    const at = S(p.x, feet);
    switch (p.kind) {
      case 'fence':
        drawProp(ctx, 'fence', at.x, at.y + 0.04 * unit, 0.72 * unit, p.flip);
        break;
      case 'flowers':
        for (let i = 0; i < 5; i++) {
          const x = at.x + (i - 2) * 0.17 * unit;
          const h = (0.22 + ((i * 7) % 4) * 0.05) * unit;
          ctx.strokeStyle = MEADOW.grassDark;
          ctx.lineWidth = Math.max(1, 0.03 * unit);
          ctx.beginPath();
          ctx.moveTo(x, at.y);
          ctx.lineTo(x, at.y - h);
          ctx.stroke();
          ctx.fillStyle = MEADOW.balloons[i % MEADOW.balloons.length] as string;
          ctx.beginPath();
          ctx.arc(x, at.y - h, 0.07 * unit, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'oklch(0.95 0.12 95)';
          ctx.beginPath();
          ctx.arc(x, at.y - h, 0.025 * unit, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'crates':
        drawCrate(ctx, at.x - 0.22 * unit, at.y, 0.42 * unit, 0.36 * unit);
        drawCrate(ctx, at.x + 0.22 * unit, at.y, 0.42 * unit, 0.36 * unit);
        drawCrate(ctx, at.x, at.y - 0.36 * unit, 0.42 * unit, 0.36 * unit);
        break;
    }
  }
}

// ── Tools, in the sprite's own px (96×128, origin at the bottom centre, facing right) ──

/** Where the fist is in a pose, and which way a held handle points (radians, y down). */
const GRIPS: Partial<Record<Pose, { x: number; y: number; angle: number }>> = {
  switch0: { x: 88, y: 68, angle: -1.75 },
  switch1: { x: 86, y: 107, angle: 0.35 },
  attack1: { x: 75, y: 53, angle: -1.95 },
  attack0: { x: 87, y: 87, angle: 0.3 },
  interact: { x: 90, y: 83, angle: 0 },
};

/** A hammer or mallet in the fist: drawn before the sprite, so the fist closes over it. */
function drawHeldTool(ctx: CanvasRenderingContext2D, look: VillagerLook) {
  const grip = GRIPS[look.pose];
  if (!grip || (look.tool !== 'hammer' && look.tool !== 'mallet')) return;
  const big = look.tool === 'mallet';
  const len = big ? 34 : 27;
  ctx.save();
  ctx.translate(grip.x - 48, grip.y - 128);
  ctx.rotate(grip.angle);
  ctx.fillStyle = WOOD_DARK;
  ctx.beginPath();
  ctx.roundRect(-5, -2.5, len + 5, 5, 2);
  ctx.fill();
  ctx.fillStyle = big ? WOOD : STEEL;
  ctx.strokeStyle = big ? WOOD_DARK : INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (big) ctx.roundRect(len - 4, -12, 16, 24, 4);
  else ctx.roundRect(len - 4, -9, 9, 18, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Tools held in front of the body: the crate, the watering can, the broom. */
function drawFrontTool(ctx: CanvasRenderingContext2D, look: VillagerLook, t: number) {
  switch (look.tool) {
    case 'crate':
      drawCrate(ctx, 66 - 48, 98 - 128, 36, 30);
      return;
    case 'can': {
      const [x, y] = [90 - 48, 83 - 128];
      ctx.fillStyle = CAN;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      // The spout first, tipped forward, then the can over its root.
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 12);
      ctx.lineTo(x + 30, y + 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = CAN;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.roundRect(x - 8, y + 2, 22, 20, 4);
      ctx.fill();
      ctx.stroke();
      if (look.pouring) {
        ctx.fillStyle = WATER;
        for (let i = 0; i < 4; i++) {
          const p = (t * 1.8 + i / 4) % 1;
          ctx.beginPath();
          ctx.arc(x + 31 + p * 7, y + 3 + p * 42, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }
    case 'broom': {
      const grip = GRIPS[look.pose] ?? { x: 90, y: 83 };
      const end = { x: 116 - 48, y: 120 - 128 };
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(grip.x - 48 - 8, grip.y - 128 - 8);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = 'oklch(0.82 0.12 85)';
      ctx.beginPath();
      ctx.moveTo(end.x - 6, end.y - 2);
      ctx.lineTo(end.x + 6, end.y - 2);
      ctx.lineTo(end.x + 12, end.y + 9);
      ctx.lineTo(end.x - 8, end.y + 9);
      ctx.closePath();
      ctx.fill();
      // A little dust kicked up.
      ctx.fillStyle = DUST;
      for (let i = 0; i < 2; i++) {
        const p = (t * 1.4 + i * 0.5) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.arc(end.x + 12 + p * 18, end.y + 6 - p * 14, 3 + p * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
  }
}

// ── Bubbles and stars, in screen px ──

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.3, y - s * 0.6, x, y - s * 0.25);
  ctx.bezierCurveTo(x + s * 0.3, y - s * 0.6, x + s * 0.6, y - s * 0.1, x, y + s * 0.35);
  ctx.fill();
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  bubble: Bubble,
  x: number,
  y: number,
  size: number,
  t: number,
) {
  const w = size * 1.5;
  const h = size;
  ctx.fillStyle = 'oklch(1 0 0 / 0.95)';
  ctx.strokeStyle = 'oklch(0.3 0.05 265 / 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.moveTo(x - w * 0.1, y + h / 2 - 1);
  ctx.lineTo(x - w * 0.28, y + h * 0.85);
  ctx.lineTo(x + w * 0.08, y + h / 2 - 1);
  ctx.fill();
  ctx.stroke();
  switch (bubble) {
    case 'talk': {
      ctx.fillStyle = INK;
      const n = 1 + (Math.floor(t * 3) % 3);
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x + (i - 1) * w * 0.24, y, Math.max(1.5, size * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case 'heart':
      ctx.fillStyle = BANG;
      drawHeart(ctx, x, y, size * 0.7);
      return;
    case 'bang':
    case 'huh':
      ctx.fillStyle = bubble === 'bang' ? BANG : INK;
      ctx.font = `${Math.round(size * 0.8)}px ${displayFont()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bubble === 'bang' ? '!' : '?', x, y + size * 0.04);
      ctx.textAlign = 'left';
      return;
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = turn + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ── Villagers ──

function cheerLook(look: VillagerLook, villager: Villager, t: number): VillagerLook {
  const beat = t * 6 + villager.phase * 7;
  return {
    ...look,
    pose: Math.sin(beat) > 0 ? 'cheer1' : 'cheer0',
    lift: Math.abs(Math.sin(beat)) * 0.15,
    tool: null,
    bubble: null,
  };
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  v: Village,
  villager: Villager,
  look: VillagerLook,
  view: VillageView,
) {
  const img = characterSprite(villager.character, look.pose);
  if (!img) return;
  const H = VILLAGER_HEIGHT * view.unit;
  const k = H / 128;
  const at = view.S(villager.x, view.feet + look.lift);
  // The frames leave a little air under the feet.
  const bottom = at.y + H * 0.04;
  ctx.save();
  ctx.translate(at.x, bottom);
  ctx.scale(villager.facing * look.sx, look.sy);
  ctx.scale(k, k);
  drawHeldTool(ctx, look);
  ctx.drawImage(img, -48, -128, 96, 128);
  drawFrontTool(ctx, look, v.time + villager.phase);
  ctx.restore();

  const top = bottom - H * look.sy;
  if (look.bubble) {
    const size = Math.max(14, 0.36 * view.unit);
    drawBubble(
      ctx,
      look.bubble,
      at.x + villager.facing * size * 0.7,
      top - size * 0.55,
      size,
      v.time,
    );
  }
  if (look.stars) {
    ctx.fillStyle = STAR;
    ctx.strokeStyle = 'oklch(0.55 0.12 70)';
    ctx.lineWidth = 1;
    const r = Math.max(3, 0.075 * view.unit);
    for (let i = 0; i < 3; i++) {
      const a = v.time * 5 + (i * Math.PI * 2) / 3;
      drawStar(
        ctx,
        at.x + Math.cos(a) * 0.32 * view.unit,
        top - 0.06 * view.unit + Math.sin(a) * 0.08 * view.unit,
        r,
        v.time * 3,
      );
    }
  }
}

/**
 * Draws the villagers in view. `layer` 'under' is just those pinned under a fallen piece (drawn
 * before the rubble); 'over' is everyone else.
 */
export function drawVillagers(
  ctx: CanvasRenderingContext2D,
  v: Village,
  view: VillageView,
  layer: 'under' | 'over' = 'over',
) {
  for (const villager of v.villagers) {
    if (villager.x < view.minX - 1 || villager.x > view.maxX + 1) continue;
    let look = villagerLook(v, villager);
    if (look.under !== (layer === 'under')) continue;
    const kind = villager.act.kind;
    if (view.cheering && (kind === 'job' || kind === 'back' || kind === 'gawk'))
      look = cheerLook(look, villager, v.time);
    drawOne(ctx, v, villager, look, view);
  }
}

/** Dust and paper crumbs from the rubble being broken up. */
export function drawCrumbs(ctx: CanvasRenderingContext2D, v: Village, view: VillageView) {
  for (const c of v.crumbs) {
    const at = view.S(c.x, c.y);
    const s = c.size * view.unit;
    ctx.globalAlpha = Math.max(0, 1 - c.age / 0.7);
    ctx.fillStyle = DUST;
    ctx.fillRect(at.x - s / 2, at.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}
