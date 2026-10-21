import {
  SHAKE_AMPLITUDE,
  shakePoints,
  SPELL_TUNING,
  STAR_TUNING,
  type Team,
  type TowerClientMessage,
} from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './test-harness';
import { TIMINGS } from './types';

/** Solves the crew's drawing (a brick) with a correct guess from `by`; returns the piece id. */
function solve(h: Harness, team: Team, by: string) {
  h.drawBrick(team);
  const mark = h.mark();
  h.msg(by, { t: 'guess', text: h.word(team) });
  const made = h.to(by, 'piece:made', mark)[0];
  if (!made) throw new Error('no piece made');
  return made.piece.id;
}

const deciderOf = (h: Harness, pieceId: number) =>
  h.state.match?.pieces.get(pieceId)?.deciderId ?? '';

function makeGolden(h: Harness, team: Team) {
  const round = h.crew(team).round;
  if (!round) throw new Error('no round');
  round.golden = true;
}

describe('golden words', () => {
  it('come up about one round in six, and never twice in a row for a crew', () => {
    let golden = 0;
    let rounds = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const h = createHarness({ seed });
      h.startFour();
      let last = false;
      for (let i = 0; i < 12; i++) {
        const now = h.crew('orange').round?.golden ?? false;
        expect(last && now).toBe(false);
        last = now;
        golden += now ? 1 : 0;
        rounds += 1;
        h.advance(h.state.settings.roundSeconds * 1000);
      }
    }
    expect(golden / rounds).toBeGreaterThan(0.08);
    expect(golden / rounds).toBeLessThan(0.25);
  });

  it('show on the round for both crews (never the word), and never with powers off', () => {
    const h = createHarness();
    h.startFour();
    while (!h.crew('orange').round?.golden) h.advance(h.state.settings.roundSeconds * 1000);
    const id = h.crew('orange').round?.id;
    const rival = h.to('p2', 'round:start').find((m) => m.team === 'orange' && m.round.id === id);
    expect(rival?.round.golden).toBe(true);
    expect(rival?.round).not.toHaveProperty('word');
    for (let seed = 1; seed <= 10; seed++) {
      const off = createHarness({ seed, settings: { powers: false } });
      off.startFour();
      for (let i = 0; i < 12; i++) {
        expect(off.crew('orange').round?.golden).toBe(false);
        off.advance(off.state.settings.roundSeconds * 1000);
      }
    }
  });

  it('give the solver’s crew a spell as well as the piece', () => {
    const h = createHarness();
    h.startFour();
    makeGolden(h, 'orange');
    const mark = h.mark();
    solve(h, 'orange', h.guesser('orange'));
    expect(h.crew('orange').charges).toHaveLength(1);
    expect(h.to('p2', 'crew:charges', mark)[0]).toMatchObject({
      team: 'orange',
      gained: { reason: 'golden' },
    });
  });

  it('give the spell to the thief’s crew when stolen', () => {
    const h = createHarness();
    h.startFour();
    makeGolden(h, 'orange');
    solve(h, 'orange', h.guesser('teal'));
    expect(h.crew('teal').charges).toHaveLength(1);
    expect(h.crew('orange').charges).toHaveLength(0);
  });

  it('give nothing to a crew that already holds two spells', () => {
    const h = createHarness();
    h.startFour();
    h.crew('orange').charges = ['fog', 'fog'];
    makeGolden(h, 'orange');
    solve(h, 'orange', h.guesser('orange'));
    expect(h.crew('orange').charges).toEqual(['fog', 'fog']);
  });
});

describe('casting', () => {
  it('lets anyone but the drawer cast, after a warning, at the other crew’s tower', () => {
    const h = createHarness();
    h.startFour();
    h.crew('orange').charges = ['fog'];
    h.msg(h.drawer('orange'), { t: 'spell:cast', slot: 0 });
    expect(h.to(h.drawer('orange'), 'error').at(-1)?.code).toBe('NOT_DRAWER');
    const caster = h.guesser('orange');
    const mark = h.mark();
    h.msg(caster, { t: 'spell:cast', slot: 0 });
    expect(h.crew('orange').charges).toEqual([]);
    const spell = h.crew('teal').spell;
    expect(spell).toEqual({
      spell: 'fog',
      casterId: caster,
      startsAt: h.now + SPELL_TUNING.warnMs,
      endsAt: h.now + SPELL_TUNING.warnMs + SPELL_TUNING.fogMs,
    });
    expect(h.to('p2', 'crew:spell', mark)[0]).toEqual({ t: 'crew:spell', team: 'teal', spell });
    expect(h.to('p2', 'crew:charges', mark)[0]).toMatchObject({ team: 'orange', charges: [] });
  });

  it('allows one spell per tower at a time, and an empty slot casts nothing', () => {
    const h = createHarness();
    h.startFour();
    const caster = h.guesser('orange');
    h.msg(caster, { t: 'spell:cast', slot: 0 });
    expect(h.to(caster, 'error').at(-1)?.message).toMatch(/no spell/);
    h.crew('orange').charges = ['fog', 'magpie'];
    h.msg(caster, { t: 'spell:cast', slot: 0 });
    h.msg(caster, { t: 'spell:cast', slot: 0 });
    expect(h.to(caster, 'error').at(-1)?.message).toMatch(/already under a spell/);
    expect(h.crew('orange').charges).toEqual(['magpie']);
  });

  it('ends fog when its time is up', () => {
    const h = createHarness();
    h.startFour();
    h.crew('orange').charges = ['fog'];
    h.msg(h.guesser('orange'), { t: 'spell:cast', slot: 0 });
    h.advance(SPELL_TUNING.warnMs + SPELL_TUNING.fogMs - 1);
    expect(h.crew('teal').spell?.spell).toBe('fog');
    const mark = h.mark();
    h.advance(1);
    expect(h.crew('teal').spell).toBeNull();
    expect(h.to('p2', 'crew:spell', mark)[0]).toEqual({
      t: 'crew:spell',
      team: 'teal',
      spell: null,
    });
  });
});

describe('magpie', () => {
  function magpieOnTeal() {
    const h = createHarness();
    h.startFour();
    h.crew('orange').charges = ['magpie'];
    const caster = h.guesser('orange');
    h.msg(caster, { t: 'spell:cast', slot: 0 });
    return { h, caster };
  }

  it('takes the next piece queued for their tower, for the caster to place', () => {
    const { h, caster } = magpieOnTeal();
    h.advance(SPELL_TUNING.warnMs);
    const pieceId = solve(h, 'teal', h.guesser('teal'));
    const mark = h.mark();
    h.msg(deciderOf(h, pieceId), { t: 'piece:decide', pieceId, choice: 'keep' });
    expect(h.to('p1', 'piece:magpied', mark)[0]).toEqual({
      t: 'piece:magpied',
      pieceId,
      from: 'teal',
      to: 'orange',
      casterId: caster,
    });
    expect(h.state.match?.pieces.get(pieceId)?.tower).toBe('orange');
    expect(h.crew('orange').placing).toMatchObject({ pieceId, placerId: caster });
    expect(h.crew('teal').placing).toBeNull();
    expect(h.crew('teal').spell).toBeNull();
  });

  it('takes a piece already waiting when it arrives', () => {
    const { h } = magpieOnTeal();
    // Teal is dazed, so its piece waits in the queue.
    h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [999] });
    const pieceId = solve(h, 'teal', h.guesser('teal'));
    h.msg(deciderOf(h, pieceId), { t: 'piece:decide', pieceId, choice: 'keep' });
    expect(h.crew('teal').queue.map((q) => q.pieceId)).toEqual([pieceId]);
    h.advance(SPELL_TUNING.warnMs);
    expect(h.crew('teal').queue).toEqual([]);
    expect(h.crew('orange').placing?.pieceId).toBe(pieceId);
  });

  it('lets pieces through during its warning, and gives up after a while', () => {
    const { h } = magpieOnTeal();
    const pieceId = solve(h, 'teal', h.guesser('teal'));
    h.msg(deciderOf(h, pieceId), { t: 'piece:decide', pieceId, choice: 'keep' });
    expect(h.crew('teal').placing?.pieceId).toBe(pieceId);
    h.advance(SPELL_TUNING.warnMs + SPELL_TUNING.magpieMs);
    expect(h.crew('teal').spell).toBeNull();
  });
});

describe('comeback charges', () => {
  it('come when a piece falls off, at most once every 90s', () => {
    const h = createHarness();
    h.startFour();
    h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [999] });
    expect(h.crew('teal').charges).toHaveLength(1);
    h.advance(TIMINGS.dazeMaxMs);
    h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [999] });
    expect(h.crew('teal').charges).toHaveLength(1);
    h.advance(SPELL_TUNING.comebackCooldownMs);
    h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [999] });
    expect(h.crew('teal').charges).toHaveLength(2);
  });

  it('come to a tower that stays well behind for a while', () => {
    const h = createHarness();
    h.startFour();
    const heights = (orange: number, teal: number) => {
      h.dispatch({ type: 'height', tower: 'orange', height: orange });
      h.dispatch({ type: 'height', tower: 'teal', height: teal });
    };
    heights(0, SPELL_TUNING.comebackGap);
    h.advance(SPELL_TUNING.behindMs / 2);
    heights(1, SPELL_TUNING.comebackGap); // caught up a bit: the clock starts over
    h.advance(SPELL_TUNING.behindMs / 2);
    heights(0, SPELL_TUNING.comebackGap);
    expect(h.crew('orange').charges).toHaveLength(0);
    h.advance(SPELL_TUNING.behindMs);
    heights(0, SPELL_TUNING.comebackGap);
    expect(h.crew('orange').charges).toHaveLength(1);
    expect(h.crew('teal').charges).toHaveLength(0);
  });

  it('never come with powers off', () => {
    const h = createHarness({ settings: { powers: false } });
    h.startFour();
    h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [999] });
    expect(h.crew('teal').charges).toEqual([]);
  });
});

describe('sky stars', () => {
  const starOps = (h: Harness) =>
    h.physics.filter((p) => p.physics.op === 'star' || p.physics.op === 'unstar');

  function withStars() {
    const h = createHarness();
    h.startFour();
    // Under the comeback gap, so nobody gets a comeback spell meanwhile.
    h.dispatch({ type: 'height', tower: 'orange', height: 1.5 });
    h.advance(STAR_TUNING.firstMs);
    return h;
  }

  it('appear by both towers at the same place, relative to each tower’s top', () => {
    const h = withStars();
    const orange = h.crew('orange').star;
    const teal = h.crew('teal').star;
    expect(orange && teal).toBeTruthy();
    expect(orange?.x).toBe(teal?.x);
    expect(Math.abs(orange?.x ?? 0)).toBeGreaterThanOrEqual(STAR_TUNING.x[0]);
    expect(Math.abs(orange?.x ?? 0)).toBeLessThanOrEqual(STAR_TUNING.x[1]);
    expect((orange?.y ?? 0) - 1.5).toBeCloseTo(teal?.y ?? 0, 9);
    expect(starOps(h)).toEqual([
      { tower: 'orange', physics: { op: 'star', x: orange?.x, y: orange?.y, radius: 0.35 } },
      { tower: 'teal', physics: { op: 'star', x: teal?.x, y: teal?.y, radius: 0.35 } },
    ]);
  });

  it('are caught by a piece that keeps touching it, for a spell', () => {
    const h = withStars();
    const mark = h.mark();
    h.dispatch({ type: 'height', tower: 'teal', height: 0, starHeld: true });
    expect(h.crew('teal').star?.holdUntil).toBe(h.now + STAR_TUNING.holdMs);
    h.advance(STAR_TUNING.holdMs);
    expect(h.crew('teal').star).toBeNull();
    expect(h.crew('teal').charges).toHaveLength(1);
    expect(h.to('p1', 'crew:star', mark).at(-1)).toEqual({
      t: 'crew:star',
      team: 'teal',
      star: null,
      caught: true,
    });
    expect(h.to('p1', 'crew:charges', mark).at(-1)?.gained?.reason).toBe('star');
    expect(starOps(h).at(-1)).toEqual({ tower: 'teal', physics: { op: 'unstar' } });
    expect(h.crew('orange').star).not.toBeNull();
  });

  it('start the hold over when the piece lets go, and go away if nobody catches them', () => {
    const h = withStars();
    h.dispatch({ type: 'height', tower: 'teal', height: 0, starHeld: true });
    h.advance(STAR_TUNING.holdMs - 100);
    h.dispatch({ type: 'height', tower: 'teal', height: 0, starHeld: false });
    expect(h.crew('teal').star?.holdUntil).toBeNull();
    h.advance(STAR_TUNING.lifeMs);
    expect(h.crew('teal').star).toBeNull();
    expect(h.crew('teal').charges).toEqual([]);
  });

  it('come back for towers without one, and never with powers off', () => {
    const h = withStars();
    h.dispatch({ type: 'height', tower: 'teal', height: 0, starHeld: true });
    h.advance(STAR_TUNING.holdMs);
    const orange = h.crew('orange').star;
    h.advance(STAR_TUNING.everyMs - STAR_TUNING.holdMs);
    expect(h.crew('teal').star).not.toBeNull();
    // Orange's had expired by then, so it got a new one too.
    expect(h.crew('orange').star).not.toEqual(orange);
    const off = createHarness({ settings: { powers: false } });
    off.startFour();
    off.advance(STAR_TUNING.firstMs + STAR_TUNING.everyMs);
    expect(off.crew('orange').star).toBeNull();
  });
});

describe('shaky hand', () => {
  const stroke = (id: string, x: number): TowerClientMessage[] => [
    { t: 'draw:begin', id, tool: 'brush', color: '#000000', size: 10, opacity: 1, x, y: 300 },
    { t: 'draw:pts', id, pts: [x + 10, 300, 0.5, x + 20, 300, 0.5] },
    { t: 'draw:end', id },
  ];

  it('makes the strokes their drawer starts under it wobble, for everyone and for the piece', () => {
    const h = createHarness();
    h.startFour();
    const drawer = h.drawer('teal');
    for (const m of stroke('before', 100)) h.msg(drawer, m);
    h.crew('orange').charges = ['shaky'];
    h.msg(h.guesser('orange'), { t: 'spell:cast', slot: 0 });
    h.advance(SPELL_TUNING.warnMs);
    const mark = h.mark();
    for (const m of stroke('during', 400)) h.msg(drawer, m);
    const strokes = h.crew('teal').round?.strokes ?? [];
    const pts = (id: string) => strokes.find((s) => s.id === id && 'pts' in s);
    expect(pts('before')).toMatchObject({ pts: [100, 300, 0.5, 110, 300, 0.5, 120, 300, 0.5] });
    const shaken = [
      ...shakePoints([400, 300, 0.5], 'during', 0),
      ...shakePoints([410, 300, 0.5, 420, 300, 0.5], 'during', 1),
    ];
    expect(pts('during')).toMatchObject({ pts: shaken });
    expect(shaken).not.toEqual([400, 300, 0.5, 410, 300, 0.5, 420, 300, 0.5]);
    // Everyone else gets the wobbly points too.
    const ops = h.to('p1', 'crew:draw', mark).map((m) => m.op);
    expect(ops[0]).toMatchObject({ t: 'draw:begin', x: shaken[0], y: shaken[1] });
    expect(ops[1]).toEqual({ t: 'draw:pts', id: 'during', pts: shaken.slice(3) });
  });

  it('wobbles the same way every time, a little, and stays on the canvas', () => {
    const line = Array.from({ length: 50 }, (_, i) => [i * 24, 0, 0.5]).flat();
    const a = shakePoints(line, 'abc', 0);
    expect(shakePoints(line, 'abc', 0)).toEqual(a);
    expect(shakePoints(line, 'xyz', 0)).not.toEqual(a);
    for (let k = 0; k < a.length; k += 3) {
      expect(Math.abs((a[k] as number) - (line[k] as number))).toBeLessThanOrEqual(
        SHAKE_AMPLITUDE + 1,
      );
      expect(a[k + 1]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('pigeon', () => {
  function pigeonOnTeal() {
    const h = createHarness();
    h.startFour();
    h.crew('orange').charges = ['pigeon'];
    h.msg(h.guesser('orange'), { t: 'spell:cast', slot: 0 });
    return h;
  }
  const pigeonOps = (h: Harness) =>
    h.physics.filter((p) => p.physics.op === 'pigeon' || p.physics.op === 'unpigeon');

  it('lands on their tower when the warning is over', () => {
    const h = pigeonOnTeal();
    expect(pigeonOps(h)).toEqual([]);
    h.advance(SPELL_TUNING.warnMs);
    const [landed] = pigeonOps(h);
    expect(pigeonOps(h)).toHaveLength(1);
    expect(landed?.tower).toBe('teal');
    expect(landed?.physics.op === 'pigeon' && [1, -1].includes(landed.physics.side)).toBe(true);
    expect(h.crew('teal').spell?.spell).toBe('pigeon');
  });

  it('is over when a new piece scares it away', () => {
    const h = pigeonOnTeal();
    h.advance(SPELL_TUNING.warnMs);
    h.dispatch({ type: 'pigeonGone', tower: 'teal' });
    expect(h.crew('teal').spell).toBeNull();
  });

  it('flies off by itself after a while', () => {
    const h = pigeonOnTeal();
    h.advance(SPELL_TUNING.warnMs + SPELL_TUNING.pigeonMs);
    expect(h.crew('teal').spell).toBeNull();
    expect(pigeonOps(h).at(-1)).toEqual({ tower: 'teal', physics: { op: 'unpigeon' } });
  });
});
