import type { PlayerId } from '@pictiotheme/protocol';
import type { Team } from '@pictiotheme/protocol/tower';
import type { Act } from './acts';
import type { Spot, SpotKey } from './show';
import type { Pose } from './troupe';

/**
 * How the crews' avatars react (docs/tower/design/screens.md#the-crews-on-stage): a happy hop
 * when their drawing is guessed, a startled jump with a "!" when it's stolen, a little rain cloud
 * over their tower when a piece falls off it, dizzy stars round their heads while they're
 * dazed, and bouncing in time while their tower tops out. Pure: the time, the poses and the
 * crews' state go in, the poses and what to draw over them come out.
 */

export type Mark =
  /** Stars circling a dazed avatar's head. */
  | { kind: 'dizzy'; x: number; y: number; size: number; phase: number }
  /** A startled "!" over an avatar's head. */
  | { kind: 'bang'; x: number; y: number; size: number; alpha: number };

/** A rain cloud pouring on a crew: `time` drives the drops. */
export type RainCloud = { x: number; y: number; width: number; alpha: number; time: number };

export type ReactionScene = {
  now: number;
  poses: readonly Pose[];
  spot: (key: SpotKey) => Spot | null;
  dazed: ReadonlySet<Team>;
  topping: ReadonlySet<Team>;
  /** You, placing: you don't react (nothing should move under your eyes for those 15s). */
  calm: PlayerId | null;
};

export type ReactionFrame = { poses: Pose[]; marks: Mark[]; rain: RainCloud[] };

type Reaction = { kind: 'cheer' | 'startle' | 'rain'; team: Team; at: number };

const CHEER_MS = 420;
const CHEER_STAGGER_MS = 70;
const STARTLE_MS = 320;
const BANG_MS = 900;
const RAIN_MS = 2600;
const BOUNCE_MS = 500;

const LASTS: Record<Reaction['kind'], number> = {
  cheer: CHEER_MS + CHEER_STAGGER_MS * 6,
  startle: BANG_MS,
  rain: RAIN_MS,
};

export function createReactions({ still = false }: { still?: boolean } = {}) {
  let reactions: Reaction[] = [];

  function add(acts: readonly Act[], now: number): void {
    if (still) return;
    for (const act of acts) {
      if (act.kind === 'cheer' || act.kind === 'startle' || act.kind === 'rain')
        reactions.push({ kind: act.kind, team: act.team, at: now });
    }
  }

  function frame({ now, poses, spot, dazed, topping, calm }: ReactionScene): ReactionFrame {
    reactions = reactions.filter((r) => now - r.at < LASTS[r.kind]);
    const out = poses.map((p) => ({ ...p }));
    const marks: Mark[] = [];
    const rain: RainCloud[] = [];
    if (still) return { poses: out, marks, rain };

    // Each crew's avatars in order, for the cheer's ripple.
    const order = new Map<PlayerId, number>();
    const counts = new Map<Team, number>();
    for (const p of out) {
      const n = counts.get(p.team) ?? 0;
      order.set(p.playerId, n);
      counts.set(p.team, n + 1);
    }

    for (const pose of out) {
      if (pose.playerId === calm || pose.asleep) continue;
      const i = order.get(pose.playerId) ?? 0;
      const { size } = pose;
      for (const r of reactions) {
        if (r.team !== pose.team) continue;
        const since = now - r.at;
        if (r.kind === 'cheer' && !pose.flying) {
          // A happy hop, rippling along the crew.
          const p = (since - i * CHEER_STAGGER_MS) / CHEER_MS;
          if (p > 0 && p < 1) {
            pose.y -= Math.sin(Math.PI * p) * size * 0.35;
            pose.scaleY *= 1 + 0.08 * Math.sin(Math.PI * p);
          }
        } else if (r.kind === 'startle') {
          const p = since / STARTLE_MS;
          if (p < 1 && !pose.flying) {
            pose.y -= Math.sin(Math.PI * p) * size * 0.2;
            pose.angle += Math.sin(since / 18) * 0.12 * (1 - p);
          }
          marks.push({
            kind: 'bang',
            x: pose.x + size * 0.35,
            y: pose.y - size * 1.05,
            size: size * 0.45,
            alpha: Math.min(1, (1 - since / BANG_MS) * 3),
          });
        }
      }
      if (dazed.has(pose.team)) {
        // Woozy: a sway, and stars going round.
        pose.angle += Math.sin(now / 210 + i) * 0.12;
        marks.push({
          kind: 'dizzy',
          x: pose.x,
          y: pose.y - size * 1.02,
          size,
          phase: now / 380 + i * 1.7,
        });
      }
      if (topping.has(pose.team) && !pose.flying) {
        // Bouncing in time while the tower tops out.
        const p = (now % BOUNCE_MS) / BOUNCE_MS;
        pose.y -= Math.sin(Math.PI * p) * size * 0.22;
        const landing = Math.max(0, 1 - Math.min(p, 1 - p) * 8);
        pose.scaleY *= 1 - 0.12 * landing;
        pose.scaleX *= 1 + 0.08 * landing;
      }
    }

    // A rain cloud over the tower that just lost a piece (over the crew's heads it would hide
    // their drawing's header).
    for (const r of reactions) {
      if (r.kind !== 'rain') continue;
      const top = spot(`tower:${r.team}`);
      if (!top) continue;
      const since = now - r.at;
      const alpha = Math.min(1, since / 200, (RAIN_MS - since) / 400);
      const width = Math.max(110, top.size * 3.5);
      rain.push({ x: top.x, y: top.y - width * 0.55, width, alpha, time: since });
    }
    return { poses: out, marks, rain };
  }

  return { add, frame, busy: () => reactions.length > 0 };
}
