import { DOODLES, type DoodleTheme } from './doodles';

/** A doodle placed in a lane. Sizes and gaps are in rem, so they grow with the fluid root. */
export type PlacedDoodle = {
  id: string;
  size: number;
  gapBefore: number;
  rotate: number;
  lift: number;
};

export type Lane = {
  theme: DoodleTheme;
  tone: LaneTone;
  /** Seconds for one copy of the lane to slide past. */
  duration: number;
  reverse: boolean;
  /** Negative delay so the lanes start at different points of their loop. */
  delay: number;
  height: number;
  doodles: PlacedDoodle[];
};

export type LaneTone = 'ink' | 'tomato' | 'purple' | 'teal' | 'pink';

type LanePlan = { theme: DoodleTheme; tone: LaneTone; size: number; duration: number };

/**
 * Top to bottom. Bigger lanes are a little faster, smaller ones drift slowly behind them. The
 * spooky lane sits high, where it shows above the paper as well as beside it.
 */
const PLAN: LanePlan[] = [
  { theme: 'silly', tone: 'ink', size: 3, duration: 130 },
  { theme: 'spooky', tone: 'tomato', size: 4.25, duration: 105 },
  { theme: 'squiggle', tone: 'ink', size: 2.75, duration: 155 },
  { theme: 'space', tone: 'purple', size: 4, duration: 110 },
  { theme: 'food', tone: 'ink', size: 3.25, duration: 140 },
  { theme: 'silly', tone: 'teal', size: 4.5, duration: 95 },
  { theme: 'spooky', tone: 'ink', size: 3, duration: 145 },
  { theme: 'food', tone: 'pink', size: 4, duration: 110 },
  { theme: 'squiggle', tone: 'ink', size: 3.5, duration: 130 },
  { theme: 'space', tone: 'ink', size: 3, duration: 145 },
  { theme: 'silly', tone: 'tomato', size: 4.25, duration: 105 },
  { theme: 'food', tone: 'ink', size: 3, duration: 150 },
];

/**
 * Each lane is two identical copies side by side and slides by one copy, so a copy must be wider
 * than the widest screen it may cover (a 3440 px ultrawide at the fluid root's 20 px rem is 172rem).
 */
export const MIN_COPY_WIDTH = 180;

/** Every lane in the order they stack, laid out the same way on every render. */
export function layOutLanes(): Lane[] {
  return PLAN.map((plan, index) => {
    const random = seeded(index + 1);
    return {
      theme: plan.theme,
      tone: plan.tone,
      duration: plan.duration,
      reverse: index % 2 === 1,
      delay: -Math.round(random() * plan.duration),
      height: plan.size * 1.6,
      doodles: fillLane(plan, random),
    };
  });
}

/** Theme doodles in a shuffled order, with a squiggle between some of them, until the copy is wide enough. */
function fillLane(plan: LanePlan, random: () => number): PlacedDoodle[] {
  const themed = shuffled(
    DOODLES[plan.theme].map((d) => d.id),
    random,
  );
  const squiggles = shuffled(
    DOODLES.squiggle.map((d) => d.id),
    random,
  );
  const placed: PlacedDoodle[] = [];
  let width = 0;
  let next = 0;
  while (width < MIN_COPY_WIDTH) {
    const squiggle = plan.theme !== 'squiggle' && random() < 0.35;
    const id = squiggle
      ? (squiggles[next % squiggles.length] as string)
      : (themed[next % themed.length] as string);
    const size = plan.size * (squiggle ? 0.7 : 0.85 + random() * 0.3);
    const gapBefore = plan.size * (0.9 + random() * 1.4);
    placed.push({
      id,
      size: round(size),
      gapBefore: round(gapBefore),
      rotate: Math.round((random() - 0.5) * 30),
      lift: round((random() - 0.5) * plan.size * 0.35),
    });
    width += size + gapBefore;
    next += 1;
  }
  return placed;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** mulberry32: a tiny seeded generator, so the server's HTML is the same picture every time. */
function seeded(seed: number): () => number {
  let a = seed * 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
