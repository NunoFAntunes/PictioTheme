import { CHARACTERS, type Character, type Pose } from './sprites';

/**
 * The village's life (docs/tower/design/visual-identity.md#villagers): villagers busy with their
 * jobs, people passing through, and what happens when a piece falls off a tower: everyone nearby
 * jumps, the closest free villager runs over and breaks the rubble down, and anyone it lands on
 * is squashed flat, waddles about like that for a while, then pops back into shape.
 *
 * Plain data stepped by `stepVillage`: no DOM, no clock, no Math.random (a seeded generator lives
 * in the state), so it's unit-tested. Positions are world units along the lane (x only; a
 * villager is VILLAGER_HEIGHT tall). It's cosmetic and each player has their own: the server
 * knows nothing about it. `village-draw.ts` draws it; sounds go out as `cues`.
 */

export const VILLAGER_HEIGHT = 1.25;

const WALK = 1.05;
const RUN = 2.9;
const CARRY = 0.85;
const SWEEP = 0.32;
const FLAT_WALK = 0.65;
const GRAVITY = 9.81;
/** How far a landing makes villagers jump, and how far it makes them look. */
const STARTLE_RANGE = 7;
const NOTICE_RANGE = 16;
/** How far a villager will go to clean up. */
const CLEAN_RANGE = 14;
/** One swing of the mallet, and when in it the blow lands. */
const SWING = 0.62;
const BLOW = 0.36;
/** More rubble than this and the oldest heap nobody's working on crumbles by itself. */
const MAX_RUBBLE = 6;

export type CueKind = 'thump' | 'yelp' | 'squish' | 'squeak' | 'pop' | 'whack';
/** A sound to play: what, where along the lane, and a pitch factor (a villager's voice). */
export type Cue = { kind: CueKind; x: number; pitch: number };

export type Job =
  /** Chatting with `partner` (a villager's index), taking turns to talk. */
  | { kind: 'chat'; home: number; partner: number }
  /** Hammering at a fence at `post`. */
  | { kind: 'hammer'; home: number; post: number }
  /** Watering the flower bed at `bed`. */
  | { kind: 'water'; home: number; bed: number }
  /** Sweeping the lane back and forth around `home`. */
  | { kind: 'sweep'; home: number; span: number; goal: number }
  /** Carrying crates from one pile to the other and walking back for more. */
  | { kind: 'carry'; from: number; to: number; goal: number; loaded: boolean; pause: number }
  /** Standing by the tower, watching it go up. */
  | { kind: 'watch'; home: number; towards: number }
  /**
   * Passing through: walks in from one side and out the other (sometimes with a crate, sometimes
   * stopping to wave), then is gone for a while and comes back, maybe as somebody else.
   */
  | {
      kind: 'stroll';
      dir: 1 | -1;
      wait: number;
      speed: number;
      crate: boolean;
      /** Where they'll stop to wave, and for how long; null once they have. */
      stop: number | null;
      waving: number;
    };

export type Act =
  | { kind: 'job' }
  /** Walking back to their job after something interrupted it. */
  | { kind: 'back' }
  /** Jumped out of their skin. `at` is where the piece landed. */
  | { kind: 'startled'; at: number; length: number }
  /** Staring at what just happened. */
  | { kind: 'gawk'; at: number; length: number }
  | { kind: 'run'; rubble: number }
  | { kind: 'clean'; rubble: number; blows: number }
  /** A job well done. */
  | { kind: 'proud'; length: number }
  /** Under the piece. */
  | { kind: 'flat'; length: number }
  /** Waddling about squashed. */
  | { kind: 'squished'; length: number; goal: number; rest: number; squeakAt: number }
  /** Springing back into shape. */
  | { kind: 'pop'; length: number };

export type Villager = {
  index: number;
  character: Character;
  /** Pitch of their voice (yelps, squeaks). */
  voice: number;
  x: number;
  facing: 1 | -1;
  job: Job;
  act: Act;
  /** Seconds into the current act. */
  clock: number;
  /** Distance walked, so the walk cycle follows the feet. */
  stride: number;
  /** How they're moving this step. */
  gait: 'still' | 'walk' | 'run';
  /** Desyncs everyone's loops. */
  phase: number;
};

/** A cell of a fallen piece's grid, where it is in the world. */
export type RubbleCell = { index: number; x: number; y: number };

/** A fallen piece lying on the lane. The cells left are the ones not broken off yet. */
export type Rubble = {
  id: number;
  x: number;
  y: number;
  angle: number;
  left: number;
  right: number;
  cells: RubbleCell[];
  cleaner: number | null;
  age: number;
};

/** A bit knocked off a heap, flying away (drawn with its cell of the piece). */
export type Chunk = {
  rubble: number;
  cell: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  age: number;
};

/** Dust and paper crumbs. */
export type Crumb = { x: number; y: number; vx: number; vy: number; age: number; size: number };

/** Things that belong to the jobs: the fence being mended, the flower bed, the crate piles. */
export type Prop =
  | { kind: 'fence'; x: number; flip: boolean }
  | { kind: 'flowers'; x: number }
  | { kind: 'crates'; x: number };

export type Village = {
  time: number;
  rng: number;
  /** The lane runs from −halfSpan to halfSpan; strollers come and go beyond it. */
  halfSpan: number;
  /** Where the ground is (world y), for the bits that fly about. */
  ground: number;
  villagers: Villager[];
  props: Prop[];
  rubble: Rubble[];
  /** Fallen pieces that also left the scene (all their bits broken off), for the drawer. */
  chunks: Chunk[];
  crumbs: Crumb[];
  /** Sounds since the last `takeCues`. */
  cues: Cue[];
};

// ── Randomness, kept in the state ──

function rand(v: Village): number {
  v.rng = (v.rng + 0x6d2b79f5) >>> 0;
  let t = v.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function between(v: Village, a: number, b: number): number {
  return a + (b - a) * rand(v);
}

function pickCharacter(v: Village, avoid?: Character): Character {
  const pool = CHARACTERS.filter((c) => c !== avoid);
  return pool[Math.floor(rand(v) * pool.length)] as Character;
}

// ── Building a village ──

type Spec = { job: Job; x: number };

function build(seed: number, halfSpan: number, ground: number, plan: (v: Village) => Spec[]) {
  const v: Village = {
    time: 0,
    rng: seed >>> 0,
    halfSpan,
    ground,
    villagers: [],
    props: [],
    rubble: [],
    chunks: [],
    crumbs: [],
    cues: [],
  };
  const specs = plan(v);
  const cast = [...CHARACTERS].sort(() => rand(v) - 0.5);
  v.villagers = specs.map((s, index) => ({
    index,
    character: cast[index % cast.length] as Character,
    voice: between(v, 0.8, 1.3),
    x: s.x,
    facing: 1,
    job: s.job,
    act: { kind: 'job' },
    clock: between(v, 0, 10),
    stride: 0,
    gait: 'still',
    phase: between(v, 0, 1),
  }));
  for (const villager of v.villagers) faceJob(v, villager);
  for (const s of specs) {
    const j = s.job;
    if (j.kind === 'hammer') v.props.push({ kind: 'fence', x: j.post, flip: j.post < j.home });
    if (j.kind === 'water') v.props.push({ kind: 'flowers', x: j.bed });
    if (j.kind === 'carry')
      v.props.push({ kind: 'crates', x: j.from }, { kind: 'crates', x: j.to });
  }
  return v;
}

function stroller(v: Village): Spec {
  const dir = rand(v) < 0.5 ? 1 : -1;
  return {
    x: -dir * (v.halfSpan + 2),
    job: {
      kind: 'stroll',
      dir,
      wait: between(v, 0, 14),
      speed: between(v, 0.9, 1.25),
      crate: false,
      stop: null,
      waving: 0,
    },
  };
}

/**
 * A tower's village (`halfW`: half the platform's width). The busiest spots are either side of
 * the plinth, where pieces fall, so somebody's usually in the way. Mirrored at random per seed.
 */
export function createTowerVillage(seed: number, halfW: number, ground: number): Village {
  return build(seed, 20, ground, (v) => {
    const s = rand(v) < 0.5 ? 1 : -1;
    const near = halfW * 0.62;
    const watch = -s * (near + between(v, 0.4, 0.9));
    const chatA = s * (halfW + between(v, 0.3, 0.8));
    const chatB = chatA + s * between(v, 0.85, 1.05);
    const hammer = -s * (halfW + between(v, 2.1, 3));
    const water = s * (halfW + between(v, 3.6, 4.6));
    const sweep = -s * (halfW + between(v, 5.5, 6.5));
    const carryFrom = s * (halfW + between(v, 6.5, 7.5));
    const carryTo = carryFrom + s * between(v, 3.5, 4.5);
    return [
      { x: watch, job: { kind: 'watch', home: watch, towards: 0 } },
      { x: chatA, job: { kind: 'chat', home: chatA, partner: 2 } },
      { x: chatB, job: { kind: 'chat', home: chatB, partner: 1 } },
      { x: hammer, job: { kind: 'hammer', home: hammer, post: hammer - s * 0.75 } },
      { x: water, job: { kind: 'water', home: water, bed: water + s * 0.7 } },
      { x: sweep, job: { kind: 'sweep', home: sweep, span: 1.2, goal: sweep } },
      {
        x: carryFrom,
        job: { kind: 'carry', from: carryFrom, to: carryTo, goal: carryTo, loaded: true, pause: 0 },
      },
      stroller(v),
      stroller(v),
    ];
  });
}

/** The village behind the home page and the waiting room: busy, with nothing falling on it. */
export function createBackdropVillage(seed: number, halfSpan: number, ground: number): Village {
  return build(seed, halfSpan, ground, (v) => {
    const H = halfSpan;
    const chatA = -H * between(v, 0.6, 0.66);
    const hammer = -H * between(v, 0.2, 0.28);
    const water = H * between(v, 0.12, 0.2);
    const carryFrom = H * 0.48;
    const sweep = -H * 0.9;
    return [
      { x: chatA, job: { kind: 'chat', home: chatA, partner: 1 } },
      { x: chatA + 1, job: { kind: 'chat', home: chatA + 1, partner: 0 } },
      { x: hammer, job: { kind: 'hammer', home: hammer, post: hammer + 0.75 } },
      { x: water, job: { kind: 'water', home: water, bed: water - 0.7 } },
      {
        x: carryFrom,
        job: {
          kind: 'carry',
          from: carryFrom,
          to: H * 0.84,
          goal: H * 0.84,
          loaded: true,
          pause: 0,
        },
      },
      { x: sweep, job: { kind: 'sweep', home: sweep, span: Math.min(1.2, H * 0.08), goal: sweep } },
      stroller(v),
      stroller(v),
    ];
  });
}

// ── Stepping ──

function moveTowards(villager: Villager, goal: number, speed: number, dt: number): boolean {
  const d = goal - villager.x;
  const step = speed * dt;
  if (Math.abs(d) <= step) {
    villager.stride += Math.abs(d);
    villager.x = goal;
    return true;
  }
  villager.facing = d > 0 ? 1 : -1;
  villager.x += villager.facing * step;
  villager.stride += step;
  return false;
}

function face(villager: Villager, x: number): void {
  if (Math.abs(x - villager.x) > 0.01) villager.facing = x > villager.x ? 1 : -1;
}

/** Where a job is done from, or null for the ones that move about anyway. */
function jobSpot(job: Job): number | null {
  return job.kind === 'chat' ||
    job.kind === 'hammer' ||
    job.kind === 'water' ||
    job.kind === 'watch'
    ? job.home
    : null;
}

function faceJob(v: Village, villager: Villager): void {
  const job = villager.job;
  if (job.kind === 'chat') face(villager, v.villagers[job.partner]?.x ?? job.home);
  if (job.kind === 'hammer') face(villager, job.post);
  if (job.kind === 'water') face(villager, job.bed);
  if (job.kind === 'watch') face(villager, job.towards);
}

function setAct(villager: Villager, act: Act): void {
  villager.act = act;
  villager.clock = 0;
}

/** Back to work: walk to the job's spot first if they've wandered off. */
function resume(villager: Villager): void {
  const spot = jobSpot(villager.job);
  setAct(
    villager,
    spot !== null && Math.abs(spot - villager.x) > 0.05 ? { kind: 'back' } : { kind: 'job' },
  );
}

function onstage(v: Village, villager: Villager): boolean {
  return Math.abs(villager.x) < v.halfSpan + 0.5;
}

function doJob(v: Village, villager: Villager, dt: number): void {
  const job = villager.job;
  switch (job.kind) {
    case 'chat':
    case 'hammer':
    case 'water':
    case 'watch':
      faceJob(v, villager);
      return;
    case 'sweep':
      villager.gait = 'walk';
      if (moveTowards(villager, job.goal, SWEEP, dt))
        job.goal = job.home + between(v, -job.span, job.span);
      return;
    case 'carry':
      if (job.pause > 0) {
        job.pause -= dt;
        return;
      }
      villager.gait = 'walk';
      if (moveTowards(villager, job.goal, CARRY, dt)) {
        // Put the crate down on the pile, or pick the next one up.
        job.loaded = job.goal === job.from;
        job.goal = job.goal === job.from ? job.to : job.from;
        job.pause = 1.4;
        villager.gait = 'still';
      }
      return;
    case 'stroll': {
      const edge = v.halfSpan + 2;
      if (job.wait > 0) {
        job.wait -= dt;
        if (job.wait <= 0) {
          // In they come, from either side, maybe as somebody else.
          job.dir = rand(v) < 0.5 ? 1 : -1;
          villager.x = -job.dir * edge;
          villager.character = pickCharacter(v, villager.character);
          villager.voice = between(v, 0.8, 1.3);
          job.speed = between(v, 0.9, 1.25);
          job.crate = rand(v) < 0.35;
          job.stop = rand(v) < 0.4 ? between(v, -v.halfSpan * 0.6, v.halfSpan * 0.6) : null;
        }
        return;
      }
      if (job.waving > 0) {
        job.waving -= dt;
        return;
      }
      villager.gait = 'walk';
      const before = villager.x;
      moveTowards(villager, job.dir * edge, job.speed, dt);
      if (job.stop !== null && (before - job.stop) * (villager.x - job.stop) <= 0) {
        job.stop = null;
        job.waving = 1.8;
        villager.gait = 'still';
      }
      if (Math.abs(villager.x) >= edge) job.wait = between(v, 5, 16);
      return;
    }
  }
}

function stepVillager(v: Village, villager: Villager, dt: number): void {
  villager.clock += dt;
  villager.gait = 'still';
  const act = villager.act;
  switch (act.kind) {
    case 'job':
      doJob(v, villager, dt);
      return;
    case 'back': {
      const spot = jobSpot(villager.job);
      villager.gait = 'walk';
      if (spot === null || moveTowards(villager, spot, WALK, dt)) {
        setAct(villager, { kind: 'job' });
        faceJob(v, villager);
      }
      return;
    }
    case 'startled':
      if (villager.clock >= act.length)
        setAct(villager, { kind: 'gawk', at: act.at, length: between(v, 0.9, 1.7) });
      return;
    case 'gawk':
      face(villager, act.at);
      if (villager.clock >= act.length) resume(villager);
      return;
    case 'run': {
      const heap = v.rubble.find((r) => r.id === act.rubble);
      if (!heap) return resume(villager);
      const centre = (heap.left + heap.right) / 2;
      const spot = villager.x < centre ? heap.left - 0.3 : heap.right + 0.3;
      villager.gait = 'run';
      if (moveTowards(villager, spot, RUN, dt)) {
        face(villager, centre);
        setAct(villager, { kind: 'clean', rubble: heap.id, blows: 0 });
      }
      return;
    }
    case 'clean': {
      const heap = v.rubble.find((r) => r.id === act.rubble);
      if (!heap) return resume(villager);
      const blows = Math.floor((villager.clock - BLOW) / SWING) + 1;
      if (blows > act.blows) {
        act.blows = blows;
        strike(v, villager, heap);
        if (!heap.cells.length) {
          v.rubble = v.rubble.filter((r) => r !== heap);
          setAct(villager, { kind: 'proud', length: 1.1 });
        }
      }
      return;
    }
    case 'proud':
      if (villager.clock >= act.length) resume(villager);
      return;
    case 'flat':
      if (villager.clock >= act.length) {
        setAct(villager, {
          kind: 'squished',
          length: between(v, 9, 12),
          goal: villager.x + (rand(v) < 0.5 ? -1 : 1) * between(v, 1, 2.5),
          rest: 0,
          squeakAt: villager.stride,
        });
      }
      return;
    case 'squished': {
      if (villager.clock >= act.length) {
        setAct(villager, { kind: 'pop', length: 0.7 });
        v.cues.push({ kind: 'pop', x: villager.x, pitch: villager.voice });
        return;
      }
      if (act.rest > 0) {
        act.rest -= dt;
        return;
      }
      villager.gait = 'walk';
      if (moveTowards(villager, act.goal, FLAT_WALK, dt)) {
        act.rest = between(v, 0.4, 1.2);
        const limit = v.halfSpan - 1;
        act.goal = Math.max(
          -limit,
          Math.min(limit, villager.x + (rand(v) < 0.5 ? -1 : 1) * between(v, 1, 3)),
        );
      }
      // A squeak every other step.
      if (villager.stride - act.squeakAt >= 0.42) {
        act.squeakAt = villager.stride;
        v.cues.push({
          kind: 'squeak',
          x: villager.x,
          pitch: villager.voice * between(v, 0.9, 1.1),
        });
      }
      return;
    }
    case 'pop':
      if (villager.clock >= act.length) resume(villager);
      return;
  }
}

/** One blow of the mallet: the bit of the heap closest to the cleaner flies off. */
function strike(v: Village, villager: Villager, heap: Rubble): void {
  let best = 0;
  for (let i = 1; i < heap.cells.length; i++) {
    const a = heap.cells[i] as RubbleCell;
    const b = heap.cells[best] as RubbleCell;
    if (Math.abs(a.x - villager.x) < Math.abs(b.x - villager.x)) best = i;
  }
  const [cell] = heap.cells.splice(best, 1);
  if (!cell) return;
  breakOff(v, heap, cell, villager.facing);
  v.cues.push({ kind: 'whack', x: heap.x, pitch: between(v, 0.85, 1.15) });
}

function breakOff(v: Village, heap: Rubble, cell: RubbleCell, dir: number): void {
  v.chunks.push({
    rubble: heap.id,
    cell: cell.index,
    x: cell.x,
    y: cell.y,
    vx: dir * between(v, 1.2, 3),
    vy: between(v, 2.5, 4.5),
    angle: 0,
    spin: between(v, -9, 9),
    age: 0,
  });
  for (let i = 0; i < 4; i++) {
    v.crumbs.push({
      x: cell.x,
      y: cell.y,
      vx: between(v, -1.5, 1.5) + dir * 0.6,
      vy: between(v, 0.8, 2.6),
      age: 0,
      size: between(v, 0.05, 0.11),
    });
  }
}

/** Sends the closest free villager to every heap nobody is working on. */
function assignCleaners(v: Village): void {
  for (const heap of v.rubble) {
    if (heap.cleaner !== null) continue;
    const centre = (heap.left + heap.right) / 2;
    let best: Villager | null = null;
    for (const villager of v.villagers) {
      const free = villager.act.kind === 'job' || villager.act.kind === 'back';
      if (!free || !onstage(v, villager)) continue;
      if (villager.job.kind === 'stroll' && villager.job.wait > 0) continue;
      const d = Math.abs(villager.x - centre);
      if (d > CLEAN_RANGE) continue;
      if (!best || d < Math.abs(best.x - centre)) best = villager;
    }
    if (best) {
      heap.cleaner = best.index;
      setAct(best, { kind: 'run', rubble: heap.id });
    }
  }
}

/** Advances the village by `dt` seconds. */
export function stepVillage(v: Village, dt: number): void {
  v.time += dt;
  for (const heap of v.rubble) heap.age += dt;
  // Whoever was cleaning a heap and got interrupted (squashed!) leaves it for somebody else.
  for (const heap of v.rubble) {
    if (heap.cleaner === null) continue;
    const act = v.villagers[heap.cleaner]?.act;
    const working = act && (act.kind === 'run' || act.kind === 'clean') && act.rubble === heap.id;
    if (!working) heap.cleaner = null;
  }
  assignCleaners(v);
  for (const villager of v.villagers) stepVillager(v, villager, dt);

  for (const c of v.chunks) {
    c.age += dt;
    c.vy -= GRAVITY * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle += c.spin * dt;
  }
  v.chunks = v.chunks.filter((c) => c.age < 0.9);
  for (const c of v.crumbs) {
    c.age += dt;
    c.vy -= GRAVITY * dt;
    c.x += c.vx * dt;
    c.y = Math.max(v.ground, c.y + c.vy * dt);
  }
  v.crumbs = v.crumbs.filter((c) => c.age < 0.7);
}

export type Landing = {
  id: number;
  x: number;
  y: number;
  angle: number;
  /** The piece's extent along the lane. */
  left: number;
  right: number;
  /** The cells of its grid that have some of the piece in them. */
  cells: RubbleCell[];
};

/**
 * A piece hits the lane: it squashes whoever it lands on, makes everyone near jump and everyone
 * further off look, and stays there as a heap until somebody breaks it down.
 */
export function landPiece(v: Village, landing: Landing): void {
  const at = (landing.left + landing.right) / 2;
  v.cues.push({
    kind: 'thump',
    x: at,
    pitch: Math.max(0.7, Math.min(1.25, 1.35 - (landing.right - landing.left) * 0.18)),
  });
  const heap: Rubble = { ...landing, cells: [...landing.cells], cleaner: null, age: 0 };
  v.rubble.push(heap);

  const yelpers: Villager[] = [];
  for (const villager of v.villagers) {
    if (!onstage(v, villager)) continue;
    const kind = villager.act.kind;
    const down = kind === 'flat' || kind === 'squished' || kind === 'pop';
    if (!down && villager.x > landing.left - 0.2 && villager.x < landing.right + 0.2) {
      setAct(villager, { kind: 'flat', length: 1.5 });
      v.cues.push({ kind: 'squish', x: villager.x, pitch: villager.voice });
      continue;
    }
    if (down) continue;
    const d = Math.abs(villager.x - at);
    if (d < STARTLE_RANGE) {
      face(villager, at);
      setAct(villager, { kind: 'startled', at, length: 0.55 });
      yelpers.push(villager);
    } else if (d < NOTICE_RANGE && kind !== 'run' && kind !== 'clean') {
      setAct(villager, { kind: 'gawk', at, length: between(v, 1, 2) });
    }
  }
  // The two closest let out a yelp; a whole chorus would be too much.
  yelpers.sort((a, b) => Math.abs(a.x - at) - Math.abs(b.x - at));
  for (const villager of yelpers.slice(0, 2))
    v.cues.push({ kind: 'yelp', x: villager.x, pitch: villager.voice });

  // Too much rubble about: the oldest heap nobody's on falls apart by itself.
  if (v.rubble.length > MAX_RUBBLE) {
    const old = v.rubble.find((r) => r.cleaner === null && r !== heap);
    if (old) {
      for (const cell of old.cells) breakOff(v, old, cell, rand(v) < 0.5 ? -1 : 1);
      v.rubble = v.rubble.filter((r) => r !== old);
      v.cues.push({ kind: 'whack', x: old.x, pitch: 0.8 });
    }
  }
}

/** The sounds since last time. */
export function takeCues(v: Village): Cue[] {
  const cues = v.cues;
  v.cues = [];
  return cues;
}

// ── How a villager looks right now ──

export type Tool = 'hammer' | 'mallet' | 'can' | 'broom' | 'crate';
export type Bubble = 'talk' | 'bang' | 'huh' | 'heart';

export type VillagerLook = {
  pose: Pose;
  /** Squash and stretch about their feet. */
  sx: number;
  sy: number;
  /** Off the ground, in world units. */
  lift: number;
  tool: Tool | null;
  /** The watering can is pouring. */
  pouring: boolean;
  bubble: Bubble | null;
  /** Seeing stars. */
  stars: boolean;
  /** Under a fallen piece: drawn behind the rubble. */
  under: boolean;
};

function walkFrame(stride: number): Pose {
  return `walk${Math.floor(stride / 0.13) % 8}` as Pose;
}

function runFrame(stride: number): Pose {
  return `run${Math.floor(stride / 0.3) % 3}` as Pose;
}

/** A spring from `from` to 1 that overshoots and settles. */
function spring(from: number, k: number): number {
  const e = 1 - Math.exp(-6 * k) * Math.cos(k * 14);
  return from + (1 - from) * Math.min(1.2, e);
}

const SQUASHED = { sx: 1.45, sy: 0.42 };

function jobLook(v: Village, villager: Villager, look: VillagerLook): VillagerLook {
  const job = villager.job;
  const t = villager.clock + villager.phase * 10;
  switch (job.kind) {
    case 'chat': {
      // They take turns: one talks (gesturing), the other listens (and now and then ponders).
      const pairPhase = Math.min(villager.index, job.partner) * 1.7;
      const turn = Math.floor((v.time + pairPhase) / 3.4);
      const lead = villager.index < job.partner;
      const speaking = turn % 2 === (lead ? 0 : 1);
      if (speaking) {
        const gesture = Math.floor(v.time * 2.4 + villager.phase * 3) % 3 !== 0;
        const laugh = turn % 5 === 4;
        return {
          ...look,
          pose: laugh ? 'cheer0' : gesture ? 'talk' : 'idle',
          lift: laugh ? Math.abs(Math.sin(v.time * 9)) * 0.08 : 0,
          bubble: laugh ? 'heart' : 'talk',
        };
      }
      return { ...look, pose: turn % 3 === 1 ? 'think' : 'idle' };
    }
    case 'hammer': {
      // Six blows, then a breather.
      const cycle = t % (6 * 0.7 + 1.8);
      if (cycle >= 6 * 0.7) return { ...look, pose: 'idle' };
      return { ...look, pose: cycle % 0.7 < 0.45 ? 'switch0' : 'switch1', tool: 'hammer' };
    }
    case 'water': {
      const pouring = t % 6.5 < 4.5;
      return {
        ...look,
        pose: pouring ? 'interact' : 'idle',
        tool: pouring ? 'can' : null,
        pouring,
      };
    }
    case 'sweep':
      return {
        ...look,
        pose: Math.floor(t / 0.32) % 2 ? 'interact' : 'switch1',
        tool: 'broom',
      };
    case 'carry':
      if (job.pause > 0.6) return { ...look, pose: 'duck' };
      return {
        ...look,
        pose: villager.gait === 'walk' ? walkFrame(villager.stride) : 'idle',
        tool: job.loaded ? 'crate' : null,
      };
    case 'watch':
      return { ...look, pose: t % 7 < 4 ? 'idle' : 'think' };
    case 'stroll':
      if (job.waving > 0)
        return { ...look, pose: Math.floor(v.time * 3) % 2 ? 'talk' : 'interact' };
      return {
        ...look,
        pose: villager.gait === 'walk' ? walkFrame(villager.stride) : 'idle',
        tool: job.crate ? 'crate' : null,
      };
  }
}

/** What to draw for a villager this frame. */
export function villagerLook(v: Village, villager: Villager): VillagerLook {
  const look: VillagerLook = {
    pose: 'idle',
    sx: 1,
    sy: 1,
    lift: 0,
    tool: null,
    pouring: false,
    bubble: null,
    stars: false,
    under: false,
  };
  const act = villager.act;
  switch (act.kind) {
    case 'job':
      return jobLook(v, villager, look);
    case 'back':
      return { ...look, pose: walkFrame(villager.stride) };
    case 'startled':
      return {
        ...look,
        pose: 'jump',
        lift: Math.sin((Math.PI * villager.clock) / act.length) * 0.45,
        bubble: 'bang',
      };
    case 'gawk':
      return { ...look, pose: villager.clock < act.length * 0.6 ? 'show' : 'think', bubble: 'huh' };
    case 'run':
      return { ...look, pose: runFrame(villager.stride) };
    case 'clean': {
      // Wound up until the blow lands, then the follow-through.
      const since = villager.clock - BLOW;
      const struck = since >= 0 && since % SWING < 0.22;
      return { ...look, pose: struck ? 'attack0' : 'attack1', tool: 'mallet' };
    }
    case 'proud':
      return {
        ...look,
        pose: Math.floor(villager.clock * 6) % 2 ? 'cheer1' : 'cheer0',
        lift: Math.abs(Math.sin(villager.clock * 9)) * 0.1,
        bubble: 'heart',
      };
    case 'flat':
      return { ...look, pose: 'idle', sx: 1.7, sy: 0.13, under: true };
    case 'squished':
      return {
        ...look,
        ...SQUASHED,
        pose: villager.gait === 'walk' ? walkFrame(villager.stride) : 'idle',
        // A little wobble as they go.
        sy: SQUASHED.sy + Math.sin(villager.clock * 11) * 0.03,
        stars: true,
      };
    case 'pop': {
      const k = villager.clock / act.length;
      return {
        ...look,
        pose: 'show',
        sx: spring(SQUASHED.sx, k),
        sy: spring(SQUASHED.sy, k),
      };
    }
  }
}
