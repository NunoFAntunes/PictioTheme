import type { PlayerId } from '@pictiotheme/protocol';
import type { Team } from '@pictiotheme/protocol/tower';
import type { Stand } from './ledges';

/**
 * The crews' avatars in motion (docs/tower/design/screens.md#the-crews-on-stage). Fed where
 * everyone should be every frame, it says where they are: someone whose place changes crouches,
 * hops and flies there on an arc (when a round is solved, several take off at once, a beat apart,
 * and the ones that collide in the air bonk and spin), squashes as they land, and bobs a little
 * while they wait. Pure: plain functions of the targets and the time it's given.
 */

export type Target = {
  playerId: PlayerId;
  team: Team;
  /** The anchor they're on and their slot there: a change of either is a move. */
  anchor: string;
  slot: number;
  stand: Stand;
  cloud: boolean;
  asleep: boolean;
  /** Keep still: you, placing (nothing should move under your eyes for those 15s). */
  calm: boolean;
};

export type Pose = {
  playerId: PlayerId;
  team: Team;
  x: number;
  /** Where their feet are. */
  y: number;
  size: number;
  /** Radians, round their middle. */
  angle: number;
  /** Squash and stretch, round their feet. */
  scaleX: number;
  scaleY: number;
  alpha: number;
  asleep: boolean;
  flying: boolean;
};

/** A cloud a placer stands on: coming in under them as they arrive, drifting off when they go. */
export type CloudPose = { x: number; y: number; size: number; alpha: number };

/** Something to draw for a moment: stars where two bonked, dust where one took off. */
export type Effect = { kind: 'stars' | 'dust'; x: number; y: number; size: number; at: number };

export type TroupeCue = {
  kind: 'hop' | 'land' | 'bonk';
  team: Team;
  x: number;
  /** Theirs, from their id (about 0.85–1.25), so a crowd doesn't sound like one voice. */
  pitch: number;
  /** Landing on a cloud: a soft one. */
  soft?: boolean;
};

export type TroupeFrame = {
  poses: Pose[];
  clouds: CloudPose[];
  effects: Effect[];
  cues: TroupeCue[];
};

type Point = { x: number; y: number; size: number };

type Flight = {
  from: Point;
  /** When it leaves (after a crouch), and how long it's in the air. */
  startAt: number;
  duration: number;
  /** How high the arc rises over the straight line, px. */
  arc: number;
  /** A little roll in the air, radians at the top of the arc. */
  roll: number;
  /** A short hop along the same ledge, rather than a flight. */
  hop: boolean;
  /** When it bonked into someone (it spins from then), and which way. */
  bonkedAt: number | null;
  bonkSpin: number;
  tookOff: boolean;
};

type Actor = {
  team: Team;
  key: string;
  /** Where it was last drawn. */
  at: Point;
  wasCloud: boolean;
  flight: Flight | null;
  landedAt: number | null;
  shownAt: number;
  visible: boolean;
  seed: number;
};

/** How long a crouch before take-off can be, at most, and the beat between crowded take-offs. */
const CROUCH_MS = 160;
const STAGGER_MS = 80;
const POP_IN_MS = 240;
const SQUASH_MS = 320;
const CLOUD_FADE_MS = 450;
const EFFECT_MS = { stars: 520, dust: 360 } as const;
/** Two flyers closer than this share of their sizes bonk. */
const BONK_REACH = 0.42;

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
  return h >>> 0;
}

/** 0–1, steady for a player. */
const unit = (seed: number, salt: number) =>
  (((seed ^ Math.imul(salt, 2654435761)) >>> 0) % 1000) / 1000;

const pitchOf = (seed: number) => 0.85 + unit(seed, 1) * 0.4;

/** Slow in, slow out. */
const smooth = (p: number) => p * p * (3 - 2 * p);

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export function createTroupe({ still = false }: { still?: boolean } = {}) {
  const actors = new Map<PlayerId, Actor>();
  const leaving: (CloudPose & { at: number })[] = [];
  let effects: Effect[] = [];

  /** Where a flight is at `now`, towards `to` (which may be moving). */
  function along(f: Flight, to: Point, now: number) {
    const p = Math.min(1, Math.max(0, (now - f.startAt) / f.duration));
    const e = smooth(p);
    const mx = (f.from.x + to.x) / 2;
    const my = Math.min(f.from.y, to.y) - f.arc;
    // A quadratic Bézier through a point above the middle.
    const x = (1 - e) ** 2 * f.from.x + 2 * (1 - e) * e * mx + e * e * to.x;
    const y = (1 - e) ** 2 * f.from.y + 2 * (1 - e) * e * my + e * e * to.y;
    return { p, x, y, size: lerp(f.from.size, to.size, e) };
  }

  function startFlight(actor: Actor, to: Point, now: number, delay: number, hop: boolean): void {
    const dist = Math.hypot(to.x - actor.at.x, to.y - actor.at.y);
    const airborne = actor.flight !== null && actor.flight.tookOff && now >= actor.flight.startAt;
    const waiting = actor.flight !== null && !actor.flight.tookOff;
    const s = actor.seed;
    actor.flight = {
      from: { ...actor.at },
      // Already in the air (or about to go): carry on towards the new place, no second hop.
      startAt: airborne ? now : waiting && actor.flight ? actor.flight.startAt : now + delay,
      duration: hop ? 300 : Math.min(1100, 520 + dist * 0.55),
      arc: hop ? 18 : Math.min(170, Math.max(50, dist * 0.32)) * (0.8 + unit(s, 2) * 0.4),
      roll: (unit(s, 3) - 0.5) * (hop ? 0.2 : 0.7),
      hop,
      bonkedAt: actor.flight?.bonkedAt ?? null,
      bonkSpin: actor.flight?.bonkSpin ?? 0,
      tookOff: airborne,
    };
    actor.landedAt = null;
  }

  function update(targets: readonly Target[], now: number): TroupeFrame {
    const cues: TroupeCue[] = [];
    const seen = new Set<PlayerId>();
    let crowd = 0;

    // ── Who's going where ──
    for (const t of targets) {
      seen.add(t.playerId);
      const key = `${t.anchor}#${t.slot}`;
      const to: Point = { x: t.stand.x, y: t.stand.y, size: t.stand.size };
      let actor = actors.get(t.playerId);
      if (!actor) {
        actor = {
          team: t.team,
          key,
          at: to,
          wasCloud: t.cloud,
          flight: null,
          landedAt: null,
          shownAt: now,
          visible: true,
          seed: hash(t.playerId),
        };
        actors.set(t.playerId, actor);
        continue;
      }
      actor.team = t.team;
      const moved = actor.key !== key;
      const sameAnchor = actor.key.split('#')[0] === t.anchor;
      if (!actor.visible) {
        actor.visible = true;
        actor.shownAt = now;
        // Back where they were (the decide card went away): they pop back in.
        if (!moved || still) {
          actor.key = key;
          actor.at = to;
          actor.flight = null;
          actor.shownAt = now;
          continue;
        }
      }
      if (moved) {
        if (actor.wasCloud && !t.cloud) {
          leaving.push({ x: actor.at.x, y: actor.at.y, size: actor.at.size, alpha: 1, at: now });
        }
        actor.key = key;
        if (still) {
          actor.at = to;
          actor.flight = null;
        } else {
          const delay = Math.min(CROUCH_MS, 60 + unit(actor.seed, 4) * 100) + crowd * STAGGER_MS;
          if (!sameAnchor) crowd++;
          startFlight(actor, to, now, delay, sameAnchor);
        }
      }
      actor.wasCloud = t.cloud;
    }
    for (const [id, actor] of actors) {
      if (!seen.has(id)) {
        actor.visible = false;
        actor.flight = null;
      }
    }

    // ── Where everyone is now ──
    const poses: Pose[] = [];
    const clouds: CloudPose[] = [];
    const flying: { actor: Actor; pose: Pose }[] = [];
    for (const t of targets) {
      const actor = actors.get(t.playerId);
      if (!actor) continue;
      const to: Point = { x: t.stand.x, y: t.stand.y, size: t.stand.size };
      const pitch = pitchOf(actor.seed);
      let pose: Pose;
      const f = actor.flight;
      if (f && now < f.startAt) {
        // The crouch before the jump.
        const c = Math.min(1, (now - (f.startAt - CROUCH_MS)) / CROUCH_MS);
        const squash = 0.16 * Math.max(0, c);
        pose = base(t, actor.at, { scaleX: 1 + squash * 0.6, scaleY: 1 - squash });
      } else if (f) {
        if (!f.tookOff) {
          f.tookOff = true;
          cues.push({ kind: 'hop', team: t.team, x: actor.at.x, pitch });
          if (!f.hop)
            effects.push({ kind: 'dust', x: f.from.x, y: f.from.y, size: f.from.size, at: now });
        }
        const a = along(f, to, now);
        const lift = Math.sin(Math.PI * a.p);
        const spin =
          f.bonkedAt === null
            ? 0
            : f.bonkSpin * Math.min(1, (now - f.bonkedAt) / 450) * Math.PI * 2;
        // Stretched on the way up, round at the top.
        const stretch = f.hop ? 0 : 0.14 * (1 - a.p) * (a.p < 0.5 ? 1 : 0);
        pose = base(t, a, {
          angle: f.roll * lift + spin,
          scaleX: 1 - stretch * 0.5,
          scaleY: 1 + stretch,
        });
        pose.flying = !f.hop;
        actor.at = { x: a.x, y: a.y, size: a.size };
        if (a.p >= 1) {
          actor.flight = null;
          actor.landedAt = now;
          actor.at = to;
          cues.push({ kind: 'land', team: t.team, x: to.x, pitch, soft: t.cloud });
        } else if (!f.hop) flying.push({ actor, pose });
      } else {
        actor.at = to;
        const since = actor.landedAt === null ? Infinity : now - actor.landedAt;
        const wobble = since < SQUASH_MS ? 0.26 * Math.exp(-since / 90) * Math.cos(since / 38) : 0;
        // A little bob while they wait, each to their own beat; none for the calm or the asleep.
        const bob =
          t.calm || t.asleep || still ? 0 : Math.sin(now / 520 + unit(actor.seed, 5) * 6.3) * 1.2;
        pose = base(
          t,
          { x: to.x, y: to.y + bob, size: to.size },
          {
            scaleX: 1 + wobble * 0.7,
            scaleY: 1 - wobble,
          },
        );
      }
      // Popping in (first seen, or back from behind the decide card).
      const shown = now - actor.shownAt;
      if (shown < POP_IN_MS && !still) {
        const p = shown / POP_IN_MS;
        const grow = 1 + Math.sin(p * Math.PI) * 0.18;
        pose.alpha = p;
        pose.scaleX *= p * grow;
        pose.scaleY *= p * grow;
      }
      poses.push(pose);

      // The cloud under a placer: it comes in under them as they arrive.
      if (t.cloud) {
        const cf = actor.flight;
        const p = cf ? Math.max(0, (now - cf.startAt) / cf.duration) : 1;
        const alpha = still ? 1 : Math.min(1, Math.max(0, (p - 0.45) / 0.45));
        if (alpha > 0) {
          const bob = t.calm || still ? 0 : Math.sin(now / 700 + 1) * 1.5;
          clouds.push({ x: to.x, y: to.y + bob, size: to.size, alpha });
        }
      }
    }

    // ── Bonks: two flyers meeting in the air ──
    for (let i = 0; i < flying.length; i++) {
      for (let j = i + 1; j < flying.length; j++) {
        const a = flying[i];
        const b = flying[j];
        if (!a || !b) continue;
        const fa = a.actor.flight;
        const fb = b.actor.flight;
        if (!fa || !fb || fa.bonkedAt !== null || fb.bonkedAt !== null) continue;
        const pa = (now - fa.startAt) / fa.duration;
        const pb = (now - fb.startAt) / fb.duration;
        if (pa < 0.12 || pa > 0.88 || pb < 0.12 || pb > 0.88) continue;
        // Their middles, not their feet.
        const ay = a.pose.y - a.pose.size / 2;
        const by = b.pose.y - b.pose.size / 2;
        if (Math.hypot(a.pose.x - b.pose.x, ay - by) > (a.pose.size + b.pose.size) * BONK_REACH)
          continue;
        const side = a.pose.x < b.pose.x ? -1 : 1;
        fa.bonkedAt = now;
        fa.bonkSpin = side;
        fb.bonkedAt = now;
        fb.bonkSpin = -side;
        const x = (a.pose.x + b.pose.x) / 2;
        effects.push({
          kind: 'stars',
          x,
          y: (ay + by) / 2,
          size: (a.pose.size + b.pose.size) / 2,
          at: now,
        });
        cues.push({ kind: 'bonk', team: a.actor.team, x, pitch: pitchOf(a.actor.seed) });
      }
    }

    // Clouds left behind drift up and fade.
    for (let i = leaving.length - 1; i >= 0; i--) {
      const c = leaving[i];
      if (!c) continue;
      const p = (now - c.at) / CLOUD_FADE_MS;
      if (p >= 1 || still) {
        leaving.splice(i, 1);
        continue;
      }
      clouds.push({ x: c.x, y: c.y - p * 14, size: c.size, alpha: 1 - p });
    }
    effects = effects.filter((e) => now - e.at < EFFECT_MS[e.kind]);

    // Flyers on top of everyone standing.
    poses.sort((a, b) => Number(a.flying) - Number(b.flying));
    return { poses, clouds, effects: [...effects], cues: still ? [] : cues };
  }

  return { update };
}

function base(
  t: Target,
  at: { x: number; y: number; size: number },
  shape: { angle?: number; scaleX?: number; scaleY?: number },
): Pose {
  return {
    playerId: t.playerId,
    team: t.team,
    x: at.x,
    y: at.y,
    size: at.size,
    angle: shape.angle ?? 0,
    scaleX: shape.scaleX ?? 1,
    scaleY: shape.scaleY ?? 1,
    alpha: 1,
    asleep: t.asleep,
    flying: false,
  };
}

/** How far through its life an effect is, 0–1. */
export function effectProgress(e: Effect, now: number): number {
  return Math.min(1, (now - e.at) / EFFECT_MS[e.kind]);
}
