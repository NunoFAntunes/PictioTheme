import {
  balloons,
  cutout,
  drawCutout,
  key,
  meadow,
  plinth,
  restingY,
  tag,
  topOf,
  veil,
  type Loop,
  type Stage,
} from './paint';
import { DROP_AT, placingAt } from './scripts';
import { easeIn, fadeOut, ring, span } from './timeline';

/**
 * "Place it": the boot floats down under its balloons over the tower, with its guide line; the
 * keys light up as it's moved right, turned level and dropped (Space). The balloons fly off.
 */

const PPU = 22;
const FALL = 380;
const DURATION = DROP_AT + FALL + 3200;
/** The keys, on the grass by the plinth's foot. */
const KEYS = [
  { label: '←', key: 'left', w: 20 },
  { label: '→', key: 'right', w: 20 },
  { label: '↑', key: 'turn', w: 20 },
  { label: 'Space', key: 'drop', w: 42 },
] as const;

function draw(stage: Stage, t: number) {
  const { ctx, W, H } = stage;
  const ground = H - 28;
  const capTop = ground - 36;
  const cx = W / 2;
  meadow(stage, ground, t);
  plinth(ctx, cx, capTop, 6 * PPU, ground);

  // The tower so far: a brick, and a skateboard on it.
  let top = capTop;
  for (const word of ['brick', 'skateboard']) {
    const c = cutout(word);
    if (!c) continue;
    const y = restingY(c, top, PPU);
    drawCutout(ctx, c, cx, y, PPU);
    top = topOf(c, y, PPU);
  }

  const boot = cutout('boot');
  const p = placingAt(t);
  if (boot) {
    const x = cx + p.x * PPU;
    const hanging = top - 74 + p.lowered * PPU;
    const rest = restingY(boot, top, PPU);
    const fall = easeIn(span(t, DROP_AT, DROP_AT + FALL));
    const y = hanging + (rest - hanging) * fall;
    if (t < DROP_AT) {
      // The guide: where it would land if dropped now.
      const half = boot.halfW * PPU;
      ctx.fillStyle = 'oklch(1 0 0 / 0.16)';
      ctx.fillRect(x - half, y, half * 2, top - y);
      ctx.strokeStyle = 'oklch(1 0 0 / 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x - half, y);
      ctx.lineTo(x - half, top);
      ctx.moveTo(x + half, y);
      ctx.lineTo(x + half, top);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The balloons let go on the drop and float away.
    const away = span(t, DROP_AT, DROP_AT + 1400);
    if (away < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - away;
      balloons(ctx, x, hanging - boot.maxY * PPU - 120 * easeIn(away), t);
      ctx.restore();
    }
    drawCutout(ctx, boot, x, y, PPU, {
      angle: p.angle,
      squash: ring(t, DROP_AT + FALL, 320, 0.14, 4),
    });
  }

  // The keys, lit as they're pressed, and the seconds left to place.
  let kx = 8;
  for (const k of KEYS) {
    key(ctx, k.label, kx, ground + 3, k.w, p.pressed === k.key);
    kx += k.w + 4;
  }
  if (t < DROP_AT) tag(ctx, `⏱ ${15 - Math.floor(t / 1000)}s`, W - 32, 22, { size: 12 });
  veil(stage, fadeOut(t, DURATION));
}

export const placeLoop: Loop = { duration: DURATION, poster: 2600, draw };
