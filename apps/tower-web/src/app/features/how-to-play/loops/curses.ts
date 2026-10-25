import { CURSE_TUNING, type Curse } from '@pictiotheme/protocol/tower';
import { CURSE_LABEL } from '../../../lib/curses';
import {
  balloons,
  CREW,
  cutout,
  drawCutout,
  meadow,
  named,
  plinth,
  restingY,
  stackUp,
  tag,
  veil,
  type Cutout,
  type Loop,
  type Stage,
} from './paint';
import { bounceHeight } from './scripts';
import { easeIn, easeInOut, easeOut, easeOutBack, fadeOut, lerp, ring, span } from './timeline';

/**
 * The curses acted out (game-rules.md#keep-or-curse), one loop each, on the tower of the crew it
 * was sent to: Slippery slides off a slope a normal piece would sit on, Big ice grows then slides
 * off, Melt droops and rocks, Bouncy bounces for 3 seconds, Blob grows, melts and rocks. The
 * pieces are cursed the way the game does it (`makePiece` with `melt`, `bloat`).
 */

const PPU = 24;
/** A cursed piece's size before Big ice or Blob grow it, against its grown size. */
const UNGROWN = 1 / Math.sqrt(CURSE_TUNING.bloat);

type Scene = { cx: number; ground: number; capTop: number };

/** Their tower with what's already on it, the curse's name above, "Theirs" below. */
function towerScene(stage: Stage, t: number, curse: Curse, base: readonly string[]) {
  const { ctx, W, H } = stage;
  const scene: Scene = { cx: W / 2, ground: H - 28, capTop: H - 68 };
  meadow(stage, scene.ground, t);
  plinth(ctx, scene.cx, scene.capTop, 6 * PPU, scene.ground);
  const placed = stackUp(base, scene.cx, scene.capTop, PPU);
  for (const p of placed) drawCutout(ctx, p.c, p.x, p.y, PPU);
  tag(ctx, 'Theirs', scene.cx, scene.ground + 14, { fill: CREW.teal });
  return { scene, placed, top: placed.at(-1)?.top ?? scene.capTop };
}

/** A piece hanging under its balloons, the balloons letting go (and drifting off) from `drop`. */
function hanging(
  ctx: CanvasRenderingContext2D,
  c: Cutout,
  x: number,
  y: number,
  t: number,
  drop: number,
  look: Parameters<typeof drawCutout>[5] = {},
) {
  const away = span(t, drop, drop + 1200);
  if (away < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - away;
    balloons(ctx, x, y - c.maxY * PPU * (look.scale ?? 1) - 100 * easeIn(away), t);
    ctx.restore();
  }
  drawCutout(ctx, c, x, y, PPU, look);
}

/**
 * Slippery (and Big ice): the iced piece comes down onto the mountain's slope, slides down it,
 * off the tower, and falls into the meadow: a fumble. Starts coming down at `from`, from `fromY`.
 */
function slideOff(stage: Stage, t: number, curse: Curse, c: Cutout, from: number, fromY: number) {
  const { ctx } = stage;
  const { scene, placed } = towerScene(stage, t, curse, ['brick', 'mountain']);
  const mountain = placed[1];
  if (!mountain) return;
  const peak = { x: mountain.x, y: mountain.top };
  const foot = { x: mountain.x + mountain.c.halfW * PPU, y: placed[0]?.top ?? scene.capTop };
  const slope = Math.atan2(foot.y - peak.y, foot.x - peak.x);
  // Its centre, lying on the slope `s` (0 the peak, 1 the foot) of the way down.
  const lift = -c.minY * PPU;
  const on = (s: number) => ({
    x: lerp(peak.x, foot.x, s) + Math.sin(slope) * lift,
    y: lerp(peak.y, foot.y, s) - Math.cos(slope) * lift,
  });
  const r = t - from;
  const land = on(0.3);
  const ground = { x: scene.cx + 118, y: scene.ground - c.maxY * PPU };
  let at: { x: number; y: number };
  let angle = 0;
  if (r < 1200) {
    at = { x: land.x, y: lerp(fromY, land.y, easeOut(span(r, 0, 1200))) };
  } else if (r < 2050) {
    angle = slope * span(r, 1200, 1350);
    at = on(lerp(0.3, 1.05, easeIn(span(r, 1350, 2050))));
  } else {
    const k = span(r, 2050, 2600);
    const off = on(1.05);
    at = { x: lerp(off.x, ground.x, k), y: lerp(off.y, ground.y, easeIn(k)) };
    angle = lerp(slope, Math.PI, k);
  }
  hanging(ctx, c, at.x, at.y, t, from + 1200, {
    angle,
    frost: 1,
    squash: ring(t, from + 2600, 320, 0.14, 4),
  });
  tag(ctx, '💫 Fumble: dazed!', scene.cx, peak.y - 30, {
    fill: 'oklch(0.27 0.08 275)',
    ink: 'oklch(0.87 0.17 92)',
    size: 12,
    scale: easeOutBack(span(r, 2700, 2950)),
  });
}

const slippery: Loop = {
  duration: 5200,
  poster: 2100,
  draw(stage, t) {
    const c = cutout('brick');
    if (c) slideOff(stage, t, 'slippery', c, 300, -30);
    veil(stage, fadeOut(t, 5200));
  },
};

const bigIce: Loop = {
  duration: 6400,
  poster: 3200,
  draw(stage, t) {
    const c = cutout('brick', { bloat: true });
    if (c) {
      if (t < 1500) {
        // It comes in at its drawn size, then grows.
        towerScene(stage, t, 'big_ice', ['brick', 'mountain']);
        const y = lerp(-30, 64, easeOut(span(t, 0, 700)));
        const grow = easeOutBack(span(t, 800, 1400));
        hanging(stage.ctx, c, stage.W / 2 + 6, y, t, Infinity, {
          frost: 1,
          scale: lerp(UNGROWN, 1, grow),
        });
      } else {
        slideOff(stage, t, 'big_ice', c, 1500, 64);
      }
    }
    veil(stage, fadeOut(t, 6400));
  },
};

/**
 * A piece that comes down, turns into its cursed look over `change` (grown, melted), lands on
 * top at `lands` and rocks on its bulging bottom.
 */
function changeAndRock(
  stage: Stage,
  t: number,
  curse: Curse,
  steps: readonly { at: number; c: Cutout | null; scale?: (t: number) => number }[],
  lands: number,
) {
  const { ctx } = stage;
  const { scene, top } = towerScene(stage, t, curse, ['brick', 'brick']);
  const x = scene.cx + 4;
  const hangY = 64;
  const last = steps.at(-1)?.c;
  if (!last) return;
  const rest = restingY(last, top, PPU);
  const y =
    t < lands - 800
      ? lerp(-30, hangY, easeOut(span(t, 0, 700)))
      : lerp(hangY, rest, easeInOut(span(t, lands - 800, lands)));
  // Cross-fade from each look to the next.
  steps.forEach((step, i) => {
    const next = steps[i + 1];
    const into = next ? span(t, next.at, next.at + 600) : 0;
    const shown = (i === 0 ? 1 : span(t, step.at, step.at + 600)) * (1 - into);
    if (!step.c || shown <= 0) return;
    const droop = 0.08 * Math.sin(Math.PI * into);
    hanging(ctx, step.c, x, y, t, lands - 800, {
      alpha: shown,
      scale: step.scale?.(t) ?? 1,
      squash: droop + ring(t, lands, 320, 0.12, 4),
      angle: ring(t, lands, 2600, 0.2, 1.1),
    });
  });
}

const melt: Loop = {
  duration: 6000,
  poster: 4000,
  draw(stage, t) {
    changeAndRock(
      stage,
      t,
      'melt',
      [
        { at: 0, c: cutout('brick') },
        { at: 1100, c: cutout('brick', { melt: true }) },
      ],
      2900,
    );
    veil(stage, fadeOut(t, 6000));
  },
};

const blob: Loop = {
  duration: 6600,
  poster: 4600,
  draw(stage, t) {
    changeAndRock(
      stage,
      t,
      'blob',
      [
        {
          at: 0,
          c: cutout('brick', { bloat: true }),
          // It comes in at its drawn size, then grows.
          scale: (t) => lerp(UNGROWN, 1, easeOutBack(span(t, 900, 1500))),
        },
        { at: 1700, c: cutout('brick', { bloat: true, melt: true }) },
      ],
      3500,
    );
    veil(stage, fadeOut(t, 6600));
  },
};

const BOUNCY_DROP = 800;
const BOUNCY_FALL = 520;
const bouncy: Loop = {
  duration: 6200,
  poster: BOUNCY_DROP + BOUNCY_FALL + 260,
  draw(stage, t) {
    const { ctx } = stage;
    const { scene, top } = towerScene(stage, t, 'bouncy', ['brick', 'brick']);
    const c = cutout('house');
    if (c) {
      const rest = restingY(c, top, PPU);
      const hangY = 60;
      const y =
        t < BOUNCY_DROP
          ? lerp(-30, hangY, easeOut(span(t, 0, 600)))
          : rest -
            bounceHeight(t - BOUNCY_DROP, rest - hangY, BOUNCY_FALL, CURSE_TUNING.restitution);
      const landed = BOUNCY_DROP + BOUNCY_FALL;
      hanging(ctx, c, scene.cx, y, t, BOUNCY_DROP, { squash: ring(t, landed, 300, 0.16, 4) });
      // Bouncy for 3 seconds after it lands, then an ordinary piece.
      const left = Math.ceil((CURSE_TUNING.bouncyMs - (t - landed)) / 1000);
      if (t >= landed) {
        tag(ctx, left > 0 ? `🏀 ${left}s` : 'Just a piece now', scene.cx + 86, top - 20, {
          size: 12,
          fill: left > 0 ? 'oklch(0.87 0.17 92)' : 'oklch(1 0 0)',
        });
      }
    }
    veil(stage, fadeOut(t, 6200));
  },
};

/** Each curse's loop, with its name on it. */
export const CURSE_LOOPS: Record<Curse, Loop> = {
  slippery: named(slippery, CURSE_LABEL.slippery),
  big_ice: named(bigIce, CURSE_LABEL.big_ice),
  melt: named(melt, CURSE_LABEL.melt),
  bouncy: named(bouncy, CURSE_LABEL.bouncy),
  blob: named(blob, CURSE_LABEL.blob),
};
