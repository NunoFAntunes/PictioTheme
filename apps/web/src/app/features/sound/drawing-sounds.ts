import type { StrokeModel } from '../../realtime';

/**
 * Turns changes in the stroke model into drawing sounds: a faint pencil scribble that follows
 * how fast the line moves, and a glug when the paint bucket is used. It watches the model, not the
 * input, so the drawer and every guesser hear the same thing. Plain TypeScript, no React.
 */

export type DrawingSoundOutput = {
  /** The pencil is moving: level 0–1 from its speed. */
  scribble(level: number, tool: 'brush' | 'eraser'): void;
  /** The pencil stopped or lifted. */
  quiet(): void;
  fill(): void;
};

/** A line moving this fast (logical px per ms, on the 1200×900 board) scribbles at full level. */
const FULL_SPEED = 1.5;
/** Points arrive in batches every ~33 ms; this long without one means the pencil stopped. */
const STILL_MS = 120;

export function pencilLevel(distance: number, elapsedMs: number): number {
  if (distance <= 0) return 0;
  return Math.min(1, distance / Math.max(elapsedMs, 16) / FULL_SPEED);
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };

const browserTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function watchDrawing(
  model: StrokeModel,
  out: DrawingSoundOutput,
  now: () => number = () => performance.now(),
  timers: Timers = browserTimers,
): () => void {
  let epoch = model.epoch;
  let count = model.strokes.length;
  let openId: string | null = null;
  let seen = 0; // numbers of the open stroke's pts already heard
  let lastAt = 0;
  let stillTimer: unknown;

  const quiet = () => {
    timers.clear(stillTimer);
    out.quiet();
  };

  const unsubscribe = model.subscribe(() => {
    const { strokes } = model;
    const last = strokes.at(-1);

    // A reset (new turn, snapshot) or an undo rewrites history: nothing was just drawn.
    if (model.epoch !== epoch) {
      epoch = model.epoch;
      count = strokes.length;
      openId = null;
      quiet();
      return;
    }
    const added = strokes.length > count;
    count = strokes.length;
    if (added && last?.tool === 'fill') out.fill();

    if (!model.openId || !last || !('pts' in last) || last.id !== model.openId) {
      if (openId) quiet();
      openId = null;
      return;
    }
    if (last.id !== openId) {
      // A new line: its first point is where the pencil lands, not movement.
      openId = last.id;
      seen = last.pts.length;
      lastAt = now();
      return;
    }
    const pts = last.pts;
    if (pts.length <= seen) return;
    let distance = 0;
    for (let i = Math.max(seen, 3); i < pts.length; i += 3) {
      distance += Math.hypot(
        (pts[i] ?? 0) - (pts[i - 3] ?? 0),
        (pts[i + 1] ?? 0) - (pts[i - 2] ?? 0),
      );
    }
    seen = pts.length;
    const at = now();
    const level = pencilLevel(distance, at - lastAt);
    lastAt = at;
    out.scribble(level, last.tool);
    timers.clear(stillTimer);
    stillTimer = timers.set(quiet, STILL_MS);
  });

  return () => {
    unsubscribe();
    quiet();
  };
}
