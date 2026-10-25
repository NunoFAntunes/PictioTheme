import {
  bunting,
  confetti,
  CREW,
  cutout,
  drawCutout,
  GOLD,
  meadow,
  plinth,
  restingY,
  shout,
  tag,
  topOf,
  veil,
  type Cutout,
  type Loop,
  type Stage,
} from './paint';
import { easeIn, easeOutBack, fadeOut, ring, span } from './timeline';

/**
 * "Two crews, two towers": blocks land on both towers in turn, orange's climbs past the bunting,
 * counts down from 3 and tops out.
 */

const PPU = 22;
const FALL = 450;
/** Each crew's blocks, bottom up, and when each starts to fall (ms). */
const STACKS = {
  orange: { cx: 92, words: ['brick', 'house', 'brick', 'boot'], at: [300, 1400, 2500, 3600] },
  teal: { cx: 248, words: ['skateboard', 'mountain', 'ball'], at: [800, 1900, 3000] },
} as const;
const NUDGE = [-5, 4, -2, 6];
const TOPPED = 3600 + FALL;
// Topping out takes 3 seconds above the line, as in a match.
const BEAT = 1000;
const WIN = TOPPED + 50 + 3 * BEAT;
const DURATION = WIN + 1700;

type Placed = { c: Cutout; x: number; y: number; lands: number; top: number };

function stack(crew: keyof typeof STACKS, capTop: number): Placed[] {
  const { cx, words, at } = STACKS[crew];
  const placed: Placed[] = [];
  let ground = capTop;
  words.forEach((word, i) => {
    const c = cutout(word);
    if (!c) return;
    const y = restingY(c, ground, PPU);
    ground = topOf(c, y, PPU);
    placed.push({ c, x: cx + (NUDGE[i] ?? 0), y, lands: (at[i] ?? 0) + FALL, top: ground });
  });
  return placed;
}

function drawStack(ctx: CanvasRenderingContext2D, placed: readonly Placed[], t: number) {
  for (const p of placed) {
    const k = span(t, p.lands - FALL, p.lands);
    if (k <= 0) continue;
    const y = -60 + (p.y + 60) * easeIn(k);
    drawCutout(ctx, p.c, p.x, y, PPU, { squash: ring(t, p.lands, 320, 0.14, 4) });
  }
}

function draw(stage: Stage, t: number) {
  const { ctx, W, H } = stage;
  const ground = H - 28;
  const capTop = ground - 46;
  meadow(stage, ground, t);
  const orange = stack('orange', capTop);
  const teal = stack('teal', capTop);
  // The line: between orange's third and fourth blocks, so the fourth takes it over.
  const line = ((orange[2]?.top ?? 80) + (orange[3]?.top ?? 60)) / 2;
  const topping = t >= TOPPED;

  for (const crew of [STACKS.orange, STACKS.teal]) plinth(ctx, crew.cx, capTop, 6 * PPU, ground);
  drawStack(ctx, orange, t);
  drawStack(ctx, teal, t);
  bunting(stage, line, t, topping);
  tag(ctx, 'Orange', STACKS.orange.cx, ground + 14, { fill: CREW.orange });
  tag(ctx, 'Teal', STACKS.teal.cx, ground + 14, { fill: CREW.teal });

  // 3, 2, 1 over the tower that's above the line, then it's won.
  if (topping && t < WIN) {
    const beat = Math.floor((t - TOPPED - 50) / BEAT);
    const k = easeOutBack(span(t, TOPPED + 50 + beat * BEAT, TOPPED + 50 + beat * BEAT + 220));
    if (beat >= 0) {
      // Beside the tower, just above the line.
      const at = { x: STACKS.orange.cx + 52, y: line - 22 };
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(at.x, at.y, 16 * k, 0, Math.PI * 2);
      ctx.fill();
      shout(ctx, String(3 - beat), at.x, at.y + 1, 20 * k);
    }
  }
  if (t >= WIN) {
    const k = easeOutBack(span(t, WIN, WIN + 300));
    confetti(ctx, STACKS.orange.cx, (orange[3]?.top ?? 60) - 4, span(t, WIN, WIN + 1400));
    ctx.save();
    ctx.translate(W / 2, 26);
    ctx.scale(k, k);
    shout(ctx, 'Orange tops out!', 0, 0, 22, { fill: GOLD });
    ctx.restore();
  }
  veil(stage, fadeOut(t, DURATION));
}

export const towersLoop: Loop = { duration: DURATION, poster: WIN + 900, draw };
