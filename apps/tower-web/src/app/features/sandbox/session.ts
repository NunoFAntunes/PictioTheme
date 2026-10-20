import type { Piece } from '@pictiotheme/doodle-shape';
import {
  createTowerWorld,
  loadPhysics,
  STEP_SECONDS,
  type PhysicsTuning,
  type PieceId,
  type TowerWorld,
} from '@pictiotheme/tower-physics';
import type { PieceBitmap } from '../piece';
import { drawTower, easeCamera, targetCamera, type Camera, type PieceLook } from '../tower';
import {
  DEFAULT_DAZE,
  fumble,
  isDazed,
  MOVE_SPEED,
  PLACE_MS,
  ROTATE_STEP,
  topOut,
  type Daze,
  type DazeRules,
} from './rules';

/**
 * The sandbox's engine: one tower world, the queue of pieces waiting to be placed, the fixed-step
 * loop, the placement rules (15s to place, fumbles daze, topping out) and the render loop.
 * Plain TypeScript outside React. React reads the HUD through `subscribe`/`getHud`
 * (useSyncExternalStore) and sends intents through the methods.
 *
 * Time for the rules is simulation time (ms of physics stepped), so a backgrounded tab simply
 * pauses the game.
 */

export type QueuedPiece = { word: string; piece: Piece; bitmap: PieceBitmap };

export type Hud = {
  ready: boolean;
  height: number;
  line: number;
  placed: number;
  fumbles: number;
  queue: readonly string[];
  /** The word being placed and the seconds left to place it. */
  placing: { word: string; secondsLeft: number } | null;
  dazedSeconds: number;
  /** 0–1 while counting down to topping out. */
  topping: number | null;
  toppedOut: boolean;
};

/** CSS px of the tower view covered by the HUD bar (top) and the controls (bottom). */
export const HUD_INSET = { top: 48, bottom: 72 };

/**
 * Spawn a new piece this far above the tower, plus its own radius: at the lowering speed
 * (0.8 m/s), about 7–8 seconds to aim and rotate before it touches anything.
 */
const SPAWN_GAP = 6;

export type SandboxSession = ReturnType<typeof createSandboxSession>;

export function createSandboxSession(initialTuning: Partial<PhysicsTuning> = {}) {
  let world: TowerWorld | null = null;
  const looks = new Map<PieceId, PieceLook>();
  const words = new Map<PieceId, string>();
  const queue: QueuedPiece[] = [];
  let line = 10;
  let dazeRules: DazeRules = DEFAULT_DAZE;
  let showColliders = false;

  let simMs = 0;
  let placingEndsAt = 0;
  let daze: Daze = null;
  let toppingSince: number | null = null;
  let topping: number | null = null;
  let toppedOut = false;
  let height = 0;
  let placed = 0;
  let fumbles = 0;

  const held = { left: false, right: false, fast: false };
  let targetX = 0;

  const listeners = new Set<() => void>();
  let hud: Hud = buildHud();
  let hudKey = '';

  function buildHud(): Hud {
    const activeId = world?.active ?? null;
    return {
      ready: world !== null,
      height,
      line,
      placed,
      fumbles,
      queue: queue.map((q) => q.word),
      placing:
        activeId !== null
          ? {
              word: words.get(activeId) ?? '',
              secondsLeft: Math.max(0, (placingEndsAt - simMs) / 1000),
            }
          : null,
      dazedSeconds: daze && isDazed(daze, simMs) ? (daze.until - simMs) / 1000 : 0,
      topping,
      toppedOut,
    };
  }

  function publish() {
    const next = buildHud();
    const key = [
      next.ready,
      next.height.toFixed(1),
      next.line,
      next.placed,
      next.fumbles,
      next.queue.join('|'),
      next.placing?.word,
      next.placing && Math.ceil(next.placing.secondsLeft),
      Math.ceil(next.dazedSeconds * 10),
      next.topping?.toFixed(2),
      next.toppedOut,
    ].join(';');
    if (key === hudKey) return;
    hudKey = key;
    hud = next;
    for (const l of listeners) l();
  }

  function spawnNext(w: TowerWorld) {
    if (w.active !== null || !queue.length || isDazed(daze, simMs)) return;
    const next = queue.shift() as QueuedPiece;
    let radius = 0;
    const o = next.piece.outline;
    for (let i = 0; i + 1 < o.length; i += 2)
      radius = Math.max(radius, Math.hypot(o[i] as number, o[i + 1] as number));
    targetX = 0;
    const id = w.spawn(next.piece, 0, w.top() + SPAWN_GAP + radius);
    if (id === null) return;
    looks.set(id, { piece: next.piece, bitmap: next.bitmap });
    words.set(id, next.word);
    placingEndsAt = simMs + PLACE_MS;
  }

  function step(w: TowerWorld) {
    simMs += STEP_SECONDS * 1000;
    spawnNext(w);
    if (w.active !== null) {
      const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      targetX += dir * MOVE_SPEED * STEP_SECONDS;
      w.steer({ x: targetX, fast: held.fast });
      targetX = w.target?.x ?? targetX;
      if (simMs >= placingEndsAt) w.drop();
    }
    const events = w.step();
    if (events.released) placed += 1;
    for (const id of events.fumbled) {
      fumbles += 1;
      looks.delete(id);
      words.delete(id);
      daze = fumble(daze, simMs, dazeRules);
    }
    if (w.tick % 6 === 0) {
      height = w.height();
      const state = topOut(toppingSince, height, line, simMs);
      toppingSince = state.since;
      topping = state.progress;
      if (state.done) toppedOut = true;
    }
  }

  // ── Loop ──
  let canvas: HTMLCanvasElement | null = null;
  let camera: Camera | null = null;
  let frame = 0;
  let last = 0;
  let acc = 0;

  function render(dt: number) {
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = { width: canvas.clientWidth, height: canvas.clientHeight };
    if (!size.width || !size.height) return;
    if (
      canvas.width !== Math.round(size.width * dpr) ||
      canvas.height !== Math.round(size.height * dpr)
    ) {
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
    }
    const { platformWidth, reach } = world.tuning;
    camera = easeCamera(
      camera,
      targetCamera({
        ...size,
        platformWidth,
        reach,
        towerTop: world.top(),
        line,
        insetTop: HUD_INSET.top,
        insetBottom: HUD_INSET.bottom,
      }),
      dt,
    );
    drawTower(ctx, size, dpr, camera, {
      bodies: world.bodies(),
      looks,
      platformWidth,
      platformThickness: world.tuning.platformThickness,
      line,
      height,
      topping,
      insetTop: HUD_INSET.top,
      showColliders,
      time: performance.now() / 1000,
      seed: 1,
    });
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.25, last ? (now - last) / 1000 : 0);
    last = now;
    if (world) {
      acc += dt;
      let steps = 0;
      while (acc >= STEP_SECONDS && steps < 8) {
        step(world);
        acc -= STEP_SECONDS;
        steps += 1;
      }
      if (steps === 8) acc = 0;
    }
    render(dt);
    publish();
  }

  let disposed = false;
  void loadPhysics().then(() => {
    if (disposed) return;
    world = createTowerWorld(initialTuning);
    publish();
  });

  return {
    /** Starts drawing the tower on this canvas (and stepping). Returns a detach function. */
    attach(target: HTMLCanvasElement): () => void {
      canvas = target;
      last = 0;
      frame = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(frame);
        canvas = null;
      };
    },

    enqueue(piece: QueuedPiece): void {
      queue.push(piece);
      publish();
    },

    hold(control: 'left' | 'right' | 'fast', down: boolean): void {
      held[control] = down;
    },

    /** +1 turns counter-clockwise, −1 clockwise, by 15°. */
    rotate(direction: 1 | -1): void {
      const target = world?.target;
      if (target) world?.steer({ angle: target.angle + direction * ROTATE_STEP });
    },

    drop(): void {
      world?.drop();
    },

    retune(patch: Partial<PhysicsTuning>): void {
      world?.retune(patch);
    },

    get tuning(): PhysicsTuning | null {
      return world?.tuning ?? null;
    },

    setLine(height: number): void {
      line = height;
      toppedOut = false;
      toppingSince = null;
    },

    setDaze(rules: DazeRules): void {
      dazeRules = rules;
    },

    setShowColliders(show: boolean): void {
      showColliders = show;
    },

    /** Knocks the tower down: every piece goes, the counters start again. The queue stays. */
    resetTower(): void {
      world?.clear();
      looks.clear();
      words.clear();
      daze = null;
      toppingSince = null;
      topping = null;
      toppedOut = false;
      height = 0;
      placed = 0;
      fumbles = 0;
      publish();
    },

    clearQueue(): void {
      queue.length = 0;
      publish();
    },

    // Arrow properties: React's useSyncExternalStore calls these unbound.
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getHud: (): Hud => hud,

    dispose(): void {
      disposed = true;
      cancelAnimationFrame(frame);
      world?.free();
      world = null;
    },
  };
}
