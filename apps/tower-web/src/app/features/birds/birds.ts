import type { PieceId } from '@pictiotheme/tower-physics';

/**
 * The spells' birds (docs/tower/planning/power-ups.md): where the Pigeons and the Magpie are over
 * a tower, frame by frame. Pigeons fly in, perch and fly off; a magpie flies in to the tower's top
 * piece, carries it off and flies it into the thief's tower. Plain functions of time, drawn by the
 * renderer.
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
  /** The carried piece's tilt (radians), as it was on the tower when it was taken. */
  carryAngle?: number;
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
 * One Pigeon spell bird. Feed it where the pigeon is perched (null while it isn't) every frame:
 * it flies in to its perch from that side when it appears (`delay` ms after), and off the same
 * way when it goes.
 */
export function createPigeonFlight(delay = 0) {
  let perch: (Point & { since: number }) | null = null;
  let gone: (Point & { at: number }) | null = null;
  return (at: Point | null, now: number): Bird | null => {
    if (at) {
      perch = { x: at.x, y: at.y, since: perch?.since ?? now + delay };
      gone = null;
      const out = sideOf(at.x);
      const p = (now - perch.since) / BIRD_FLY_MS;
      if (p < 0) return null;
      // It faces the middle of the tower, the way it came in.
      const facing = out === 1 ? -1 : 1;
      if (p < 1) return { kind: 'pigeon', ...flyIn(at, out, p), facing, flying: true };
      return { kind: 'pigeon', x: at.x, y: at.y, facing, flying: false };
    }
    // One that never arrived just doesn't.
    if (perch && now >= perch.since) gone = { x: perch.x, y: perch.y, at: now };
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

/** A little after each other, so the flock doesn't arrive as one. */
const PIGEON_STAGGER_MS = 220;

/**
 * The Pigeon spell's birds: one flight per pigeon (by its id in the frames), each flying in to its
 * perch and off again on its own.
 */
export function createPigeonFlights() {
  const flights = new Map<number, ReturnType<typeof createPigeonFlight>>();
  return (perched: readonly (Point & { id: number })[], now: number): Bird[] => {
    for (const { id } of perched) {
      if (!flights.has(id)) flights.set(id, createPigeonFlight(flights.size * PIGEON_STAGGER_MS));
    }
    const birds: Bird[] = [];
    for (const [id, flight] of flights) {
      const bird = flight(perched.find((p) => p.id === id) ?? null, now);
      if (bird) birds.push(bird);
    }
    return birds;
  };
}

export type MagpieInput = {
  /** Server time. */
  now: number;
  /**
   * When a magpie cast at this tower takes its piece (the spell's start), while the spell is on:
   * it flies in just before, and hovers there until the server says what it took.
   */
  takesAt: number | null;
  /** The tower's topmost piece (not the one being placed), the one it grabs. Null: none. */
  top: (Point & { angle: number }) | null;
  /** The side the other crew's tower is on: magpies come from there and go back there. */
  side: 1 | -1;
  /** The last piece a magpie took from this tower. */
  took: { at: number; pieceId: PieceId } | null;
  /**
   * The last piece a magpie brought to this tower (arriving `at`), and where it is (if it's being
   * placed).
   */
  brought: { at: number; pieceId: PieceId; to: Point | null } | null;
};

/** Where a magpie grabs a piece: its feet on the piece, so the piece hangs where it stood. */
const grabOver = (top: MagpieInput['top']): Point =>
  top ? { x: top.x, y: top.y + CARRY_BELOW } : { x: 0, y: CARRY_BELOW + 1 };

/**
 * The Magpie spell's birds over one tower: one flying in to the top of it and off again (with the
 * piece it took, or with nothing from an empty tower); and one flying in a piece it took for this
 * crew, hiding that piece (`hide`) until it lets go of it.
 */
export function createMagpieFlight() {
  /** Where the grabbing magpie was last frame, and the tilt of the piece it's grabbing. */
  let hover: (Point & { angle: number }) | null = null;
  /** The magpie leaving: from where it was, with the piece it took (if it took one). */
  let gone: { from: Point; at: number; carrying?: PieceId; angle: number } | null = null;
  /** The steal already flown off with. */
  let tookAt: number | null = null;

  return (input: MagpieInput): { birds: Bird[]; hide: PieceId | null } => {
    const { now, side, takesAt } = input;
    const birds: Bird[] = [];
    let hide: PieceId | null = null;
    const inward = side === 1 ? -1 : 1;

    // ── Over its victim's tower ──
    const took =
      input.took && input.took.at !== tookAt && now - input.took.at < BIRD_FLY_MS
        ? input.took
        : null;
    if (took) {
      // Off with it, from right over where it stood.
      const from = hover ?? grabOver(input.top);
      gone = { from, at: now, carrying: took.pieceId, angle: hover?.angle ?? 0 };
      tookAt = took.at;
      hover = null;
    } else if (takesAt !== null && now >= takesAt - BIRD_FLY_MS) {
      const grab = grabOver(input.top);
      const p = (now - (takesAt - BIRD_FLY_MS)) / BIRD_FLY_MS;
      // In over the top piece, then flapping on the spot as it gets a grip.
      const at =
        p < 1 ? flyIn(grab, side, p) : { x: grab.x, y: grab.y + 0.06 * Math.sin(now / 70) };
      birds.push({ kind: 'magpie', ...at, facing: inward, flying: true });
      hover = { ...at, angle: input.top?.angle ?? 0 };
    } else if (hover) {
      // The spell's over and it took nothing: off empty-handed.
      gone = { from: hover, at: now, angle: 0 };
      hover = null;
    }
    if (gone) {
      const p = (now - gone.at) / BIRD_FLY_MS;
      if (p >= 1) gone = null;
      else {
        birds.push({
          kind: 'magpie',
          ...flyOff(gone.from, side, p),
          facing: side,
          flying: true,
          ...(gone.carrying !== undefined && {
            carrying: gone.carrying,
            // Shrinking to what a bird could lift, and swinging straight under it.
            carrySize: 1 - (1 - CARRY_SIZE) * Math.min(1, p * 2),
            carryAngle: gone.angle * Math.max(0, 1 - p * 2),
          }),
        });
      }
    }

    // ── Bringing a piece to the thief's tower ──
    const brought = input.brought;
    if (brought) {
      const p = (now - brought.at) / BIRD_FLY_MS;
      const to = brought.to ?? { x: 0, y: Math.max(0, input.top?.y ?? 0) + 3 };
      const perch = { x: to.x, y: to.y + CARRY_BELOW };
      if (p < 0) {
        // Still on its way over from the other tower.
        hide = brought.pieceId;
      } else if (p < 1) {
        hide = brought.pieceId;
        birds.push({
          kind: 'magpie',
          ...flyIn(perch, side, p),
          facing: inward,
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
