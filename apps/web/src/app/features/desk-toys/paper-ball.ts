/*
 * The paper ball you throw at the wastebasket (PaperBallGame.tsx), seen from above: it slides
 * on the paper, slowing down, and bounces off the edges of its box. Thrown hard it sails over the
 * basket; it drops in when it reaches the basket slowly enough. Positions are px in the box,
 * velocities px per second.
 */

export type Ball = { x: number; y: number; vx: number; vy: number };
export type Box = { width: number; height: number; radius: number };
export type Basket = { x: number; y: number; radius: number };
export type Sample = { x: number; y: number; t: number };

/** How quickly it slows down: velocity falls by e every 1/FRICTION seconds. */
const FRICTION = 1.5;
/** Speed kept off an edge. */
const BOUNCE = 0.6;
/** Below this it has stopped (px/s). */
const REST_SPEED = 12;
/** Faster than this, it's in the air and flies over the basket (px/s). */
const DROP_SPEED = 650;
const MAX_SPEED = 2400;
/** How far back a throw looks at the pointer to measure its speed (ms). */
const THROW_WINDOW = 90;

export function speed(ball: Ball): number {
  return Math.hypot(ball.vx, ball.vy);
}

export function atRest(ball: Ball): boolean {
  return speed(ball) < REST_SPEED;
}

/** Moves the ball on by `dt` seconds. `bounced` is how hard it hit an edge (0 if it didn't). */
export function step(ball: Ball, dt: number, box: Box): { ball: Ball; bounced: number } {
  const slow = Math.exp(-FRICTION * dt);
  let vx = ball.vx * slow;
  let vy = ball.vy * slow;
  let x = ball.x + vx * dt;
  let y = ball.y + vy * dt;
  let bounced = 0;
  const r = box.radius;

  if (x < r || x > box.width - r) {
    bounced = Math.max(bounced, Math.abs(vx));
    x = x < r ? r : box.width - r;
    vx = -vx * BOUNCE;
  }
  if (y < r || y > box.height - r) {
    bounced = Math.max(bounced, Math.abs(vy));
    y = y < r ? r : box.height - r;
    vy = -vy * BOUNCE;
  }
  return { ball: { x, y, vx, vy }, bounced };
}

/** Whether the ball drops into the basket: its middle over the opening, slow enough to fall. */
export function dropsIn(ball: Ball, basket: Basket): boolean {
  const inside = Math.hypot(ball.x - basket.x, ball.y - basket.y) < basket.radius * 0.75;
  return inside && speed(ball) < DROP_SPEED;
}

/**
 * The velocity a drag lets go with: how far the pointer went over the last few samples, capped.
 * Null when it barely moved (a tap, not a throw).
 */
export function throwVelocity(samples: Sample[]): { vx: number; vy: number } | null {
  const last = samples.at(-1);
  if (!last) return null;
  const first = samples.find((s) => last.t - s.t <= THROW_WINDOW) ?? last;
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return null;
  let vx = (last.x - first.x) / dt;
  let vy = (last.y - first.y) / dt;
  const v = Math.hypot(vx, vy);
  if (v < 60) return null;
  if (v > MAX_SPEED) {
    vx *= MAX_SPEED / v;
    vy *= MAX_SPEED / v;
  }
  return { vx, vy };
}
