import { describe, expect, it } from 'vitest';
import {
  createBackdropVillage,
  createTowerVillage,
  dismissBuilders,
  gatherBuilders,
  landPiece,
  stepVillage,
  takeCues,
  villagerLook,
  type Cue,
  type Landing,
  type Village,
  type Villager,
} from './village';

const GROUND = -2.2;

function run(v: Village, seconds: number, dt = 1 / 30): Cue[] {
  const cues: Cue[] = [];
  for (let t = 0; t < seconds; t += dt) {
    stepVillage(v, dt);
    cues.push(...takeCues(v));
  }
  return cues;
}

/** A 1×1 piece landing centred on `x`, cut into four cells. */
function landing(id: number, x: number): Landing {
  return {
    id,
    x,
    y: -2.2,
    angle: 0,
    left: x - 0.5,
    right: x + 0.5,
    cells: [0, 1, 2, 3].map((index) => ({
      index,
      x: x - 0.25 + (index % 2) * 0.5,
      y: -2.4 + Math.floor(index / 2) * 0.5,
    })),
  };
}

function byJob(v: Village, kind: Villager['job']['kind']): Villager {
  const villager = v.villagers.find((x) => x.job.kind === kind);
  if (!villager) throw new Error(`no ${kind}`);
  return villager;
}

describe('the village', () => {
  it('is the same for the same seed', () => {
    const a = createTowerVillage(9, 3, GROUND);
    const b = createTowerVillage(9, 3, GROUND);
    run(a, 20);
    run(b, 20);
    expect(a).toEqual(b);
  });

  it('keeps everyone busy at their jobs, not wandering off', () => {
    const v = createTowerVillage(3, 3, GROUND);
    const hammerer = byJob(v, 'hammer');
    const home = hammerer.x;
    const poses = new Set<string>();
    for (let i = 0; i < 300; i++) {
      stepVillage(v, 1 / 30);
      poses.add(villagerLook(v, hammerer).pose);
    }
    expect(hammerer.x).toBe(home);
    expect(poses).toContain('switch0');
    expect(poses).toContain('switch1');
  });

  it('carries crates back and forth', () => {
    const v = createTowerVillage(4, 3, GROUND);
    const carrier = byJob(v, 'carry');
    const job = carrier.job as Extract<Villager['job'], { kind: 'carry' }>;
    const seen = new Set<number>();
    for (let i = 0; i < 30 * 30; i++) {
      stepVillage(v, 1 / 30);
      if (carrier.x === job.from || carrier.x === job.to) seen.add(carrier.x);
    }
    expect(seen.size).toBe(2);
  });

  it('has people passing through who come and go', () => {
    const v = createBackdropVillage(5, 10, 0);
    const strollers = v.villagers.filter((x) => x.job.kind === 'stroll');
    let onstage = 0;
    let offstage = 0;
    for (let i = 0; i < 60 * 30; i++) {
      stepVillage(v, 1 / 30);
      for (const s of strollers) {
        if (Math.abs(s.x) < 10) onstage++;
        else offstage++;
      }
    }
    expect(onstage).toBeGreaterThan(0);
    expect(offstage).toBeGreaterThan(0);
  });
});

describe('a piece falling into the village', () => {
  it('lands with a thump, startles the neighbours and gets broken up by the closest one', () => {
    const v = createTowerVillage(1, 3, GROUND);
    run(v, 2);
    const hammerer = byJob(v, 'hammer');
    // Clear of everyone, a little way from the hammerer.
    const x = hammerer.x + (hammerer.x > 0 ? 1.6 : -1.6);
    landPiece(v, landing(1, x));
    const cues = takeCues(v);
    expect(cues[0]).toMatchObject({ kind: 'thump' });
    expect(cues.some((c) => c.kind === 'yelp')).toBe(true);
    expect(hammerer.act.kind).toBe('startled');
    expect(villagerLook(v, hammerer).bubble).toBe('bang');

    const later = run(v, 12);
    expect(later.filter((c) => c.kind === 'whack')).toHaveLength(4);
    expect(v.rubble).toHaveLength(0);
    expect(v.chunks).toHaveLength(0);
    // Back to work afterwards.
    run(v, 15);
    expect(['job', 'back']).toContain(hammerer.act.kind);
  });

  it('squashes whoever it lands on, who waddles about flat, then pops back and goes back to work', () => {
    const v = createTowerVillage(2, 3, GROUND);
    run(v, 1);
    const watcher = byJob(v, 'watch');
    const home = watcher.x;
    landPiece(v, landing(1, watcher.x));
    expect(takeCues(v).some((c) => c.kind === 'squish')).toBe(true);
    expect(villagerLook(v, watcher)).toMatchObject({ under: true });

    const cues = run(v, 4);
    expect(watcher.act.kind).toBe('squished');
    expect(villagerLook(v, watcher)).toMatchObject({ stars: true, under: false });
    expect(villagerLook(v, watcher).sy).toBeLessThan(0.5);
    expect(cues.some((c) => c.kind === 'squeak')).toBe(true);
    // They don't clean up after themselves: somebody else does.
    expect(v.rubble[0]?.cleaner).not.toBe(watcher.index);

    const after = run(v, 20);
    expect(after.some((c) => c.kind === 'pop')).toBe(true);
    expect(watcher.x).toBe(home);
    expect(watcher.act.kind).toBe('job');
    expect(villagerLook(v, watcher).sy).toBe(1);
  });

  it("doesn't let rubble pile up without end", () => {
    const v = createTowerVillage(6, 3, GROUND);
    for (let i = 0; i < 12; i++) landPiece(v, landing(i + 1, -15 + i * 0.01));
    expect(v.rubble.length).toBeLessThanOrEqual(6);
  });
});

describe('building something', () => {
  it('calls the closest free villagers, who hammer at either end of it, then cheer and go back to work', () => {
    const v = createBackdropVillage(7, 12, 0);
    run(v, 2);
    const came = gatherBuilders(v, 2, 4, 6);
    expect(came).toBe(4);
    const builders = v.villagers.filter((x) => x.act.kind === 'build');
    expect(builders).toHaveLength(4);

    const cues = run(v, 6);
    for (const b of builders) {
      // Off the ends of the thing, so they can be seen beside it, and facing it.
      expect(Math.abs(b.x - 2)).toBeGreaterThan(3);
      expect(b.facing).toBe(b.x < 2 ? 1 : -1);
      expect(villagerLook(v, b).tool).toBe('hammer');
    }
    expect(builders.some((b) => b.x < 2) && builders.some((b) => b.x > 2)).toBe(true);
    expect(cues.filter((c) => c.kind === 'whack').length).toBeGreaterThan(10);

    dismissBuilders(v);
    expect(builders.every((b) => b.act.kind === 'proud')).toBe(true);
    run(v, 20);
    for (const b of builders) expect(['job', 'back']).toContain(b.act.kind);
  });

  it("doesn't call anyone who's busy with something that happened", () => {
    const v = createBackdropVillage(7, 12, 0);
    run(v, 2);
    const squashed = v.villagers[0] as Villager;
    landPiece(v, landing(1, squashed.x));
    gatherBuilders(v, squashed.x, 8, 2);
    expect(squashed.act.kind).toBe('flat');
  });
});
