import type { PieceId } from '@pictiotheme/tower-physics';

/**
 * The spells' birds (docs/tower/planning/power-ups.md): where the Pigeon and the Magpie are over a
 * tower, frame by frame. They fly in, perch or circle, and fly off; a magpie carries off the piece
 * it took and flies it into the thief's tower. Plain functions of time, drawn by the renderer.
 */

export type Bird = {
  kind: 'pigeon' | 'magpie';
  /** Where it stands (perched) or is (flying), in world units. */
  x: number;
  y: number;
  /** −1 left, 1 right. */
  facing: 1 | -1;
  /** Wings out and flapping, or folded on a perch. */
  flying: boolean;
  /** A piece it carries in its feet, `CARRY_BELOW` under it. */
  carrying?: PieceId;
  /** The carried piece's size: shrunk to what a bird could lift, growing back as it's let go. */
  carrySize?: number;
};

/** How far under a magpie the middle of the piece it carries hangs, in world units. */
export const CARRY_BELOW = 0.9;
const CARRY_SIZE = 0.6;

type Point = { x: number; y: number };

/** How long a bird takes to fly in, or off. */
export const BIRD_FLY_MS = 900;

/** Where a flight in or off starts or ends: up and out, past the edge of the view. */
const AWAY = { x: 6, y: 3 };

/** Flying in from `side` (−1 left, 1 right) to `to`, `p` (0–1) of the way: it slows to land. */
export function flyIn(to: Point, side: 1 | -1, p: number): Point {
  const ease = 1 - (1 - p) * (1 - p);
  // It drops first and glides the last stretch in.
  const drop = 1 - (1 - p) ** 3;
  return { x: to.x + side * AWAY.x * (1 - ease), y: to.y + AWAY.y * (1 - drop) };
}

/** Flying off from `from` towards `side`, `p` (0–1) of the way: it speeds up as it goes. */
export function flyOff(from: Point, side: 1 | -1, p: number): Point {
  const ease = p * p;
  return { x: from.x + side * AWAY.x * ease, y: from.y + AWAY.y * ease };
}

const sideOf = (x: number): 1 | -1 => (x >= 0 ? 1 : -1);

/**
 * The Pigeon spell's bird. Feed it where the pigeon is perched (null while it isn't) every frame:
 * it flies in to its perch from that side when it appears, and off the same way when it goes.
 */
export function createPigeonFlight() {
  let perch: (Point & { since: number }) | null = null;
  let gone: (Point & { at: number }) | null = null;
  return (at: Point | null, now: number): Bird | null => {
    if (at) {
      perch = { x: at.x, y: at.y, since: perch?.since ?? now };
      gone = null;
      const out = sideOf(at.x);
      const p = (now - perch.since) / BIRD_FLY_MS;
      // It faces the middle of the tower, the way it came in.
      const facing = out === 1 ? -1 : 1;
      if (p < 1) return { kind: 'pigeon', ...flyIn(at, out, p), facing, flying: true };
      return { kind: 'pigeon', x: at.x, y: at.y, facing, flying: false };
    }
    if (perch) gone = { x: perch.x, y: perch.y, at: now };
    perch = null;
    if (!gone) return null;
    const p = (now - gone.at) / BIRD_FLY_MS;
    if (p >= 1) {
      gone = null;
      return null;
    }
    const out = sideOf(gone.x);
    return { kind: 'pigeon', ...flyOff(gone, out, p), facing: out, flying: true };
  };
}

/** Where a circling magpie is, `ms` into its circling, over a tower whose top is at `top`. */
function circling(ms: number, top: number): Point & { facing: 1 | -1 } {
  const a = (ms / 1000) * 1.7;
  return {
    x: 1.6 * Math.cos(a),
    y: Math.max(0, top) + 2.2 + 0.35 * Math.sin(a) + 0.15 * Math.sin(a * 3),
    // Moving along the near side of the loop to the left, the far side to the right.
    facing: Math.sin(a) > 0 ? -1 : 1,
  };
}

export type MagpieInput = {
  /** Server time. */
  now: number;
  /** When a magpie cast at this tower arrived, while it's still circling. */
  circlingSince: number | null;
  /** The top of the tower, to circle over. */
  top: number;
  /** The side the other crew's tower is on: magpies come from there and go back there. */
  side: 1 | -1;
  /** The last piece a magpie took from this tower. */
  took: { at: number; pieceId: PieceId } | null;
  /** The last piece a magpie brought to this tower, and where it is (if it's being placed). */
  brought: { at: number; pieceId: PieceId; to: Point | null } | null;
};

/**
 * The Magpie spell's birds over one tower: one flying in and circling over it, then flying off
 * (with the piece it took, or with nothing after waiting too long); and one flying in a piece it
 * took for this crew, hiding that piece (`hide`) until it lets go of it.
 */
export function createMagpieFlight() {
  /** Where the circling magpie was last frame. */
  let last: Point | null = null;
  /** The circling magpie leaving: from where it was (null if it was never seen circling). */
  let gone: { from: Point | null; at: number; carrying?: PieceId } | null = null;
  /** The steal already flown off with. */
  let tookAt: number | null = null;

  return (input: MagpieInput): { birds: Bird[]; hide: PieceId | null } => {
    const { now, side, top } = input;
    const birds: Bird[] = [];
    let hide: PieceId | null = null;

    // ── Over its victim's tower ──
    const took =
      input.took && input.took.at !== tookAt && now - input.took.at < BIRD_FLY_MS
        ? input.took
        : null;
    if (input.circlingSince !== null) {
      const ms = now - input.circlingSince;
      const loop = circling(ms, top);
      const p = ms / BIRD_FLY_MS;
      const at = p < 1 ? flyIn(loop, side, p) : loop;
      const facing = p < 1 ? (side === 1 ? -1 : 1) : loop.facing;
      birds.push({ kind: 'magpie', ...at, facing, flying: true });
      last = at;
      gone = null;
    } else if (last || took) {
      // It just left: with the piece if it took one. A piece already waiting as it arrived is
      // taken at once, before it was ever seen circling: it swoops in and out with it.
      gone = { from: last, at: last ? now : (took?.at ?? now) };
      if (took) {
        gone.carrying = took.pieceId;
        tookAt = took.at;
      }
      last = null;
    }
    if (gone) {
      const p = (now - gone.at) / BIRD_FLY_MS;
      if (gone.from) {
        if (p >= 1) gone = null;
        else birds.push({ kind: 'magpie', ...flyOff(gone.from, side, p), ...away(gone, side) });
      } else {
        // In and straight back out with it, swooping over the top of the tower.
        const over = { x: 0, y: Math.max(0, top) + 2 };
        if (p >= 2) gone = null;
        else if (p < 1) {
          const facing = side === 1 ? -1 : 1;
          birds.push({ kind: 'magpie', ...flyIn(over, side, p), facing, flying: true });
        } else birds.push({ kind: 'magpie', ...flyOff(over, side, p - 1), ...away(gone, side) });
      }
    }

    // ── Bringing a piece to the thief's tower ──
    const brought = input.brought;
    if (brought) {
      const p = (now - brought.at) / BIRD_FLY_MS;
      const to = brought.to ?? { x: 0, y: Math.max(0, top) + 3 };
      const perch = { x: to.x, y: to.y + CARRY_BELOW };
      if (p < 1) {
        hide = brought.pieceId;
        birds.push({
          kind: 'magpie',
          ...flyIn(perch, side, p),
          facing: side === 1 ? -1 : 1,
          flying: true,
          carrying: brought.pieceId,
          // Full size by the time it's under the balloons.
          carrySize: CARRY_SIZE + (1 - CARRY_SIZE) * p * p,
        });
      } else if (p < 2) {
        // It lets go over the balloons and flies home; with no balloons yet, it keeps it.
        birds.push({
          kind: 'magpie',
          ...flyOff(perch, side, p - 1),
          facing: side,
          flying: true,
          ...(!brought.to && { carrying: brought.pieceId }),
        });
      }
    }
    return { birds, hide };
  };
}

function away(gone: { carrying?: PieceId }, side: 1 | -1) {
  return {
    facing: side,
    flying: true,
    ...(gone.carrying !== undefined && { carrying: gone.carrying }),
  };
}
