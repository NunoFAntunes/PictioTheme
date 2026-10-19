/**
 * The placement rules from docs/tower/product/game-rules.md that the sandbox plays by, as pure
 * functions of time (ms) so they can be tested. In a match, tower-core will own these.
 */

export const PLACE_MS = 15_000;
export const TOP_OUT_MS = 3_000;
export const ROTATE_STEP = Math.PI / 12; // 15°
/** How fast held ←/→ moves the target (world units per second). */
export const MOVE_SPEED = 3;

export type DazeRules = { firstMs: number; extraMs: number; maxMs: number };

export const DEFAULT_DAZE: DazeRules = { firstMs: 5_000, extraMs: 2_000, maxMs: 10_000 };

export type Daze = { since: number; until: number } | null;

/**
 * A fumble at `now`: starts a daze, or lengthens the current one by `extraMs`, never past
 * `maxMs` from its start. `firstMs = 0` turns dazes off.
 */
export function fumble(daze: Daze, now: number, rules: DazeRules = DEFAULT_DAZE): Daze {
  if (rules.firstMs <= 0) return null;
  if (daze && now < daze.until) {
    return {
      since: daze.since,
      until: Math.min(daze.since + rules.maxMs, daze.until + rules.extraMs),
    };
  }
  return { since: now, until: now + rules.firstMs };
}

export function isDazed(daze: Daze, now: number): boolean {
  return daze !== null && now < daze.until;
}

/**
 * Topping out: the tower has to stay at or above the line for `TOP_OUT_MS`. Returns when it
 * first got there (null if it isn't there now), and whether the countdown is done.
 */
export function topOut(
  since: number | null,
  height: number,
  line: number,
  now: number,
): { since: number | null; done: boolean; progress: number | null } {
  if (height < line) return { since: null, done: false, progress: null };
  const start = since ?? now;
  const progress = Math.min(1, (now - start) / TOP_OUT_MS);
  return { since: start, done: progress >= 1, progress };
}
