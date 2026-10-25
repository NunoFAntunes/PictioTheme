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

/**
 * How one piece differs from the tuning (a cursed piece, docs/tower/planning/power-ups.md).
 * `friction` wins over whatever it touches (the lower friction of the two counts), so a slippery
 * piece slides on a grippy tower. `lowerScale` multiplies how fast it lowers while it's placed.
 * `restitution` wins too (the bouncier of the two counts), until `bouncyMs` after it's released;
 * then it's as bouncy as any piece.
 */
export type PieceMaterial = {
  friction?: number;
  lowerScale?: number;
  restitution?: number;
  bouncyMs?: number;
};

/**
 * The Pigeon spell (docs/tower/planning/power-ups.md): small, light, grippy balls that land on
 * the outer edges of the tower's top pieces, one per piece, tipping them. They aren't pieces: they
 * never count for the height and never fumble. In network frames they're the bodies `PIGEON_IDS`.
 */
export const PIGEON = {
  radius: 0.23,
  /**
   * A bit more than a piece (pieces are about 2 m² at density 1). At 0.4 they hardly mattered;
   * a sweep over random towers put 1.6 at about twice the tumbles of 0.4, short of sure collapse.
   * When pieces grew from 1.2 m² to 2 m², the pigeons grew with them (from 1.6 kg and 0.18 m):
   * the same sweep with the bigger pieces gives about the same tumbles as before.
   */
  mass: 2.7,
  friction: 1.5,
} as const;
/** The pigeons' ids in network frames: negative, so they never clash with a piece's. */
export const PIGEON_IDS = [-1, -2, -3] as const;
export const isPigeonId = (id: number) => id < 0;

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
  /**
   * A pigeon left this step: a new piece touched it, or it fell. It's already gone; `pigeons()`
   * says whether any are left.
   */
  pigeon: 'scared' | 'fell' | null;
};

type Entry = {
  id: PieceId;
  body: RAPIER.RigidBody;
  geometry: PieceGeometry;
  colliders: RAPIER.Collider[];
  material: PieceMaterial;
  /** Its own bounce still holds: until the step `bouncyUntil` once it's released. */
  bouncy: boolean;
  bouncyUntil: number | null;
  /** The step it was released at (null while it's being placed). */
  releasedAt: number | null;
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
  /** A sky star: a sensor that pieces pass through (docs/tower/planning/power-ups.md). */
  let star: RAPIER.Collider | null = null;
  /** The pigeons, and the step they landed at: pieces released after that scare them away. */
  type Pigeon = { id: number; body: RAPIER.RigidBody; collider: RAPIER.Collider };
  let pigeons: Pigeon[] = [];
  let pigeonsLandedAt = 0;
  const removePigeon = (gone: Pigeon) => {
    world.removeRigidBody(gone.body);
    pigeons = pigeons.filter((p) => p !== gone);
  };
  const removePigeons = () => {
    for (const p of pigeons) world.removeRigidBody(p.body);
    pigeons = [];
  };

  const release = () => {
    if (!active) return null;
    const { body, id, material } = active.entry;
    active.entry.releasedAt = tick;
    if (material.bouncyMs !== undefined) {
      active.entry.bouncyUntil = tick + Math.ceil(material.bouncyMs / 1000 / STEP_SECONDS);
    }
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

  /** A piece's outline in world space. */
  const worldOutline = (entry: Entry): [number, number][] => {
    const { x, y } = entry.body.translation();
    const angle = entry.body.rotation();
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const o = entry.geometry.outline;
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < o.length; i += 2) {
      const px = o[i] as number;
      const py = o[i + 1] as number;
      out.push([x + cos * px - sin * py, y + sin * px + cos * py]);
    }
    return out;
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

  const applyFriction = (collider: RAPIER.Collider, material: PieceMaterial) => {
    if (material.friction === undefined) {
      collider.setFriction(tuning.friction);
      collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average);
    } else {
      collider.setFriction(material.friction);
      collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    }
  };

  const applyRestitution = (collider: RAPIER.Collider, entry: Entry) => {
    if (entry.bouncy && entry.material.restitution !== undefined) {
      collider.setRestitution(entry.material.restitution);
      collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);
    } else {
      collider.setRestitution(tuning.restitution);
      collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average);
    }
  };

  /**
   * The settled pieces standing on the platform through a chain of touching pieces: what counts
   * for the height. The piece being placed never counts, and neither does anything resting on it.
   */
  const standing = (): Entry[] => {
    const seen = new Set<Entry>();
    const out: Entry[] = [];
    const queue: RAPIER.Collider[] = [platform];
    while (queue.length) {
      const collider = queue.pop() as RAPIER.Collider;
      world.contactPairsWith(collider, (other) => {
        const entry = byCollider.get(other.handle);
        if (!entry || seen.has(entry) || entry === active?.entry) return;
        if (!touching(collider, other)) return;
        seen.add(entry);
        if (isSettled(entry.body)) out.push(entry);
        queue.push(...entry.colliders);
      });
    }
    return out;
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
    spawn(
      geometry: PieceGeometry,
      x: number,
      y: number,
      angle = 0,
      id?: PieceId,
      material: PieceMaterial = {},
    ): PieceId | null {
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
        desc.setDensity(tuning.density).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        colliders.push(world.createCollider(desc, body));
      }
      if (!colliders.length) {
        world.removeRigidBody(body);
        return null;
      }
      const entry: Entry = {
        id: id ?? nextId++,
        body,
        geometry,
        colliders,
        material,
        bouncy: material.restitution !== undefined,
        bouncyUntil: null,
        releasedAt: null,
      };
      for (const c of colliders) {
        applyFriction(c, material);
        applyRestitution(c, entry);
      }
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
        const down =
          (active.fast ? tuning.fastLowerSpeed : tuning.lowerSpeed) *
          (active.entry.material.lowerScale ?? 1);
        body.setLinvel({ x: vx, y: -down }, true);
        body.setAngvel(spin, true);
      }

      world.step(events);
      tick += 1;
      for (const entry of entries.values()) {
        if (entry.bouncyUntil === null || tick < entry.bouncyUntil) continue;
        entry.bouncy = false;
        entry.bouncyUntil = null;
        for (const c of entry.colliders) applyRestitution(c, entry);
      }

      let released: StepEvents['released'] =
        dropped !== null ? { id: dropped, reason: 'dropped' } : null;
      dropped = null;
      let pigeonLeft: StepEvents['pigeon'] = null;
      events.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        // A new piece (being placed, or placed since they landed) touching a pigeon scares it
        // away; the tower it's perched on doesn't.
        const pigeon = pigeons.find((p) => h1 === p.collider.handle || h2 === p.collider.handle);
        if (pigeon) {
          const other = byCollider.get(h1 === pigeon.collider.handle ? h2 : h1);
          const fresh =
            other !== undefined &&
            (other === active?.entry ||
              (other.releasedAt !== null && other.releasedAt > pigeonsLandedAt));
          if (fresh) {
            removePigeon(pigeon);
            pigeonLeft = 'scared';
          }
        }
        if (!active) return;
        // Passing through a star isn't touching anything.
        if (star && (h1 === star.handle || h2 === star.handle)) return;
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
      for (const pigeon of pigeons) {
        if (pigeon.body.translation().y > -tuning.killDepth) continue;
        removePigeon(pigeon);
        pigeonLeft = 'fell';
      }
      return { released, fumbled, pigeon: pigeonLeft };
    },

    /**
     * The tower's height: the highest point of any settled piece that stands on the platform
     * through a chain of touching pieces. The piece being placed never counts, and neither does
     * anything resting on it.
     */
    height(): number {
      let height = 0;
      for (const entry of standing()) height = Math.max(height, topOf(entry));
      return height;
    },

    /**
     * Lands a pigeon for each of `sides` (−1 left, 1 right), each on the outer edge of a different
     * piece of the tower, the top ones first: on the highest free point of that piece's outer
     * quarter on its side (or the other side, if that one's covered). Once every piece has one,
     * the rest land on the platform's edges.
     */
    landPigeons(sides: readonly (1 | -1)[]): void {
      removePigeons();
      pigeonsLandedAt = tick;
      const ball = new RAPIER.Ball(PIGEON.radius);
      const lift = PIGEON.radius + 0.05;
      const free = (x: number, y: number, host?: RAPIER.RigidBody) =>
        // Colliders made this step aren't in the query pipeline yet: check the other pigeons too.
        !pigeons.some((p) => {
          const at = p.body.translation();
          return Math.hypot(at.x - x, at.y - y) < PIGEON.radius * 2;
        }) &&
        world.intersectionWithShape(
          { x, y },
          0,
          ball,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          undefined,
          undefined,
          host,
        ) === null;
      /** The highest free perch on a piece's outer quarter on `side`. */
      const perchOn = (entry: Entry, side: 1 | -1) => {
        const pts = worldOutline(entry);
        const xs = pts.map((p) => p[0]);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const from = side > 0 ? right - (right - left) / 4 : left;
        const to = side > 0 ? right : left + (right - left) / 4;
        const edge = pts.filter(([px]) => px >= from && px <= to).sort((a, b) => b[1] - a[1]);
        for (const [px, py] of edge) {
          // A step in from the very edge, so it perches rather than slips off.
          const x = px - side * PIGEON.radius;
          const y = py + lift;
          if (free(x, y, entry.body)) return { x, y };
        }
        return null;
      };
      const pieces = standing().sort((a, b) => topOf(b) - topOf(a));
      const used = new Set<Entry>();
      for (const [i, side] of sides.entries()) {
        let at: { x: number; y: number } | null = null;
        for (const entry of pieces) {
          if (used.has(entry)) continue;
          at = perchOn(entry, side) ?? perchOn(entry, side === 1 ? -1 : 1);
          if (at) {
            used.add(entry);
            break;
          }
        }
        if (!at) {
          // On the platform, from its edge inwards.
          const edge = tuning.platformWidth / 2 - PIGEON.radius;
          for (let k = 0; k < 6 && !at; k++) {
            const x = side * (edge - k * PIGEON.radius * 2.5);
            if (free(x, lift)) at = { x, y: lift };
          }
        }
        if (!at) continue;
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(at.x, at.y)
            .setLinearDamping(0.5)
            // It grips with its feet: it doesn't roll.
            .lockRotations(),
        );
        const collider = world.createCollider(
          RAPIER.ColliderDesc.ball(PIGEON.radius)
            .setMass(PIGEON.mass)
            .setFriction(PIGEON.friction)
            .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
            .setRestitution(0)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
          body,
        );
        pigeons.push({ id: PIGEON_IDS[i] ?? -(i + 1), body, collider });
      }
    },

    /** The pigeons fly off. */
    clearPigeons(): void {
      removePigeons();
    },

    /** Where the pigeons are, by id. */
    pigeons(): { id: number; x: number; y: number }[] {
      return pigeons.map((p) => {
        const { x, y } = p.body.translation();
        return { id: p.id, x, y };
      });
    },

    /**
     * The Magpie spell: lifts the tower's topmost piece (the highest, not counting the one being
     * placed) out of the world, and returns its id (null with nothing to take). It isn't a fumble:
     * the piece just isn't here any more.
     */
    takeTop(): PieceId | null {
      let top: Entry | null = null;
      for (const entry of entries.values()) {
        if (entry !== active?.entry && (!top || topOf(entry) > topOf(top))) top = entry;
      }
      if (!top) return null;
      for (const c of top.colliders) byCollider.delete(c.handle);
      world.removeRigidBody(top.body);
      entries.delete(top.id);
      // What it held up has to notice it's gone.
      for (const entry of entries.values()) entry.body.wakeUp();
      for (const p of pigeons) p.body.wakeUp();
      return top.id;
    },

    /** Puts the sky star at (x, y), replacing any other. */
    setStar(x: number, y: number, radius: number): void {
      if (star) world.removeCollider(star, false);
      // On the platform's fixed body, which sits half its thickness down.
      const at = platformBody.translation();
      star = world.createCollider(
        RAPIER.ColliderDesc.ball(radius)
          .setTranslation(x - at.x, y - at.y)
          .setSensor(true),
        platformBody,
      );
    },

    clearStar(): void {
      if (star) world.removeCollider(star, false);
      star = null;
    },

    /** A settled piece of the tower (one that counts for its height) is touching the star. */
    starHeld(): boolean {
      if (!star) return false;
      const sensor = star;
      for (const entry of standing()) {
        if (entry.colliders.some((c) => world.intersectionPair(sensor, c))) return true;
      }
      return false;
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
    spawnAbove(
      geometry: PieceGeometry,
      gap: number,
      id?: PieceId,
      material: PieceMaterial = {},
    ): PieceId | null {
      let radius = 0;
      const o = geometry.outline;
      for (let i = 0; i + 1 < o.length; i += 2) {
        radius = Math.max(radius, Math.hypot(o[i] as number, o[i + 1] as number));
      }
      return this.spawn(geometry, 0, this.top() + gap + radius, 0, id, material);
    },

    /**
     * The bodies for a network frame, flat `[id, x, y, angle, …]` in millimetres and
     * milliradians. `movingOnly` leaves out bodies that are asleep (they haven't moved since the
     * last frame that had them).
     */
    frame(movingOnly: boolean): number[] {
      const out: number[] = [];
      // Pigeons are always in it, asleep or not: a pigeon missing from a frame has left.
      for (const pigeon of pigeons) {
        const { x, y } = pigeon.body.translation();
        out.push(pigeon.id, Math.round(x * 1000), Math.round(y * 1000), 0);
      }
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

    /** A piece's velocity (units/s), for tests and tuning. */
    velocity(id: PieceId): { x: number; y: number } | null {
      const v = entries.get(id)?.body.linvel();
      return v ? { x: v.x, y: v.y } : null;
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

    /**
     * Changes tuning live. Friction and restitution apply to existing pieces too (a piece's own
     * material still wins).
     */
    retune(patch: Partial<PhysicsTuning>): void {
      tuning = { ...tuning, ...patch };
      world.gravity = { x: 0, y: -tuning.gravity };
      for (const entry of entries.values()) {
        for (const c of entry.colliders) {
          applyFriction(c, entry.material);
          applyRestitution(c, entry);
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
      removePigeons();
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
