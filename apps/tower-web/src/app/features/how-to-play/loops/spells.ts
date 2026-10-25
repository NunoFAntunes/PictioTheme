import { shakePoints, SPELL_TUNING, type Spell } from '@pictiotheme/protocol/tower';
import type { Stroke } from '@pictiotheme/protocol';
import { SPELL_LABEL } from '../../../lib/spells';
import { CARRY_BELOW, flyIn, flyOff, paintSpellBird } from '../../birds';
import {
  balloons,
  CREW,
  cutout,
  cutoutOf,
  doodle,
  drawCutout,
  fog,
  meadow,
  named,
  paper,
  plinth,
  restingY,
  sample,
  stackUp,
  tag,
  veil,
  warning,
  type Loop,
  type Placed,
  type Stage,
} from './paint';
import { easeIn, easeInOut, easeOut, easeOutBack, fadeOut, lerp, ring, span } from './timeline';

/**
 * The spells acted out (game-rules.md#spells), one loop each, cast at the other crew: the 2 s
 * warning over their tower, then the spell. The birds are the tower view's own, flying the same
 * paths; Shaky hand wobbles the drawing with the same `shakePoints` the server uses.
 */

const PPU = 24;
const WARN = [300, 300 + SPELL_TUNING.warnMs] as const;
const HITS = WARN[1];
/** A pigeon and a magpie as big as the tower view draws them at this scale (about). */
const PIGEON_R = 0.3 * PPU;
const MAGPIE_R = 0.46 * PPU;

type Scene = { cx: number; ground: number; capTop: number; placed: Placed[]; top: number };

/**
 * Their tower: a skateboard, a brick and a boot, each a step in from the one below. The pieces
 * in `hide` are left for the loop to draw.
 */
function towerScene(stage: Stage, t: number, spell: Spell, hide: readonly number[] = []): Scene {
  const { ctx, W, H } = stage;
  const cx = W / 2;
  const ground = H - 28;
  const capTop = H - 64;
  meadow(stage, ground, t);
  plinth(ctx, cx, capTop, 6 * PPU, ground);
  const placed = stackUp(['skateboard', 'brick', 'boot'], cx, capTop, PPU, [0, 8, 10]);
  placed.forEach((p, i) => {
    if (!hide.includes(i)) drawCutout(ctx, p.c, p.x, p.y, PPU);
  });
  tag(ctx, 'Theirs', cx, ground + 14, { fill: CREW.teal });
  return { cx, ground, capTop, placed, top: placed.at(-1)?.top ?? capTop };
}

function warn(stage: Stage, t: number, spell: Spell, y: number) {
  if (t >= WARN[0] && t < WARN[1]) {
    const left = Math.ceil((WARN[1] - t) / 1000);
    warning(
      stage.ctx,
      `${SPELL_LABEL[spell].icon} ${SPELL_LABEL[spell].name} in ${left}…`,
      stage.W / 2,
      y,
      t,
    );
  }
}

/** Fog: it rolls over the top of their tower; their placer sees only their own piece and guide. */
const FOG_LIFTS = 6600;
const fogLoop: Loop = {
  duration: 7800,
  poster: 4300,
  draw(stage, t) {
    const { ctx } = stage;
    const scene = towerScene(stage, t, 'fog');
    const house = cutout('house');
    // Their next piece comes down through the fog, and lands a little off: they couldn't see.
    const dropAt = 5200;
    const landX = scene.cx + 16;
    const rest = house ? restingY(house, scene.top, PPU) : 0;
    const hangY = lerp(-30, scene.top - 46, span(t, HITS + 300, dropAt));
    const y = t < dropAt ? hangY : lerp(hangY, rest, easeIn(span(t, dropAt, dropAt + 350)));
    const landed = t >= dropAt + 350;
    if (house && landed) drawCutout(ctx, house, landX, rest, PPU, { angle: 0.1 });

    const k = span(t, HITS, HITS + 500) * (1 - span(t, FOG_LIFTS, FOG_LIFTS + 600));
    fog(stage, scene.top + 1.8 * PPU, k, t, PPU);
    warn(stage, t, 'fog', scene.top - 30);

    if (house && !landed && t >= HITS + 300) {
      const x = lerp(scene.cx - 6, landX, span(t, HITS + 900, dropAt - 600));
      const half = house.halfW * PPU;
      ctx.strokeStyle = 'oklch(1 0 0 / 0.75)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x - half, y);
      ctx.lineTo(x - half, scene.top);
      ctx.moveTo(x + half, y);
      ctx.lineTo(x + half, scene.top);
      ctx.stroke();
      ctx.setLineDash([]);
      if (t < dropAt) balloons(ctx, x, y - house.maxY * PPU, t);
      drawCutout(ctx, house, x, y, PPU);
    }
    if (k > 0.5) tag(ctx, `${SPELL_TUNING.fogMs / 1000}s`, stage.W - 34, 46, { size: 12 });
    veil(stage, fadeOut(t, 7800));
  },
};

/** Magpie: it flies in to the top piece, carries it off to the caster's queue. */
const GRAB = [HITS + 900, HITS + 1250] as const;
const AWAY = [GRAB[1], GRAB[1] + 1000] as const;
const magpieLoop: Loop = {
  duration: 7000,
  poster: GRAB[1] + 300,
  draw(stage, t) {
    const { ctx } = stage;
    const grabbed = t >= GRAB[0];
    const scene = towerScene(stage, t, 'magpie', grabbed ? [2] : []);
    const prize = scene.placed[2];
    warn(stage, t, 'magpie', scene.top - 30);
    if (!prize) return;
    // In world units from the plinth's middle, y up, as the birds fly.
    const toWorld = (x: number, y: number) => ({
      x: (x - scene.cx) / PPU,
      y: (scene.capTop - y) / PPU,
    });
    const toScreen = (p: { x: number; y: number }) => ({
      x: scene.cx + p.x * PPU,
      y: scene.capTop - p.y * PPU,
    });
    const perch = toWorld(prize.x, prize.y - CARRY_BELOW * PPU);
    let at: { x: number; y: number } | null = null;
    if (t >= HITS && t < GRAB[0]) at = toScreen(flyIn(perch, 1, span(t, HITS, GRAB[0])));
    else if (t >= GRAB[0] && t < AWAY[1])
      at = toScreen(flyOff(perch, -1, span(t, AWAY[0], AWAY[1])));
    if (at) {
      if (grabbed) {
        // The piece hangs from its feet, shrunk to what a bird can carry.
        const size = lerp(1, 0.6, span(t, GRAB[0], GRAB[1]));
        drawCutout(ctx, prize.c, at.x, at.y + CARRY_BELOW * PPU * size, PPU, {
          scale: size,
          angle: Math.sin(t / 300) * 0.12,
        });
      }
      paintSpellBird(ctx, 'magpie', at, MAGPIE_R, t / 1000, -1, true);
    }
    tag(ctx, '← into your queue', 74, 46, {
      size: 12,
      fill: 'oklch(0.87 0.17 92)',
      scale: easeOutBack(span(t, AWAY[1] - 300, AWAY[1])),
    });
    veil(stage, fadeOut(t, 7000));
  },
};

/** Pigeons: three land on the outer edges, top first, and tip the tower; the boot slides off. */
const LANDS = [0, 250, 500].map((d) => HITS + d);
const FLY_MS = 900;
const TIPS = HITS + 500 + FLY_MS;
const SLIPS = TIPS + 1300;
const pigeonLoop: Loop = {
  duration: 7800,
  poster: TIPS + 900,
  draw(stage, t) {
    const { ctx } = stage;
    // The pieces are drawn here, leaning.
    const scene = towerScene(stage, t, 'pigeon', [0, 1, 2]);
    const [board, brick, boot] = scene.placed;
    warn(stage, t, 'pigeon', scene.top - 30);
    if (!board || !brick || !boot) return;
    // Perches: the outer (right) edge of each piece's top, the top piece first.
    const perches = [boot, brick, board].map((p) => ({
      x: p.x + (p.c.halfW - 0.2) * PPU,
      y: p.top - PIGEON_R,
    }));
    // The upper two lean out over the board's edge, wobbling, as the weight comes on.
    const lean = 0.07 * easeInOut(span(t, TIPS, TIPS + 700)) + ring(t, TIPS + 700, 900, 0.03, 2);
    const pivot = { x: brick.x + brick.c.halfW * PPU, y: brick.y - brick.c.minY * PPU };
    const slip = span(t, SLIPS, SLIPS + 700);

    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(lean);
    ctx.translate(-pivot.x, -pivot.y);
    // Leaning space, so the board's pigeon is drawn outside it.
    drawCutout(ctx, brick.c, brick.x, brick.y, PPU);
    if (slip === 0) drawCutout(ctx, boot.c, boot.x, boot.y, PPU);
    ctx.restore();
    drawCutout(ctx, board.c, board.x, board.y, PPU);

    // The boot slides off and falls into the meadow.
    if (slip > 0) {
      const to = { x: scene.cx + 122, y: restingY(boot.c, scene.ground, PPU) };
      drawCutout(ctx, boot.c, lerp(boot.x + 8, to.x, slip), lerp(boot.y, to.y, easeIn(slip)), PPU, {
        angle: lerp(lean, 1.4, slip),
      });
    }

    perches.forEach((perch, i) => {
      const lands = LANDS[i] ?? HITS;
      if (t < lands) return;
      const p = span(t, lands, lands + FLY_MS);
      const flying = p < 1 || (i === 0 && slip > 0);
      // In world units for the flight paths, from where it perches.
      const world = { x: (perch.x - scene.cx) / PPU, y: (scene.capTop - perch.y) / PPU };
      let w = flyIn(world, 1, p);
      if (i === 0 && slip > 0) w = flyOff(world, 1, slip);
      const at = { x: scene.cx + w.x * PPU, y: scene.capTop - w.y * PPU };
      if (i < 2 && p >= 1 && !(i === 0 && slip > 0)) {
        // Perched on a leaning piece: it leans with it.
        const dx = at.x - pivot.x;
        const dy = at.y - pivot.y;
        at.x = pivot.x + dx * Math.cos(lean) - dy * Math.sin(lean);
        at.y = pivot.y + dx * Math.sin(lean) + dy * Math.cos(lean);
      }
      paintSpellBird(ctx, 'pigeon', at, PIGEON_R, t / 1000 + i, flying ? 1 : -1, flying);
    });
    tag(ctx, '💫 Fumble: dazed!', scene.cx, scene.top - 30, {
      fill: 'oklch(0.27 0.08 275)',
      ink: 'oklch(0.87 0.17 92)',
      size: 12,
      scale: easeOutBack(span(t, SLIPS + 800, SLIPS + 1050)),
    });
    veil(stage, fadeOut(t, 7800));
  },
};

/** Shaky hand: halfway through their drawing, the lines start to wobble, and so does its piece. */
const house = sample('house');
const shaky = house.map((s, i) =>
  i === 0 || s.tool !== 'brush' ? s : { ...s, pts: shakePoints(s.pts, s.id, 0) },
) as readonly Stroke[];
const shakyLoop: Loop = {
  duration: 7800,
  poster: HITS + 2600,
  draw(stage, t) {
    const { ctx, W, H } = stage;
    meadow(stage, H - 22, t);
    const shiver = ring(t, HITS, 500, 4, 12);
    const card = { x: W / 2 - 110 + shiver, y: 38, w: 220, h: 140 };
    paper(ctx, card.x, card.y, card.w, card.h);
    const done = HITS + 2200;
    const solved = span(t, done + 400, done + 800);
    ctx.save();
    ctx.globalAlpha = 1 - solved;
    // The walls before it hits; the roof and the door after, wobbling.
    doodle(ctx, house.slice(0, 1), card, span(t, 0, WARN[0] + 900), house);
    doodle(ctx, shaky.slice(1), card, span(t, HITS + 200, done), house);
    ctx.restore();
    const piece = cutoutOf('shaky-house', shaky);
    if (piece && solved > 0) {
      drawCutout(ctx, piece, W / 2, card.y + card.h / 2, 36, {
        scale: easeOutBack(solved),
        alpha: Math.min(1, solved * 2),
      });
    }
    warn(stage, t, 'shaky', card.y + card.h + 18);
    if (t >= HITS && t < done + 400) {
      tag(ctx, `Wobbly for ${SPELL_TUNING.shakyMs / 1000}s`, W / 2, card.y + card.h + 18, {
        size: 12,
        fill: 'oklch(0.87 0.17 92)',
        scale: easeOut(span(t, HITS, HITS + 250)),
      });
    }
    veil(stage, fadeOut(t, 7800));
  },
};

/** Each spell's loop, with its name on it. */
export const SPELL_LOOPS: Record<Spell, Loop> = {
  fog: named(fogLoop, SPELL_LABEL.fog),
  magpie: named(magpieLoop, SPELL_LABEL.magpie),
  shaky: named(shakyLoop, SPELL_LABEL.shaky),
  pigeon: named(pigeonLoop, SPELL_LABEL.pigeon),
};
