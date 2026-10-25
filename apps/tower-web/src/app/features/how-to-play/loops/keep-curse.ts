import {
  button,
  CREW,
  cutout,
  drawCutout,
  INK,
  meadow,
  paper,
  plinth,
  pointer,
  restingY,
  tag,
  topOf,
  veil,
  type Loop,
  type Stage,
} from './paint';
import { easeInOut, easeOutBack, fadeOut, lerp, ring, span } from './timeline';

/**
 * "Keep it or curse it": a nice house is kept and floats over to your tower; a spiky cactus is
 * cursed, frosts over (Slippery) and flies to theirs, where it slides as it lands.
 */

const PPU = 22;
const TOWERS = { yours: 62, theirs: 278 } as const;
const PLINTH_W = 98;
/** The two choices, each one act (ms from the act's start). */
const ACTS = [
  { word: 'house', from: 0, choice: 'keep', to: 'yours', arc: 50 },
  { word: 'cactus', from: 4300, choice: 'curse', to: 'theirs', arc: 90 },
] as const;
const APPEAR = [200, 600] as const;
const AIM = [800, 1450] as const;
const CLICK = 1550;
const HIDE = [1850, 2150] as const;
const FLY = [1950, 3050] as const;
const DURATION = 4300 + FLY[1] + 1600;

const CARD = { x: 100, y: 14, w: 140, h: 118 };
const BUTTONS = {
  keep: { x: CARD.x + 6, y: CARD.y + CARD.h - 36, w: 62, h: 26 },
  curse: { x: CARD.x + 72, y: CARD.y + CARD.h - 36, w: 62, h: 26 },
};

function draw(stage: Stage, t: number) {
  const { ctx, W, H } = stage;
  const ground = H - 28;
  const capTop = ground - 40;
  meadow(stage, ground, t);

  // Each tower has a block on it already.
  const tops = { yours: capTop, theirs: capTop };
  for (const [side, word] of [
    ['yours', 'brick'],
    ['theirs', 'skateboard'],
  ] as const) {
    plinth(ctx, TOWERS[side], capTop, PLINTH_W, ground);
    const c = cutout(word);
    if (!c) continue;
    const y = restingY(c, capTop, PPU);
    drawCutout(ctx, c, TOWERS[side], y, PPU);
    tops[side] = topOf(c, y, PPU);
  }
  tag(ctx, 'Yours', TOWERS.yours, ground + 14, { fill: CREW.orange });
  tag(ctx, 'Theirs', TOWERS.theirs, ground + 14, { fill: CREW.teal });

  for (const act of ACTS) {
    const s = t - act.from;
    const c = cutout(act.word);
    if (!c || s < APPEAR[0]) continue;
    const cursed = act.choice === 'curse';
    const card = 1 - span(s, HIDE[0], HIDE[1]);
    // Before the next act starts, this one's piece is already on its tower.
    const done = ACTS.some((a) => a.from > act.from && t >= a.from + APPEAR[0]);

    if (card > 0 && !done) {
      ctx.save();
      ctx.globalAlpha = card * span(s, APPEAR[0], APPEAR[1]);
      paper(ctx, CARD.x, CARD.y, CARD.w, CARD.h);
      ctx.restore();
      const chosen = s >= CLICK && s < HIDE[1];
      button(ctx, '🧱 Keep', BUTTONS.keep, {
        fill: 'oklch(0.72 0.19 42)',
        ink: 'oklch(1 0 0)',
        base: 'oklch(0.58 0.18 36)',
        pressed: chosen && !cursed,
        alpha: card,
      });
      button(ctx, '🌀 Curse', BUTTONS.curse, {
        fill: INK,
        ink: 'oklch(0.87 0.17 92)',
        base: 'oklch(0.1 0.02 260)',
        pressed: chosen && cursed,
        alpha: card,
      });
      if (cursed) {
        tag(ctx, '🧊 Slippery', CARD.x + CARD.w / 2, CARD.y + CARD.h + 12, {
          size: 11,
          scale: card * easeOutBack(span(s, APPEAR[0], APPEAR[1])),
        });
      }
    }

    // The piece: on the card, then off to its tower.
    const at = { x: CARD.x + CARD.w / 2, y: CARD.y + 42 };
    const landX = TOWERS[act.to];
    const landY = restingY(c, tops[act.to], PPU);
    const fly = easeInOut(span(s, FLY[0], FLY[1]));
    const landed = act.from + FLY[1];
    // Slippery: it slides along when it lands.
    const slide = cursed ? 16 * easeOutBack(span(t, landed, landed + 700)) : 0;
    drawCutout(
      ctx,
      c,
      lerp(at.x, landX, fly) + slide,
      lerp(at.y, landY, fly) - act.arc * Math.sin(Math.PI * fly),
      PPU,
      {
        scale: easeOutBack(span(s, APPEAR[0], APPEAR[1])),
        squash: ring(t, landed, 320, 0.14, 4),
        frost: cursed ? span(s, CLICK + 100, CLICK + 400) : 0,
        angle: cursed ? ring(t, landed, 900, 0.12, 2) : 0,
      },
    );

    // The pointer goes to the button and clicks it.
    if (s < HIDE[1] && !done) {
      const target = cursed ? BUTTONS.curse : BUTTONS.keep;
      const aim = easeInOut(span(s, AIM[0], AIM[1]));
      ctx.save();
      ctx.globalAlpha = card;
      pointer(
        ctx,
        lerp(W - 30, target.x + target.w / 2, aim),
        lerp(H - 10, target.y + target.h / 2, aim),
        s >= CLICK && s < CLICK + 180,
      );
      ctx.restore();
    }
  }
  veil(stage, fadeOut(t, DURATION));
}

export const keepCurseLoop: Loop = {
  duration: DURATION,
  // Curse just pressed: the card still up, the cactus frosting over.
  poster: ACTS[1].from + CLICK + 250,
  draw,
};
