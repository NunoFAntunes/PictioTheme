import type { PlayerId } from '@pictiotheme/protocol';
import type { Team } from '@pictiotheme/protocol/tower';
import type { Act } from './acts';
import type { Pose } from './troupe';

/**
 * The powers, acted out by the crews' avatars (docs/tower/design/screens.md#the-crews-on-stage),
 * over what the troupe is doing: a caster winds up and lobs a glowing orb at the other tower that
 * lands as the spell begins; a decider hurls a curse over; a thief in a mask dashes to the other
 * crew's drawing and back with it; a spell flies into its crew's slot (from their drawing, in a
 * shower of gold, for a golden word); a drawer under Shaky hand shivers. Pure: the time and where
 * everything is go in, what to draw and what to play come out.
 */

/** A place on screen, in viewport px. */
export type Spot = { x: number; y: number; size: number };

/** Where the show aims: a tower's top, a crew's rim, pad or spell slots. */
/** `board` is the middle of a crew's drawing: there even when your decide card covers it. */
export type SpotKey = `${'tower' | 'rim' | 'board' | 'slots'}:${Team}`;

export type Orb = { x: number; y: number; size: number; icon: string; color: string; spin: number };
export type Particle = {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  shape: 'dot' | 'star' | 'confetti';
  angle: number;
};
/** Something an avatar wears or carries: the thief's mask, the drawing they took. */
export type Prop = { kind: 'mask' | 'paper'; x: number; y: number; size: number; angle: number };

export type ShowCue = { kind: 'burst' | 'swish'; team: Team; x: number };

export type ShowFrame = {
  poses: Pose[];
  orbs: Orb[];
  particles: Particle[];
  props: Prop[];
  /** Avatars glowing gold (a golden word's crew), 0–1. */
  halos: Map<PlayerId, number>;
  cues: ShowCue[];
};

export type ShowScene = {
  now: number;
  poses: readonly Pose[];
  spot: (key: SpotKey) => Spot | null;
  /** Drawers under a Shaky hand. */
  shivering: ReadonlySet<PlayerId>;
  /** You, placing: your avatar doesn't wind up or jump about. */
  calm: PlayerId | null;
};

const WINDUP_MS = 300;
const DASH = { out: 420, grab: 140, back: 480 } as const;
const MASK_AFTER_MS = 500;
const GAIN_MS = 900;
const HALO_MS = 1600;
const TRAIL_EVERY_MS = 35;

type Throw = Extract<Act, { kind: 'throw' }> & {
  at: number;
  from: Spot | null;
  last: Spot | null;
  lastTrail: number;
};
type Steal = Extract<Act, { kind: 'steal' }> & {
  at: number;
  to: Spot | null;
  /** The swish of the dash out, and of the dash back. */
  swished: number;
};
type Gain = Extract<Act, { kind: 'gained' }> & { at: number; from: Spot | null };

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  color: string;
  shape: Particle['shape'];
  spin: number;
  born: number;
  life: number;
};

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const smooth = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Where an arc from `a` to `b`, rising `lift` px over the higher end, is at `p` (0–1). */
function arc(a: Spot, b: Spot, p: number, lift: number) {
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - lift;
  return {
    x: (1 - p) ** 2 * a.x + 2 * (1 - p) * p * mx + p * p * b.x,
    y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * my + p * p * b.y,
  };
}

/** The middle of an avatar, where it holds things. */
const chest = (pose: Pose): Spot => ({ x: pose.x, y: pose.y - pose.size * 0.55, size: pose.size });

export function createShow({ still = false }: { still?: boolean } = {}) {
  const throws: Throw[] = [];
  const steals: Steal[] = [];
  const gains: Gain[] = [];
  let sparks: Spark[] = [];
  const halos = new Map<Team, number>();
  // Seeded, so a burst looks the same in a test every time.
  let seed = 0x2f6b1d;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function burst(
    at: Spot,
    now: number,
    colors: readonly string[],
    count: number,
    shape: Particle['shape'],
    speed = 0.22,
  ) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + random() * 0.6;
      const v = speed * (0.6 + random() * 0.6);
      sparks.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (shape === 'confetti' ? 0.18 : 0.05),
        gravity: shape === 'confetti' ? 0.0005 : 0.0002,
        size: Math.max(3, at.size * (shape === 'confetti' ? 0.1 : 0.12)),
        color: colors[i % colors.length] ?? '#fff',
        shape,
        spin: (random() - 0.5) * 0.02,
        born: now,
        life: shape === 'confetti' ? 1100 : 600,
      });
    }
  }

  /** New acts, starting `now`. With reduced motion there's no show. */
  function add(acts: readonly Act[], now: number): void {
    if (still) return;
    for (const act of acts) {
      if (act.kind === 'throw')
        throws.push({ ...act, at: now, from: null, last: null, lastTrail: now });
      else if (act.kind === 'steal') steals.push({ ...act, at: now, to: null, swished: 0 });
      else if (act.kind === 'gained') gains.push({ ...act, at: now, from: null });
    }
  }

  function frame({ now, poses, spot, shivering, calm }: ShowScene): ShowFrame {
    const cues: ShowCue[] = [];
    const orbs: Orb[] = [];
    const props: Prop[] = [];
    const out = poses.map((p) => ({ ...p }));
    const byId = new Map(out.map((p) => [p.playerId, p]));

    // ── Throws: wind up, let go, fly, burst ──
    for (let i = throws.length - 1; i >= 0; i--) {
      const t = throws[i];
      if (!t) continue;
      const target = spot(`tower:${t.target}`) ?? t.last;
      if (target) t.last = target;
      const thrower = byId.get(t.by);
      const flight = Math.max(200, t.landInMs - WINDUP_MS);
      const since = now - t.at;
      if (since < WINDUP_MS) {
        // The wind-up: leaning back, away from the target.
        if (thrower && thrower.playerId !== calm && target) {
          const away = target.x > thrower.x ? -1 : 1;
          const p = since / WINDUP_MS;
          thrower.angle += away * 0.45 * Math.sin(p * Math.PI * 0.5);
          thrower.scaleY *= 1 - 0.1 * p;
        }
        continue;
      }
      if (!t.from) {
        // Let go: from the thrower's hands, or from their crew's rim if they're not on screen.
        t.from = thrower ? chest(thrower) : spot(`rim:${t.team}`);
        if (!t.from || !target) {
          throws.splice(i, 1);
          continue;
        }
      }
      if (thrower && thrower.playerId !== calm && target && since < WINDUP_MS + 220) {
        // The follow-through.
        const toward = target.x > thrower.x ? 1 : -1;
        thrower.angle += toward * 0.35 * (1 - (since - WINDUP_MS) / 220);
      }
      if (!target) continue;
      const p = clamp01((since - WINDUP_MS) / flight);
      const lift = Math.min(260, 90 + Math.abs(target.x - t.from.x) * 0.25);
      const at = arc(t.from, target, smooth(p), lift);
      const size =
        Math.max(34, (t.from.size + target.size) * 0.45) * (t.what === 'curse' ? 1.1 : 1);
      if (p < 1) {
        orbs.push({
          ...at,
          size,
          icon: t.icon,
          color: t.color,
          spin: (since / 260) % (Math.PI * 2),
        });
        if (now - t.lastTrail >= TRAIL_EVERY_MS) {
          t.lastTrail = now;
          sparks.push({
            x: at.x + (random() - 0.5) * size * 0.4,
            y: at.y + (random() - 0.5) * size * 0.4,
            vx: 0,
            vy: 0.01,
            gravity: 0,
            size: size * 0.16,
            color: t.color,
            shape: 'star',
            spin: 0,
            born: now,
            life: 420,
          });
        }
      } else {
        burst({ ...target, size }, now, [t.color, '#fbf7ee', '#f6c93b'], 14, 'star', 0.28);
        cues.push({ kind: 'burst', team: t.target, x: target.x });
        throws.splice(i, 1);
      }
    }

    // ── Steals: a dash to the other crew's drawing and back, in a mask ──
    for (let i = steals.length - 1; i >= 0; i--) {
      const s = steals[i];
      if (!s) continue;
      const since = now - s.at;
      const thief = byId.get(s.by);
      const rim = spot(`rim:${s.robbed}`);
      if (rim) s.to = { x: rim.x, y: rim.y + rim.size * 0.9, size: rim.size };
      const total = DASH.out + DASH.grab + DASH.back;
      if (!s.to || since >= total + MASK_AFTER_MS) {
        steals.splice(i, 1);
        continue;
      }
      const back = since >= DASH.out + DASH.grab;
      if (s.swished < (back ? 2 : 1)) {
        s.swished = back ? 2 : 1;
        cues.push({ kind: 'swish', team: s.team, x: back ? s.to.x : (thief?.x ?? s.to.x) });
      }
      if (!thief) continue;
      let k = 0;
      if (since < DASH.out) k = smooth(since / DASH.out);
      else if (!back) k = 1;
      else if (since < total) k = 1 - smooth((since - DASH.out - DASH.grab) / DASH.back);
      const home = { x: thief.x, y: thief.y };
      const hop = Math.sin(Math.PI * k) * 40;
      thief.x = lerp(home.x, s.to.x, k);
      thief.y = lerp(home.y, s.to.y, k) - hop;
      thief.angle += (s.to.x > home.x ? 1 : -1) * 0.25 * Math.sin(Math.PI * k);
      // A raccoon's mask over the face, the whole time.
      props.push({
        kind: 'mask',
        x: thief.x,
        y: thief.y - thief.size * 0.5,
        size: thief.size * 0.78,
        angle: thief.angle,
      });
      // The drawing, under an arm, on the way back.
      if (since >= DASH.out && since < total + MASK_AFTER_MS) {
        props.push({
          kind: 'paper',
          x: thief.x + thief.size * 0.42,
          y: thief.y - thief.size * 0.4,
          size: thief.size * 0.6,
          angle: -0.25,
        });
      }
    }

    // ── Spells gained: the spell flies into its crew's slots ──
    for (let i = gains.length - 1; i >= 0; i--) {
      const g = gains[i];
      if (!g) continue;
      const to = spot(`slots:${g.team}`);
      if (!g.from) {
        g.from = spot(g.reason === 'golden' ? `board:${g.team}` : `tower:${g.team}`);
        if (!g.from || !to) {
          gains.splice(i, 1);
          continue;
        }
        if (g.reason === 'golden') {
          burst(g.from, now, ['#f6c93b', '#ffe27a', '#ff8a3d', '#fbf7ee'], 22, 'confetti', 0.3);
          halos.set(g.team, now);
        } else burst(g.from, now, ['#fbf7ee', '#f6c93b'], 10, 'star');
      }
      if (!to) continue;
      const p = clamp01((now - g.at) / GAIN_MS);
      const at = arc(g.from, to, smooth(p), 80);
      if (p < 1) {
        orbs.push({
          ...at,
          size: lerp(Math.max(30, g.from.size * 0.7), 24, p),
          icon: g.icon,
          color: '#f6c93b',
          spin: 0,
        });
      } else {
        burst({ ...to, size: 30 }, now, ['#f6c93b', '#fbf7ee'], 10, 'star', 0.16);
        cues.push({ kind: 'burst', team: g.team, x: to.x });
        gains.splice(i, 1);
      }
    }

    // ── Shaky hand: the drawer can't keep still ──
    if (!still) {
      for (const id of shivering) {
        const pose = byId.get(id);
        if (!pose) continue;
        const s = pose.size / 40;
        pose.x += Math.sin(now / 23) * 2.2 * s;
        pose.y += Math.sin(now / 17) * 0.8 * s;
        pose.angle += Math.sin(now / 31) * 0.09;
      }
    }

    // ── A golden word's crew glows ──
    const glowing = new Map<PlayerId, number>();
    for (const [team, at] of halos) {
      const p = (now - at) / HALO_MS;
      if (p >= 1) {
        halos.delete(team);
        continue;
      }
      for (const pose of out)
        if (pose.team === team) glowing.set(pose.playerId, Math.sin(Math.PI * p));
    }

    // ── Particles ──
    sparks = sparks.filter((s) => now - s.born < s.life);
    const particles: Particle[] = sparks.map((s) => {
      const t = now - s.born;
      return {
        x: s.x + s.vx * t,
        y: s.y + s.vy * t + s.gravity * t * t,
        size: s.size * (s.shape === 'star' ? 1 - (t / s.life) * 0.5 : 1),
        color: s.color,
        alpha: 1 - (t / s.life) ** 2,
        shape: s.shape,
        angle: s.spin * t,
      };
    });

    return { poses: out, orbs, particles, props, halos: glowing, cues };
  }

  return {
    add,
    frame,
    /** Anything still going on: throws, steals, spells flying in, particles. */
    busy: () => throws.length + steals.length + gains.length + sparks.length > 0,
  };
}
