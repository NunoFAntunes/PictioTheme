/**
 * Spring-tethered letters for the landing logo. Pure: state in, state out, no DOM or clocks,
 * so it is unit-tested directly. Each letter is a circle tied to its home spot by a damped spring;
 * it can be nudged by the cursor, grabbed and flung, and it bumps into its neighbours.
 * Positions are px offsets from home; home and radius come from measuring the rendered letters.
 */

export type LetterBody = {
  homeX: number;
  homeY: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  va: number;
};

export type PointerState = { x: number; y: number; vx: number; vy: number };

/** The grabbed letter, held at the pointer minus where on the letter it was picked up. */
export type Grab = { index: number; offsetX: number; offsetY: number };

/** Where letter centres may go, in the same coordinates as home. */
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export type StepInput = {
  pointer: PointerState | null;
  /** Hovering pushes letters away (mouse only; a touch shouldn't shove what it isn't holding). */
  nudge: boolean;
  grab: Grab | null;
  bounds: Bounds | null;
};

const SUBSTEP = 1 / 120;
const MAX_DT = 1 / 15;
const SPRING = 160;
const DAMPING = 11;
const ANGLE_SPRING = 220;
const ANGLE_DAMPING = 12;
const MAX_SPEED = 4000;
const RESTITUTION = 0.55;
const NUDGE_RADIUS = 1.7; // × letter radius
const NUDGE_STRENGTH = 7;
const NUDGE_SPIN = 0.0008;
const HELD_TILT = 0.00035;
const MAX_TILT = 0.6;

export function makeLetterBody(homeX: number, homeY: number, r: number): LetterBody {
  return { homeX, homeY, r, x: 0, y: 0, vx: 0, vy: 0, angle: 0, va: 0 };
}

export function step(bodies: readonly LetterBody[], dt: number, input: StepInput): LetterBody[] {
  let next = bodies.map((b) => ({ ...b }));
  const total = Math.min(Math.max(dt, 0), MAX_DT);
  const substeps = Math.ceil(total / SUBSTEP);
  for (let i = 0; i < substeps; i++) {
    next = substep(next, total / substeps, input);
  }
  return next;
}

function substep(bodies: LetterBody[], h: number, input: StepInput): LetterBody[] {
  const { pointer, grab } = input;
  for (const [i, b] of bodies.entries()) {
    if (grab?.index === i && pointer) {
      // Follows the pointer exactly and carries its velocity, so letting go flings it.
      b.x = pointer.x - grab.offsetX - b.homeX;
      b.y = pointer.y - grab.offsetY - b.homeY;
      b.vx = clamp(pointer.vx, MAX_SPEED);
      b.vy = clamp(pointer.vy, MAX_SPEED);
      // Lean into the drag, like something dangling from your fingers.
      const tilt = clamp(b.vx * HELD_TILT, MAX_TILT);
      b.va += (-ANGLE_SPRING * (b.angle - tilt) - ANGLE_DAMPING * b.va) * h;
      b.angle += b.va * h;
      continue;
    }

    let ax = -SPRING * b.x - DAMPING * b.vx;
    let ay = -SPRING * b.y - DAMPING * b.vy;
    let aa = -ANGLE_SPRING * b.angle - ANGLE_DAMPING * b.va;

    if (input.nudge && pointer) {
      const dx = b.homeX + b.x - pointer.x;
      const dy = b.homeY + b.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      const reach = b.r * NUDGE_RADIUS;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      if (dist > 0 && dist < reach && speed > 0) {
        const falloff = 1 - dist / reach;
        ax += (dx / dist) * speed * NUDGE_STRENGTH * falloff;
        ay += (dy / dist) * speed * NUDGE_STRENGTH * falloff;
        // Brushing past one side of a letter spins it.
        aa += (dx * pointer.vy - dy * pointer.vx) * NUDGE_SPIN * falloff * (60 / b.r);
      }
    }

    b.vx = clamp(b.vx + ax * h, MAX_SPEED);
    b.vy = clamp(b.vy + ay * h, MAX_SPEED);
    b.va += aa * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.angle += b.va * h;
  }

  collide(bodies, grab?.index ?? -1);
  if (input.bounds) {
    for (const b of bodies) keepInside(b, input.bounds);
  }
  return bodies;
}

/** Pushes overlapping letters apart and bounces them off each other. The held one doesn't budge. */
function collide(bodies: LetterBody[], held: number): void {
  for (const [i, a] of bodies.entries()) {
    for (const [j, b] of bodies.entries()) {
      if (j <= i) continue;
      const dx = b.homeX + b.x - (a.homeX + a.x);
      const dy = b.homeY + b.y - (a.homeY + a.y);
      const dist = Math.hypot(dx, dy);
      const overlap = a.r + b.r - dist;
      if (overlap <= 0) continue;

      const [nx, ny] = dist > 0 ? [dx / dist, dy / dist] : [1, 0];
      const wa = i === held ? 0 : j === held ? 1 : 0.5;
      const wb = 1 - wa;
      a.x -= nx * overlap * wa;
      a.y -= ny * overlap * wa;
      b.x += nx * overlap * wb;
      b.y += ny * overlap * wb;

      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing >= 0) continue;
      const impulse = -(1 + RESTITUTION) * closing;
      a.vx -= nx * impulse * wa;
      a.vy -= ny * impulse * wa;
      b.vx += nx * impulse * wb;
      b.vy += ny * impulse * wb;
    }
  }
}

function keepInside(b: LetterBody, bounds: Bounds): void {
  const cx = b.homeX + b.x;
  const cy = b.homeY + b.y;
  if (cx < bounds.minX + b.r) {
    b.x = bounds.minX + b.r - b.homeX;
    b.vx = Math.abs(b.vx) * RESTITUTION;
  } else if (cx > bounds.maxX - b.r) {
    b.x = bounds.maxX - b.r - b.homeX;
    b.vx = -Math.abs(b.vx) * RESTITUTION;
  }
  if (cy < bounds.minY + b.r) {
    b.y = bounds.minY + b.r - b.homeY;
    b.vy = Math.abs(b.vy) * RESTITUTION;
  } else if (cy > bounds.maxY - b.r) {
    b.y = bounds.maxY - b.r - b.homeY;
    b.vy = -Math.abs(b.vy) * RESTITUTION;
  }
}

/** True when every letter is home and still, so the animation loop can stop. */
export function isAtRest(bodies: readonly LetterBody[]): boolean {
  return bodies.every(
    (b) =>
      Math.abs(b.x) < 0.3 &&
      Math.abs(b.y) < 0.3 &&
      Math.hypot(b.vx, b.vy) < 3 &&
      Math.abs(b.angle) < 0.002 &&
      Math.abs(b.va) < 0.02,
  );
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
