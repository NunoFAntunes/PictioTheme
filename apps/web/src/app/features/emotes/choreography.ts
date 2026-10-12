import type { Emote } from '@pictiotheme/protocol';
import type { DoodleName } from './doodles';

/**
 * What an emote does on screen, worked out from where the characters are (viewport px). Pure, so
 * it's unit-tested; `EmoteStage` plays it with the Web Animations API. Three kinds of things move:
 * - the actor's and target's figures in the margin (their own elements, so they stay in place),
 * - a clone of the actor that flies over to the target (squish, slap, hug) while the real one hides,
 * - sprites: doodles (doodles.ts: a tomato, a hand, notes, tears, hearts), a splat and comic words.
 * Every sprite is centred on (x, y) and moved by a transform relative to that.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type Motion = {
  frames: Keyframe[];
  delayMs: number;
  durationMs: number;
  easing?: string;
};

export type Sprite = Motion & {
  kind: 'clone' | 'doodle' | 'word' | 'splat';
  /** The doodle drawn (doodles). */
  doodle?: DoodleName;
  /** The word written (words). */
  content?: string;
  x: number;
  y: number;
  /** Width and height (clones, doodles, splats) or font size (words), px. */
  size: number;
};

export type Choreography = {
  actor: Motion | null;
  target: Motion | null;
  sprites: Sprite[];
  /** When the hit lands (ms from the start): the sound plays then. 0 for solo emotes. */
  impactMs: number;
};

const round = (n: number) => Math.round(n * 10) / 10;

/** One transform, always as the same list of functions so keyframes interpolate cleanly. */
function pose(x = 0, y = 0, deg = 0, sx = 1, sy = sx): string {
  return `translate(${round(x)}px, ${round(y)}px) rotate(${round(deg)}deg) scale(${sx}, ${sy})`;
}

function frames(...list: [offset: number, transform: string, opacity?: number][]): Keyframe[] {
  return list.map(([offset, transform, opacity]) => ({
    offset,
    transform,
    ...(opacity !== undefined && { opacity }),
  }));
}

const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** The actor's figure is hidden while its clone is out, and back when the clone lands home. */
function away(durationMs: number): Motion {
  return {
    frames: [
      { offset: 0, opacity: 0 },
      { offset: 0.98, opacity: 0 },
      { offset: 1, opacity: 1 },
    ],
    delayMs: 0,
    durationMs,
  };
}

/** A comic word ("SLAP!") that pops at the hit and fades. */
function word(content: string, x: number, y: number, delayMs: number, size = 26): Sprite {
  return {
    kind: 'word',
    content,
    x,
    y,
    size,
    delayMs,
    durationMs: 800,
    frames: frames(
      [0, pose(0, 0, -14, 0), 1],
      [0.18, pose(0, -6, -8, 1.25), 1],
      [0.32, pose(0, -8, -6, 1), 1],
      [0.8, pose(0, -12, -6, 1), 1],
      [1, pose(0, -18, -6, 1), 0],
    ),
    easing: 'ease-out',
  };
}

/** Doodles that float up from a point and fade, one after another (notes, hearts). */
function floaters(
  doodles: DoodleName[],
  x: number,
  y: number,
  {
    delayMs,
    gapMs,
    size,
    spread,
  }: { delayMs: number; gapMs: number; size: number; spread: number },
): Sprite[] {
  return doodles.map((doodle, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return {
      kind: 'doodle',
      doodle,
      x: x + side * spread,
      y,
      size,
      delayMs: delayMs + i * gapMs,
      durationMs: 1100,
      frames: frames(
        [0, pose(0, 0, 0, 0.3), 0],
        [0.2, pose(side * 4, -12, side * 10, 1), 1],
        [0.6, pose(side * -4, -36, side * -8, 1), 1],
        [1, pose(side * 6, -60, side * 12, 0.9), 0],
      ),
      easing: 'ease-out',
    };
  });
}

/**
 * Which side of the target the actor stands on to slap or hug it: towards the board when there's
 * room (the players' column is the sheet's left margin), else the other side.
 */
export function standingSide(target: Box, viewportWidth: number): 1 | -1 {
  return target.x + target.w * 1.7 < viewportWidth ? 1 : -1;
}

// ── Solo emotes, on your own character ──

function dance(a: Box): Choreography {
  const c = centre(a);
  const hop = (dir: number): string => pose(dir * 10, -0.18 * a.h, dir * 14, 0.95, 1.08);
  const land = pose(0, 0, 0, 1.1, 0.9);
  return {
    actor: {
      frames: frames(
        [0, pose()],
        [0.08, pose(0, 0, 0, 1.1, 0.88)],
        [0.16, hop(-1)],
        [0.25, land],
        [0.33, hop(1)],
        [0.42, land],
        [0.5, hop(-1)],
        [0.58, land],
        [0.66, hop(1)],
        [0.74, land],
        [0.88, pose(0, -0.28 * a.h, 360)],
        [0.95, pose(0, 0, 360, 1.08, 0.92)],
        [1, pose(0, 0, 360)],
      ),
      delayMs: 0,
      durationMs: 1800,
      easing: 'ease-in-out',
    },
    target: null,
    sprites: floaters(['note', 'notes', 'note', 'notes'], c.x, a.y + a.h * 0.25, {
      delayMs: 100,
      gapMs: 350,
      size: 28,
      spread: a.w * 0.55,
    }),
    impactMs: 0,
  };
}

function taunt(a: Box): Choreography {
  const flip = (sx: number, deg: number) => pose(0, 0, deg, sx, 1);
  return {
    actor: {
      frames: frames(
        [0, pose()],
        [0.1, pose(0, -6, -10)],
        [0.2, flip(-1, 8)],
        [0.3, flip(1, -8)],
        [0.4, flip(-1, 8)],
        [0.5, flip(1, -8)],
        [0.6, flip(-1, 8)],
        [0.7, flip(1, -8)],
        [0.85, pose(0, -4, 0, 1.08, 0.94)],
        [1, pose()],
      ),
      delayMs: 0,
      durationMs: 1600,
      easing: 'ease-in-out',
    },
    target: null,
    sprites: [
      { ...word('NYAH NYAH!', a.x + a.w * 0.5, a.y - 6, 150, 18), durationMs: 1400 },
      ...floaters(['taunt'], a.x + a.w, a.y + a.h * 0.3, {
        delayMs: 200,
        gapMs: 0,
        size: 32,
        spread: 0,
      }),
    ],
    impactMs: 0,
  };
}

function flex(a: Box): Choreography {
  const big = (x: number, s: number) => pose(x, 0, 0, s * 1.06, s);
  const arm = (side: 1 | -1): Sprite => ({
    kind: 'doodle',
    doodle: 'flex',
    x: a.x + a.w / 2 + side * a.w * 0.62,
    y: a.y + a.h * 0.45,
    size: 34,
    delayMs: 200,
    durationMs: 1300,
    // The left arm is the right one, mirrored.
    frames: frames(
      [0, pose(0, 0, side * 30, 0), 0],
      [0.15, pose(0, 0, side * -10, side * 1.3, 1.3), 1],
      [0.3, pose(0, 0, 0, side, 1), 1],
      [0.45, pose(0, 0, side * -6, side * 1.15, 1.15), 1],
      [0.6, pose(0, 0, 0, side, 1), 1],
      [0.85, pose(0, 0, 0, side, 1), 1],
      [1, pose(0, 0, 0, side * 0.6, 0.6), 0],
    ),
  });
  return {
    actor: {
      frames: frames(
        [0, pose()],
        [0.15, big(0, 1.12)],
        [0.2, big(-2, 1.14)],
        [0.25, big(2, 1.14)],
        [0.3, big(-2, 1.14)],
        [0.35, big(2, 1.14)],
        [0.55, big(0, 1.2)],
        [0.6, big(-2, 1.22)],
        [0.65, big(2, 1.22)],
        [0.7, big(0, 1.24)],
        [0.85, pose(0, 0, 0, 0.95, 1.05)],
        [1, pose()],
      ),
      delayMs: 0,
      durationMs: 1600,
      easing: 'ease-out',
    },
    target: null,
    sprites: [arm(-1), arm(1)],
    impactMs: 0,
  };
}

function cry(a: Box): Choreography {
  const sob = (up: boolean) => pose(0, up ? -2 : 2, up ? -3 : 3, up ? 1.02 : 1.06, up ? 0.9 : 0.84);
  const tears: Sprite[] = Array.from({ length: 6 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return {
      kind: 'doodle',
      doodle: 'tear',
      x: a.x + a.w / 2 + side * a.w * 0.2,
      y: a.y + a.h * 0.35,
      size: 18,
      delayMs: 200 + i * 250,
      durationMs: 700,
      frames: frames(
        [0, pose(0, 0, 0, 0.4), 0],
        [0.15, pose(side * 8, -6, 0, 1), 1],
        [0.5, pose(side * 22, 4, side * 20, 1), 1],
        [1, pose(side * 30, a.h * 0.5, side * 30, 0.8), 0],
      ),
      easing: 'ease-in',
    };
  });
  return {
    actor: {
      frames: frames(
        [0, pose()],
        [0.12, pose(0, 0, -4, 1.04, 0.86)],
        [0.22, sob(false)],
        [0.32, sob(true)],
        [0.42, sob(false)],
        [0.52, sob(true)],
        [0.62, sob(false)],
        [0.72, sob(true)],
        [0.82, sob(false)],
        [1, pose()],
      ),
      delayMs: 0,
      durationMs: 2000,
      easing: 'ease-in-out',
    },
    target: null,
    sprites: tears,
    impactMs: 0,
  };
}

// ── Targeted emotes, at another player ──

/** The actor leaps over in an arc, slams down on the target's head and flattens it, then hops home. */
function squish(a: Box, t: Box): Choreography {
  const durationMs = 1700;
  const impactMs = Math.round(durationMs * 0.46);
  const from = centre(a);
  const dx = centre(t).x - from.x;
  const hover = t.y - a.h * 0.55 - from.y;
  // Lands with its feet on the target's flattened head.
  const land = t.y + t.h * 0.68 - a.h / 2 - from.y;
  const peak = Math.min(0, hover) - a.h * 0.6;
  return {
    actor: away(durationMs),
    target: {
      frames: frames(
        [0, pose()],
        [0.06, pose(0, 0, 0, 1.5, 0.3)],
        [0.4, pose(0, 0, 0, 1.45, 0.32)],
        [0.55, pose(0, 0, 0, 0.85, 1.25)],
        [0.7, pose(0, 0, 0, 1.1, 0.92)],
        [0.85, pose(0, 0, 0, 0.97, 1.03)],
        [1, pose()],
      ),
      delayMs: impactMs,
      durationMs: 1000,
      easing: 'ease-out',
    },
    sprites: [
      {
        kind: 'clone',
        x: from.x,
        y: from.y,
        size: a.w,
        delayMs: 0,
        durationMs,
        frames: frames(
          [0, pose()],
          [0.1, pose(0, 0, 0, 1.12, 0.85)],
          [0.26, pose(dx / 2, peak, -200)],
          [0.4, pose(dx, hover, -360)],
          [0.46, pose(dx, land, -360, 1.2, 0.85)],
          [0.52, pose(dx, land - 4, -360, 0.95, 1.05)],
          [0.6, pose(dx, land, -360)],
          [0.7, pose(dx, land, -360)],
          [0.74, pose(dx, land, -360, 1.1, 0.9)],
          [0.86, pose(dx / 2, peak, -345)],
          [1, pose(0, 0, -360)],
        ),
      },
      // Beside the target, not over it: the flattened target is the joke.
      word('SQUISH!', centre(t).x + t.w * 0.6, t.y + t.h * 0.45, impactMs),
    ],
    impactMs,
  };
}

/** The actor walks up beside the target, winds up and slaps it; the target reels and sees stars. */
function slap(a: Box, t: Box, side: 1 | -1): Choreography {
  const durationMs = 1400;
  const impactMs = Math.round(durationMs * 0.45);
  const from = centre(a);
  const to = centre(t);
  const dx = to.x + side * t.w * 0.62 - from.x;
  const dy = to.y - from.y;
  const mid = Math.min(0, dy) - 30;
  return {
    actor: away(durationMs),
    target: {
      frames: frames(
        [0, pose()],
        [0.12, pose(-side * 14, 0, -side * 28)],
        [0.3, pose(-side * 6, 0, side * 10)],
        [0.5, pose(-side * 2, 0, -side * 5)],
        [0.7, pose(0, 0, side * 2)],
        [1, pose()],
      ),
      delayMs: impactMs,
      durationMs: 800,
      easing: 'ease-out',
    },
    sprites: [
      {
        kind: 'clone',
        x: from.x,
        y: from.y,
        size: a.w,
        delayMs: 0,
        durationMs,
        frames: frames(
          [0, pose()],
          [0.12, pose(dx / 2, mid)],
          [0.3, pose(dx, dy)],
          [0.38, pose(dx + side * 6, dy, side * 22)],
          [0.45, pose(dx - side * 10, dy, -side * 28)],
          [0.55, pose(dx - side * 4, dy, -side * 12)],
          [0.66, pose(dx, dy)],
          [0.8, pose(dx / 2, mid)],
          [1, pose()],
        ),
      },
      {
        kind: 'doodle',
        doodle: 'hand',
        x: to.x + side * t.w * 0.3,
        y: to.y - t.h * 0.1,
        size: 40,
        delayMs: impactMs - 90,
        durationMs: 450,
        frames: frames(
          [0, pose(side * 18, 0, side * 50, side * 1, 1), 0],
          [0.2, pose(0, 0, 0, side * 1.2, 1.2), 1],
          [0.6, pose(-side * 6, 0, -side * 20, side * 1, 1), 1],
          [1, pose(-side * 10, 0, -side * 30, side * 0.8, 0.8), 0],
        ),
        easing: 'ease-out',
      },
      word('SLAP!', to.x, t.y - 4, impactMs),
      {
        kind: 'doodle',
        doodle: 'star',
        x: to.x - side * t.w * 0.1,
        y: t.y + t.h * 0.1,
        size: 24,
        delayMs: impactMs + 150,
        durationMs: 900,
        frames: frames(
          [0, pose(0, 0, 0, 0.3), 0],
          [0.2, pose(0, 0, 90, 1), 1],
          [0.8, pose(0, -6, 360, 1), 1],
          [1, pose(0, -10, 450, 0.8), 0],
        ),
      },
    ],
    impactMs,
  };
}

/** The actor winds up and lobs a tomato across; it splats on the target and drips off. */
function tomato(a: Box, t: Box): Choreography {
  const throwAt = 420;
  const flightMs = 480;
  const impactMs = throwAt + flightMs;
  const from = { x: a.x + a.w / 2, y: a.y + a.h * 0.3 };
  const to = centre(t);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const peak = Math.min(0, dy) - 70;
  return {
    actor: {
      frames: frames(
        [0, pose()],
        [0.45, pose(0, 2, -14, 1.05, 0.92)],
        [0.6, pose(0, -4, 12, 0.95, 1.06)],
        [0.8, pose(0, 0, -3)],
        [1, pose()],
      ),
      delayMs: 0,
      durationMs: 700,
      easing: 'ease-in-out',
    },
    target: {
      frames: frames(
        [0, pose()],
        [0.15, pose(0, 0, -6, 0.9, 1.08)],
        [0.3, pose(3, 0, 5)],
        [0.45, pose(-2, 0, -3)],
        [1, pose()],
      ),
      delayMs: impactMs,
      durationMs: 600,
      easing: 'ease-out',
    },
    sprites: [
      {
        kind: 'doodle',
        doodle: 'tomato',
        x: from.x,
        y: from.y,
        size: 32,
        delayMs: throwAt,
        durationMs: flightMs,
        frames: frames(
          [0, pose(0, 0, 0, 0.8), 1],
          [0.5, pose(dx / 2, peak, 270, 1.15), 1],
          [0.95, pose(dx, dy, 520, 1), 1],
          [1, pose(dx, dy, 540, 1.3, 0.6), 0],
        ),
        easing: 'linear',
      },
      {
        kind: 'splat',
        x: to.x,
        y: to.y,
        size: t.w * 0.75,
        delayMs: impactMs,
        durationMs: 2000,
        frames: frames(
          [0, pose(0, 0, 0, 0.2), 1],
          [0.08, pose(0, 0, 0, 1.15), 1],
          [0.14, pose(0, 0, 0, 1), 1],
          [0.75, pose(0, 6, 0, 1), 1],
          [1, pose(0, 14, 0, 1), 0],
        ),
        easing: 'ease-out',
      },
      word('SPLAT!', to.x, t.y - 4, impactMs),
    ],
    impactMs,
  };
}

/** The actor rushes over and squeezes the target twice; hearts float up. */
function hug(a: Box, t: Box, side: 1 | -1): Choreography {
  const durationMs = 2000;
  const impactMs = Math.round(durationMs * 0.3);
  const from = centre(a);
  const to = centre(t);
  const dx = to.x + side * t.w * 0.42 - from.x;
  const dy = to.y - from.y;
  const mid = Math.min(0, dy) - 30;
  const lean = (d: number, squeeze: boolean) =>
    pose(dx - (squeeze ? side * 4 : 0), dy, -side * d, squeeze ? 1.05 : 1, squeeze ? 0.95 : 1);
  return {
    actor: away(durationMs),
    target: {
      frames: frames(
        [0, pose()],
        [0.15, pose(0, 0, side * 8)],
        [0.3, pose(0, 0, side * 10, 0.96, 1.04)],
        [0.45, pose(0, 0, side * 8)],
        [0.6, pose(0, 0, side * 10, 0.96, 1.04)],
        [0.8, pose(0, 0, side * 6)],
        [1, pose()],
      ),
      delayMs: impactMs,
      durationMs: 900,
      easing: 'ease-in-out',
    },
    sprites: [
      {
        kind: 'clone',
        x: from.x,
        y: from.y,
        size: a.w,
        delayMs: 0,
        durationMs,
        frames: frames(
          [0, pose()],
          [0.12, pose(dx / 2, mid)],
          [0.3, lean(8, false)],
          [0.4, lean(12, true)],
          [0.5, lean(8, false)],
          [0.6, lean(12, true)],
          [0.7, lean(8, false)],
          [0.8, pose(dx, dy)],
          [0.9, pose(dx / 2, mid)],
          [1, pose()],
        ),
        easing: 'ease-in-out',
      },
      ...floaters(['heart', 'heart', 'heart'], to.x + side * t.w * 0.2, t.y + t.h * 0.15, {
        delayMs: impactMs,
        gapMs: 180,
        size: 26,
        spread: 10,
      }),
    ],
    impactMs,
  };
}

/**
 * The choreography for one emote. `target` is the target's box (targeted emotes only); without it,
 * a targeted emote does nothing visible (its character isn't on screen, e.g. the Players tab is shut).
 */
export function choreograph(
  emote: Emote,
  actor: Box,
  target: Box | null,
  viewportWidth: number,
): Choreography | null {
  switch (emote) {
    case 'dance':
      return dance(actor);
    case 'taunt':
      return taunt(actor);
    case 'flex':
      return flex(actor);
    case 'cry':
      return cry(actor);
    case 'squish':
      return target && squish(actor, target);
    case 'slap':
      return target && slap(actor, target, standingSide(target, viewportWidth));
    case 'tomato':
      return target && tomato(actor, target);
    case 'hug':
      return target && hug(actor, target, standingSide(target, viewportWidth));
  }
}
