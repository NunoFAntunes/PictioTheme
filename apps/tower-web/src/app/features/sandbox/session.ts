import type { Piece } from '@pictiotheme/doodle-shape';
import { curseEffects, SPELL_TUNING, STAR_TUNING, type Curse } from '@pictiotheme/protocol/tower';
import {
  createTowerWorld,
  loadPhysics,
  STEP_SECONDS,
  type PhysicsTuning,
  type PieceId,
  type TowerWorld,
} from '@pictiotheme/tower-physics';
import type { PieceBitmap } from '../piece';
import { playGameCue, playVillageCue } from '../sound';
import { uiScale } from '../../lib/ui-scale';
import { BIRD_FLY_MS, createMagpieFlight, createPigeonFlights } from '../birds';
import {
  createTowerLife,
  drawTower,
  easeCamera,
  targetCamera,
  updateTowerLife,
  type Camera,
  type PieceLook,
  type TowerLife,
  worldExtent,
} from '../tower';
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

/** A piece waiting to be placed, with the curses to try it with (already grown if `big_ice`). */
export type QueuedPiece = {
  word: string;
  piece: Piece;
  bitmap: PieceBitmap;
  curses?: readonly Curse[];
};

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
  /** Sky stars caught, while one is out (null: stars are off). */
  stars: number | null;
};

/** CSS px of the tower view covered by the HUD bar (top) and the controls (bottom), at 16px rem. */
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
  /** A Fog spell's thickness over the tower (0: none), to see how it looks to its victims. */
  let fog = 0;
  /** A sky star to try catching: it comes back on the other side each time it's caught. */
  let star: { x: number; y: number; holdSince: number | null } | null = null;
  let starsCaught = 0;
  /** Which side the first pigeon lands on: they take turns. */
  let pigeonSide: 1 | -1 = 1;
  /**
   * A magpie (page time, ms): flying in to take the top piece at `takesAt`, then off with it
   * (`took`). There's no thief's tower here: once it's gone, the piece is back in the queue.
   */
  let magpie: {
    takesAt: number | null;
    took: { at: number; pieceId: PieceId; piece: QueuedPiece } | null;
  } | null = null;

  function placeStar(w: TowerWorld, side: 1 | -1) {
    const x = (side * (STAR_TUNING.outsideX[0] + STAR_TUNING.outsideX[1])) / 2;
    star = { x, y: height + (STAR_TUNING.y[0] + STAR_TUNING.y[1]) / 2, holdSince: null };
    w.setStar(star.x, star.y, STAR_TUNING.radius);
  }

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
      stars: star ? starsCaught : null,
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
      next.stars,
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
    const curses = next.curses ?? [];
    const curse = curseEffects(curses);
    const id = w.spawn(next.piece, 0, w.top() + SPAWN_GAP + radius, 0, undefined, curse.material);
    if (id === null) return;
    looks.set(id, { piece: next.piece, bitmap: next.bitmap, curses });
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
    if (events.released) {
      placed += 1;
      // A cursed piece lands with its curse's sound, as in a match.
      const curses = looks.get(events.released.id)?.curses ?? [];
      if (curses.includes('bouncy')) playGameCue('boing');
      if (curses.includes('melt') || curses.includes('blob')) playGameCue('squelch');
      if (curses.includes('slippery') || curses.includes('big_ice')) playGameCue('ice');
    }
    if (events.pigeon) playGameCue('pigeon-off');
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
      if (star) {
        const held = w.starHeld();
        if (!held) star.holdSince = null;
        else if (star.holdSince === null) star.holdSince = simMs;
        else if (simMs - star.holdSince >= STAR_TUNING.holdMs) {
          starsCaught += 1;
          playGameCue('star-caught');
          placeStar(w, star.x > 0 ? -1 : 1);
        }
      }
    }
  }

  // ── Loop ──
  let canvas: HTMLCanvasElement | null = null;
  let camera: Camera | null = null;
  /** The village at the tower's foot, rebuilt if the platform's width is tuned. */
  let life: TowerLife | null = null;
  let lifeWidth = 0;
  let frame = 0;
  let last = 0;
  let acc = 0;
  const pigeonFlights = createPigeonFlights();
  const magpieFlight = createMagpieFlight();

  /** The tower's topmost piece, not counting the one being placed: what a magpie takes. */
  function topPiece(w: TowerWorld) {
    let top: { x: number; y: number; angle: number; height: number } | null = null;
    for (const body of w.bodies()) {
      const look = looks.get(body.id);
      if (body.active || !look) continue;
      const height = worldExtent(body, look.piece.outline).top;
      if (!top || height > top.height) top = { ...body, height };
    }
    return top;
  }

  /** The magpie's birds this frame. */
  function magpieBirds(now: number, w: TowerWorld) {
    if (magpie?.takesAt != null && now >= magpie.takesAt) {
      const id = w.takeTop();
      const look = id === null ? undefined : looks.get(id);
      if (id !== null && look) {
        const piece = { word: words.get(id) ?? '', ...look };
        magpie = { takesAt: null, took: { at: now, pieceId: id, piece } };
        playGameCue('magpie-took');
      } else {
        magpie = { takesAt: null, took: null };
        playGameCue('magpie-off');
      }
    }
    const took = magpie?.took ?? null;
    const { birds } = magpieFlight({
      now,
      takesAt: magpie?.takesAt ?? null,
      top: topPiece(w),
      side: 1,
      took: took && { at: took.at, pieceId: took.pieceId },
      brought: null,
    });
    // Gone: the piece it took is next to place again.
    if (magpie && magpie.takesAt === null && (!took || now >= took.at + BIRD_FLY_MS)) {
      if (took) {
        looks.delete(took.pieceId);
        words.delete(took.pieceId);
        queue.unshift(took.piece);
      }
      magpie = null;
    }
    return birds;
  }

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
        insetTop: HUD_INSET.top * uiScale(),
        insetBottom: HUD_INSET.bottom * uiScale(),
      }),
      dt,
    );
    if (!life || lifeWidth !== platformWidth) {
      life = createTowerLife(8, platformWidth);
      lifeWidth = platformWidth;
    }
    const bodies = world.bodies();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const cue of updateTowerLife(life, bodies, looks, dt, still)) {
      const half = size.width / 2 / camera.ppu;
      playVillageCue(cue, { pan: ((cue.x - camera.centerX) / half) * 0.6 });
    }
    const now = performance.now();
    const pigeons = pigeonFlights(world.pigeons(), now);
    const magpies = magpieBirds(now, world);
    drawTower(ctx, size, dpr, camera, {
      bodies,
      looks,
      platformWidth,
      platformThickness: world.tuning.platformThickness,
      line,
      height,
      topping,
      insetTop: HUD_INSET.top * uiScale(),
      showColliders,
      fog,
      birds: [...pigeons, ...magpies],
      star: star && {
        x: star.x,
        y: star.y,
        radius: STAR_TUNING.radius,
        hold:
          star.holdSince === null ? 0 : Math.min(1, (simMs - star.holdSince) / STAR_TUNING.holdMs),
      },
      time: performance.now() / 1000,
      seed: 1,
      life,
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

    setFog(thickness: number): void {
      if (thickness > 0 && fog === 0) playGameCue('fog');
      fog = thickness;
    },

    /**
     * Lands the Pigeon spell's pigeons on the edges of the tower's top pieces, one per piece,
     * alternating sides (starting on one side, then the other).
     */
    landPigeons(): void {
      const sides = Array.from({ length: SPELL_TUNING.pigeons }, (_, i) =>
        i % 2 === 0 ? pigeonSide : (-pigeonSide as 1 | -1),
      );
      world?.landPigeons(sides);
      playGameCue('pigeon');
      pigeonSide = pigeonSide === 1 ? -1 : 1;
    },

    /** Sends a magpie to fly off with the tower's top piece (it comes back to the queue). */
    sendMagpie(): void {
      if (magpie) return;
      magpie = { takesAt: performance.now() + BIRD_FLY_MS, took: null };
      playGameCue('magpie');
    },

    /** Puts a sky star by the tower (on the right), or takes it away. */
    setStar(on: boolean): void {
      if (!world) return;
      if (on && !star) placeStar(world, 1);
      if (!on) {
        star = null;
        world.clearStar();
      }
      publish();
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
      starsCaught = 0;
      // A star stays, back down by the empty platform.
      if (star && world) placeStar(world, 1);
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
