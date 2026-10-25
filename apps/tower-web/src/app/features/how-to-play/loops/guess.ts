import {
  cutout,
  doodle,
  drawCutout,
  guessField,
  INK,
  meadow,
  paper,
  shout,
  tag,
  veil,
  type Loop,
  type Stage,
} from './paint';
import { guessLineAt, HINT_AT, maskAt, SOLVED_AT, type Verdict } from './scripts';
import { easeOutBack, fadeOut, ring, span } from './timeline';

/**
 * "Guess it": the house is drawn, the letter mask comes with a hint, and the guess line tries
 * "hat" (wrong), "horse" (so close) and "house": right, and the drawing becomes its block.
 */

const PPU = 34;
const DURATION = SOLVED_AT + 2400;

const VERDICT: Record<Verdict, { text: string; fill: string; edge: string }> = {
  wrong: { text: '✗ Nope', fill: 'oklch(0.63 0.22 25)', edge: 'oklch(0.63 0.22 25)' },
  close: { text: 'So close!', fill: 'oklch(0.87 0.17 92)', edge: 'oklch(0.72 0.15 75)' },
  right: { text: '✓ Got it!', fill: 'oklch(0.76 0.19 140)', edge: 'oklch(0.6 0.17 145)' },
};

function draw(stage: Stage, t: number) {
  const { ctx, W, H } = stage;
  meadow(stage, H - 22, t);

  // The drawing, until it's guessed and turns into its block.
  const card = { x: W / 2 - 100, y: 10, w: 200, h: 100 };
  const house = cutout('house');
  const solved = span(t, SOLVED_AT + 150, SOLVED_AT + 550);
  paper(ctx, card.x, card.y, card.w, card.h);
  ctx.save();
  ctx.globalAlpha = 1 - solved;
  doodle(ctx, house?.strokes ?? [], card, span(t, 0, 1100));
  ctx.restore();
  if (house && solved > 0) {
    drawCutout(ctx, house, W / 2, card.y + card.h / 2, PPU, {
      scale: easeOutBack(solved),
      alpha: Math.min(1, solved * 2),
    });
  }

  // The letter mask, with its hint letter popping in.
  const mask = maskAt(t);
  if (mask) {
    const y = card.y + card.h + 22;
    [...mask].forEach((ch, i) => {
      const x = W / 2 + (i - 2) * 22;
      if (ch === '_') {
        ctx.fillStyle = INK;
        ctx.fillRect(x - 7, y + 8, 14, 3);
      } else {
        const pop = i === 4 && t < SOLVED_AT ? span(t, HINT_AT, HINT_AT + 250) : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(easeOutBack(pop), easeOutBack(pop));
        shout(ctx, ch, 0, 0, 20);
        ctx.restore();
      }
    });
  }

  // The guess line: typed, sent, judged.
  const line = guessLineAt(t);
  const verdict = line.verdict ? VERDICT[line.verdict] : null;
  const box = {
    x: W / 2 - 120 + (line.verdict === 'wrong' ? ring(t, line.since, 380, 6, 9) : 0),
    y: H - 66,
    w: 240,
    h: 34,
  };
  guessField(ctx, line.text, box, {
    caret: !line.verdict && Math.floor(t / 450) % 2 === 0,
    edge: verdict?.edge ?? 'oklch(0.8 0.06 265)',
  });
  if (verdict) {
    tag(ctx, verdict.text, box.x + box.w - 34, box.y - 4, {
      fill: verdict.fill,
      ink: line.verdict === 'close' ? INK : 'oklch(1 0 0)',
      size: 12,
      scale: easeOutBack(span(t, line.since, line.since + 220)),
    });
  }
  veil(stage, fadeOut(t, DURATION));
}

export const guessLoop: Loop = { duration: DURATION, poster: SOLVED_AT + 1000, draw };
