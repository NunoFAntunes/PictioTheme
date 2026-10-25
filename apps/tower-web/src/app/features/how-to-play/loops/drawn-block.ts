import {
  cutout,
  doodle,
  drawCutout,
  meadow,
  paper,
  plinth,
  restingY,
  shout,
  tag,
  veil,
  type Loop,
  type Stage,
} from './paint';
import { easeIn, easeOutBack, fadeOut, ring, span } from './timeline';

/**
 * "Your drawing is the block": a house is drawn, guessed, and becomes its block, which sits
 * still on its plinth; then a cactus, whose block rocks.
 */

const PPU = 30;
/** Each drawing's column, and when its story starts (ms). */
const COLUMNS = [
  { word: 'house', cx: 96, from: 0, caption: 'Easy to stack', wobble: 0 },
  { word: 'cactus', cx: 252, from: 3300, caption: 'Wobbly!', wobble: 0.24 },
] as const;
const DRAW = [200, 1700] as const;
const GUESSED = 1800;
const POP = [2000, 2400] as const;
const FALL = [2500, 2950] as const;
const DURATION = 3300 + FALL[1] + 1500;

function draw(stage: Stage, t: number) {
  const { ctx, H } = stage;
  const ground = H - 28;
  const capTop = ground - 26;
  meadow(stage, ground, t);
  for (const col of COLUMNS) {
    const c = cutout(col.word);
    const s = t - col.from;
    const card = { x: col.cx - 62, y: 12, w: 124, h: 84 };
    plinth(ctx, col.cx, capTop, 110, ground);
    paper(ctx, card.x, card.y, card.w, card.h);
    doodle(ctx, c?.strokes ?? [], card, span(s, DRAW[0], DRAW[1]));
    tag(ctx, `✓ ${col.word}`, card.x + card.w - 20, card.y + 2, {
      fill: 'oklch(0.76 0.19 140)',
      size: 11,
      scale: easeOutBack(span(s, GUESSED, GUESSED + 250)),
    });
    if (!c || s < POP[0]) continue;

    // The block comes out of the drawing, then drops onto the plinth.
    const from = card.y + card.h / 2;
    const rest = restingY(c, capTop, PPU);
    const fall = easeIn(span(s, FALL[0], FALL[1]));
    const landed = col.from + FALL[1];
    drawCutout(ctx, c, col.cx, from + (rest - from) * fall, PPU, {
      scale: 0.4 + 0.6 * easeOutBack(span(s, POP[0], POP[1])),
      squash: ring(t, landed, 320, 0.14, 4),
      angle: ring(t, landed, 1500, col.wobble, 1.6),
    });
    shout(ctx, col.caption, col.cx, ground + 14, 14, {
      alpha: span(s, FALL[1] + 200, FALL[1] + 500),
    });
  }
  veil(stage, fadeOut(t, DURATION));
}

export const drawnBlockLoop: Loop = { duration: DURATION, poster: DURATION - 700, draw };
