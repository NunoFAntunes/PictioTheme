import { CURSE_TUNING, type TestAction } from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { createHarness } from './test-harness';

/** A test room with one person (p1, orange), match started. */
function solo() {
  const h = createHarness({ settings: { testMode: true } });
  h.join('p1');
  h.msg('p1', { t: 'match:start' });
  if (h.state.phase !== 'playing') throw new Error('match did not start');
  return h;
}

const test = (h: ReturnType<typeof solo>, action: TestAction) => h.msg('p1', { t: 'test', action });

describe('test mode', () => {
  it('starts alone: bots draw for both crews, and a builder bot is the rival', () => {
    const h = solo();
    const bots = [...h.state.players.values()].filter((p) => p.bot);
    expect(bots.map((p) => [p.team, p.bot])).toEqual([
      ['orange', 'drawer'],
      ['teal', 'drawer'],
      ['teal', 'builder'],
    ]);
    expect(h.drawer('orange')).toBe('bot-orange-drawer');
    expect(h.drawer('teal')).toBe('bot-teal-drawer');
    // Each drawing is a coloured-in rectangle.
    const strokes = h.crew('orange').round?.strokes ?? [];
    expect(strokes.map((s) => s.tool)).toEqual(['brush', 'fill']);
  });

  it('solving your own drawing makes you its decider, and you place what you keep', () => {
    const h = solo();
    const mark = h.mark();
    test(h, { kind: 'solve', target: 'own', curse: 'melt' });
    const made = h.to('p1', 'piece:made', mark)[0];
    expect(made?.deciding.deciderId).toBe('p1');
    expect(made?.piece.curses).toEqual(['melt']);
    h.msg('p1', { t: 'piece:decide', pieceId: made?.piece.id ?? 0, choice: 'keep' });
    expect(h.crew('orange').placing?.placerId).toBe('p1');
    // The next drawing is ready at once.
    expect(h.drawer('orange')).toBe('bot-orange-drawer');
  });

  it('a piece you curse is placed by the rival bot, which steers it down', () => {
    const h = solo();
    const mark = h.mark();
    test(h, { kind: 'solve', target: 'own' });
    const id = h.to('p1', 'piece:made', mark)[0]?.piece.id ?? 0;
    const physics = h.physics.length;
    h.msg('p1', { t: 'piece:decide', pieceId: id, choice: 'curse' });
    expect(h.crew('teal').placing?.placerId).toBe('bot-teal-builder');
    const ops = h.physics.slice(physics).map((p) => p.physics.op);
    expect(ops).toEqual(['spawn', 'steer']);
  });

  it('the rival can curse a piece at you, with the curse you pick', () => {
    const h = solo();
    test(h, { kind: 'rival', target: 'own', choice: 'curse', curse: 'bouncy' });
    const placing = h.crew('orange').placing;
    expect(placing?.placerId).toBe('p1');
    const piece = h.state.match?.pieces.get(placing?.pieceId ?? 0);
    expect(piece?.sent).toBe(true);
    expect(piece?.curses).toEqual(['bouncy']);
    const spawn = h.physics.findLast((p) => p.physics.op === 'spawn');
    expect(spawn?.physics).toMatchObject({ restitution: CURSE_TUNING.restitution });
  });

  it('the rival steals your drawing', () => {
    const h = solo();
    test(h, { kind: 'rival', target: 'steal', choice: 'keep' });
    const piece = [...(h.state.match?.pieces.values() ?? [])][0];
    expect(piece).toMatchObject({ team: 'orange', stolen: true, tower: 'teal' });
  });

  it('gives spells on demand, and the rival casts them at you', () => {
    const h = solo();
    test(h, { kind: 'grant', team: 'teal', spell: 'fog' });
    expect(h.crew('teal').charges).toEqual(['fog']);
    test(h, { kind: 'rival-cast', slot: 0 });
    expect(h.crew('orange').spell).toMatchObject({ spell: 'fog', casterId: 'bot-teal-builder' });
    expect(h.crew('teal').charges).toEqual([]);
  });

  it('a golden drawing you solve gives your crew a spell', () => {
    const h = solo();
    test(h, { kind: 'golden', team: 'orange' });
    expect(h.crew('orange').round?.golden).toBe(true);
    test(h, { kind: 'solve', target: 'own' });
    expect(h.crew('orange').charges).toHaveLength(1);
  });

  it('a Shaky hand on a crew makes its next rectangle wobble', () => {
    const h = solo();
    test(h, { kind: 'grant', team: 'orange', spell: 'shaky' });
    h.msg('p1', { t: 'spell:cast', slot: 0 });
    h.advance(2_000);
    const straight = h.crew('teal').round?.strokes[0];
    test(h, { kind: 'solve', target: 'steal' });
    const wobbly = h.crew('teal').round?.strokes[0];
    const xs = (s: typeof straight) => (s && 'pts' in s ? s.pts.filter((_, i) => i % 3 === 0) : []);
    // A straight top edge has one x step; a wobbly one has many.
    const steps = (s: typeof straight) =>
      new Set(
        xs(s)
          .slice(1, 24)
          .map((x, i) => x - (xs(s)[i] ?? 0)),
      );
    expect(steps(straight).size).toBeLessThanOrEqual(2);
    expect(steps(wobbly).size).toBeGreaterThan(2);
  });

  it('brings the sky stars at once', () => {
    const h = solo();
    test(h, { kind: 'stars' });
    expect(h.crew('orange').star).not.toBeNull();
    expect(h.crew('teal').star).not.toBeNull();
  });

  it('is refused in a normal room, and no message can turn it on', () => {
    const h = createHarness();
    h.startFour();
    const mark = h.mark();
    h.msg('p1', { t: 'test', action: { kind: 'stars' } });
    expect(h.to('p1', 'error', mark)[0]?.code).toBe('FORBIDDEN');
    const waiting = createHarness();
    waiting.join('p1');
    waiting.msg('p1', { t: 'settings:update', settings: { testMode: true } });
    expect(waiting.state.settings.testMode).toBeFalsy();
  });

  it('keeps a test room private and in test mode', () => {
    const h = createHarness({ settings: { testMode: true } });
    h.join('p1');
    h.msg('p1', { t: 'settings:update', settings: { testMode: false, isPublic: true } });
    expect(h.state.settings).toMatchObject({ testMode: true, isPublic: false });
  });

  it('closes when the last person leaves (bots don’t count), and drops its bots on a rematch', () => {
    const h = solo();
    h.leave('p1');
    expect(h.timers.has('empty')).toBe(true);
    h.join('p1');
    h.advance(15 * 60_000);
    expect(h.state.phase).toBe('results');
    h.msg('p1', { t: 'match:rematch' });
    expect([...h.state.players.keys()]).toEqual(['p1']);
  });
});
