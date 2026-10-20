import RAPIER from '@dimforge/rapier2d-deterministic-compat';

/**
 * One tower's physics world (docs/tower/technical/physics.md). Rapier's deterministic build, a
 * fixed 60 Hz step, y up, the platform's top at y = 0 and centred on x = 0.
 *
 * The piece being placed is a dynamic body with gravity off, steered by setting its velocity
 * towards the placer's target every step. Unlike a kinematic body, it can't shove the tower with
 * infinite force, and it reports contacts like any other body. When it touches anything, or the
 * placer drops it, it's released: gravity on, and from then on it's an ordinary piece.
 */

export type Rapier = typeof RAPIER;

/** Loads Rapier's WebAssembly (inlined in the package). Call once before creating worlds. */
export async function loadPhysics(): Promise<void> {
  await RAPIER.init();
}

export const STEP_SECONDS = 1 / 60;

export type PhysicsTuning = {
  gravity: number;
  platformWidth: number;
  /** The platform is a slab this thick, its top at y = 0. */
  platformThickness: number;
  friction: number;
  restitution: number;
  density: number;
  linearDamping: number;
  angularDamping: number;
  /** How fast a piece being placed lowers on its own, and with ↓ held (units/s). */
  lowerSpeed: number;
  fastLowerSpeed: number;
  /** The fastest a piece being placed follows the placer sideways (units/s) and turns (rad/s). */
  steerSpeed: number;
  turnSpeed: number;
  /** How far beyond the platform's edges the placer may move a piece. */
  reach: number;
  /** A piece whose centre falls this far under the platform's top is a fumble. */
  killDepth: number;
  /** Below these speeds a released piece counts as settled. */
  settleSpeed: number;
  settleSpin: number;
};

export const DEFAULT_TUNING: PhysicsTuning = {
  gravity: 9.81,
  platformWidth: 6,
  platformThickness: 0.35,
  friction: 0.8,
  restitution: 0.05,
  density: 1,
  linearDamping: 0.05,
  angularDamping: 0.3,
  lowerSpeed: 0.8,
  fastLowerSpeed: 5,
  steerSpeed: 6,
  turnSpeed: 6,
  reach: 1.5,
  killDepth: 2,
  settleSpeed: 0.05,
  settleSpin: 0.05,
};

/** A piece's shape in world units, centred on its centroid: flat `[x0, y0, …]` polygons. */
export type PieceGeometry = { outline: number[]; parts: number[][] };

export type PieceId = number;

export type BodyState = {
  id: PieceId;
  x: number;
  y: number;
  angle: number;
  /** Still being placed. */
  active: boolean;
  settled: boolean;
};

export type StepEvents = {
  /**
   * The piece being placed was let go: it touched something during this step, or the placer
   * dropped it since the last step.
   */
  released: { id: PieceId; reason: 'touched' | 'dropped' } | null;
  /** Pieces that fell off this step. They're already removed from the world. */
  fumbled: PieceId[];
};

type Entry = {
  id: PieceId;
  body: RAPIER.RigidBody;
  geometry: PieceGeometry;
  colliders: RAPIER.Collider[];
};

export type TowerWorld = ReturnType<typeof createTowerWorld>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The smallest signed angle from `from` to `to`. */
function angleDelta(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createTowerWorld(initial: Partial<PhysicsTuning> = {}) {
  let tuning: PhysicsTuning = { ...DEFAULT_TUNING, ...initial };
  const world = new RAPIER.World({ x: 0, y: -tuning.gravity });
  world.timestep = STEP_SECONDS;
  const events = new RAPIER.EventQueue(true);

  const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const createPlatform = () => {
    platformBody.setTranslation({ x: 0, y: -tuning.platformThickness / 2 }, false);
    return world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        tuning.platformWidth / 2,
        tuning.platformThickness / 2,
      ).setFriction(tuning.friction),
      platformBody,
    );
  };
  let platform = createPlatform();

  const entries = new Map<PieceId, Entry>();
  const byCollider = new Map<number, Entry>();
  let nextId = 1;
  let active: { entry: Entry; targetX: number; targetAngle: number; fast: boolean } | null = null;
  let dropped: PieceId | null = null;
  let tick = 0;

  const release = () => {
    if (!active) return null;
    const { body, id } = active.entry;
    body.setGravityScale(1, true);
    // Drop straight down from where it is: no sideways fling or spin from the steering.
    body.setLinvel({ x: 0, y: Math.min(0, body.linvel().y) }, true);
    body.setAngvel(0, true);
    active = null;
    return id;
  };

  const isSettled = (body: RAPIER.RigidBody) => {
    if (body.isSleeping()) return true;
    const v = body.linvel();
    return Math.hypot(v.x, v.y) < tuning.settleSpeed && Math.abs(body.angvel()) < tuning.settleSpin;
  };

  /** The highest point of a piece's outline, in world units. */
  const topOf = (entry: Entry) => {
    const { y } = entry.body.translation();
    const angle = entry.body.rotation();
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    let top = -Infinity;
    const o = entry.geometry.outline;
    for (let i = 0; i + 1 < o.length; i += 2) {
      top = Math.max(top, y + sin * (o[i] as number) + cos * (o[i + 1] as number));
    }
    return top;
  };

  /** True when the two colliders are actually touching, not just overlapping bounding boxes. */
  const touching = (a: RAPIER.Collider, b: RAPIER.Collider) => {
    let found = false;
    world.contactPair(a, b, (manifold) => {
      if (manifold.numContacts() > 0) found = true;
    });
    return found;
  };

  return {
    /**
     * Spawns a piece to be placed, at (x, y). Fails (null) while another one is being placed.
     * `id` lets the caller choose the piece's id (the match owns ids); otherwise the next free one.
     */
    spawn(geometry: PieceGeometry, x: number, y: number, angle = 0, id?: PieceId): PieceId | null {
      if (active) return null;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, y)
          .setRotation(angle)
          .setGravityScale(0)
          .setLinearDamping(tuning.linearDamping)
          .setAngularDamping(tuning.angularDamping)
          .setCcdEnabled(true),
      );
      const colliders: RAPIER.Collider[] = [];
      for (const part of geometry.parts) {
        const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(part));
        if (!desc) continue;
        desc
          .setFriction(tuning.friction)
          .setRestitution(tuning.restitution)
          .setDensity(tuning.density)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        colliders.push(world.createCollider(desc, body));
      }
      if (!colliders.length) {
        world.removeRigidBody(body);
        return null;
      }
      const entry: Entry = { id: id ?? nextId++, body, geometry, colliders };
      nextId = Math.max(nextId, entry.id + 1);
      entries.set(entry.id, entry);
      for (const c of colliders) byCollider.set(c.handle, entry);
      active = { entry, targetX: x, targetAngle: angle, fast: false };
      return entry.id;
    },

    /** Where the placer wants the piece: x is clamped to the platform's reach. */
    steer(target: { x?: number; angle?: number; fast?: boolean }): void {
      if (!active) return;
      const limit = tuning.platformWidth / 2 + tuning.reach;
      if (target.x !== undefined) active.targetX = clamp(target.x, -limit, limit);
      if (target.angle !== undefined) active.targetAngle = target.angle;
      if (target.fast !== undefined) active.fast = target.fast;
    },

    /** The placer drops the piece now (or its time ran out). Returns its id. */
    drop(): PieceId | null {
      const id = release();
      if (id !== null) dropped = id;
      return id;
    },

    step(): StepEvents {
      if (active) {
        const { body } = active.entry;
        const { x } = body.translation();
        const vx = clamp((active.targetX - x) * 10, -tuning.steerSpeed, tuning.steerSpeed);
        const spin = clamp(
          angleDelta(body.rotation(), active.targetAngle) * 10,
          -tuning.turnSpeed,
          tuning.turnSpeed,
        );
        const down = active.fast ? tuning.fastLowerSpeed : tuning.lowerSpeed;
        body.setLinvel({ x: vx, y: -down }, true);
        body.setAngvel(spin, true);
      }

      world.step(events);
      tick += 1;

      let released: StepEvents['released'] =
        dropped !== null ? { id: dropped, reason: 'dropped' } : null;
      dropped = null;
      events.drainCollisionEvents((h1, h2, started) => {
        if (!started || !active) return;
        const a = byCollider.get(h1);
        const b = byCollider.get(h2);
        if (a !== active.entry && b !== active.entry) return;
        const id = release();
        if (id !== null) released = { id, reason: 'touched' };
      });

      const fumbled: PieceId[] = [];
      for (const entry of entries.values()) {
        if (entry.body.translation().y > -tuning.killDepth) continue;
        if (active?.entry === entry) active = null;
        for (const c of entry.colliders) byCollider.delete(c.handle);
        world.removeRigidBody(entry.body);
        entries.delete(entry.id);
        fumbled.push(entry.id);
      }
      return { released, fumbled };
    },

    /**
     * The tower's height: the highest point of any settled piece that stands on the platform
     * through a chain of touching pieces. The piece being placed never counts, and neither does
     * anything resting on it.
     */
    height(): number {
      const seen = new Set<Entry>();
      const queue: RAPIER.Collider[] = [platform];
      let height = 0;
      while (queue.length) {
        const collider = queue.pop() as RAPIER.Collider;
        world.contactPairsWith(collider, (other) => {
          const entry = byCollider.get(other.handle);
          if (!entry || seen.has(entry) || entry === active?.entry) return;
          if (!touching(collider, other)) return;
          seen.add(entry);
          if (isSettled(entry.body)) height = Math.max(height, topOf(entry));
          queue.push(...entry.colliders);
        });
      }
      return height;
    },

    /** The highest point of every piece, settled or not (for where to spawn the next one). */
    top(): number {
      let top = 0;
      for (const entry of entries.values()) {
        if (entry !== active?.entry) top = Math.max(top, topOf(entry));
      }
      return top;
    },

    /**
     * Spawns a piece above everything on the tower: `gap` over its top, plus the piece's own
     * radius, centred over the platform.
     */
    spawnAbove(geometry: PieceGeometry, gap: number, id?: PieceId): PieceId | null {
      let radius = 0;
      const o = geometry.outline;
      for (let i = 0; i + 1 < o.length; i += 2) {
        radius = Math.max(radius, Math.hypot(o[i] as number, o[i + 1] as number));
      }
      return this.spawn(geometry, 0, this.top() + gap + radius, 0, id);
    },

    /**
     * The bodies for a network frame, flat `[id, x, y, angle, …]` in millimetres and
     * milliradians. `movingOnly` leaves out bodies that are asleep (they haven't moved since the
     * last frame that had them).
     */
    frame(movingOnly: boolean): number[] {
      const out: number[] = [];
      for (const entry of entries.values()) {
        if (movingOnly && entry.body.isSleeping()) continue;
        const { x, y } = entry.body.translation();
        out.push(
          entry.id,
          Math.round(x * 1000),
          Math.round(y * 1000),
          Math.round(entry.body.rotation() * 1000),
        );
      }
      return out;
    },

    bodies(): BodyState[] {
      return [...entries.values()].map((entry) => {
        const { x, y } = entry.body.translation();
        return {
          id: entry.id,
          x,
          y,
          angle: entry.body.rotation(),
          active: entry === active?.entry,
          settled: isSettled(entry.body),
        };
      });
    },

    geometry(id: PieceId): PieceGeometry | null {
      return entries.get(id)?.geometry ?? null;
    },

    get active(): PieceId | null {
      return active?.entry.id ?? null;
    },

    /** Where the placer is steering the active piece. */
    get target(): { x: number; angle: number } | null {
      return active ? { x: active.targetX, angle: active.targetAngle } : null;
    },

    get tick(): number {
      return tick;
    },

    get tuning(): PhysicsTuning {
      return tuning;
    },

    /** Changes tuning live. Friction and restitution apply to existing pieces too. */
    retune(patch: Partial<PhysicsTuning>): void {
      tuning = { ...tuning, ...patch };
      world.gravity = { x: 0, y: -tuning.gravity };
      for (const entry of entries.values()) {
        for (const c of entry.colliders) {
          c.setFriction(tuning.friction);
          c.setRestitution(tuning.restitution);
        }
        entry.body.setLinearDamping(tuning.linearDamping);
        entry.body.setAngularDamping(tuning.angularDamping);
        entry.body.wakeUp();
      }
      if (
        patch.platformWidth !== undefined ||
        patch.platformThickness !== undefined ||
        patch.friction !== undefined
      ) {
        world.removeCollider(platform, false);
        platform = createPlatform();
      }
    },

    /** Removes every piece. */
    clear(): void {
      for (const entry of entries.values()) world.removeRigidBody(entry.body);
      entries.clear();
      byCollider.clear();
      active = null;
      dropped = null;
    },

    /** The whole world's state, for reconnects and tests. */
    snapshot(): Uint8Array {
      return world.takeSnapshot();
    },

    free(): void {
      events.free();
      world.free();
    },
  };
}
