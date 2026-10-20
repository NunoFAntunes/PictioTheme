import { LINE_HEIGHTS } from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './test-harness';
import { SPAWN_GAP, TIMINGS } from './types';

/** Solves the crew's drawing (a brick) with a correct guess from `by`, and returns the piece id. */
function solve(h: Harness, team: 'orange' | 'teal', by: string, target: 'own' | 'steal' = 'own') {
  h.drawBrick(team);
  const word = h.word(team);
  const mark = h.mark();
  h.msg(by, { t: 'guess', text: word, target });
  const made = h.to(by, 'piece:made', mark)[0];
  if (!made) throw new Error('no piece made');
  return made.piece.id;
}

describe('the waiting room', () => {
  it('puts newcomers in the smaller crew and lets them switch', () => {
    const h = createHarness();
    for (const id of ['p1', 'p2', 'p3']) h.join(id);
    const teams = () => [...h.state.players.values()].map((p) => p.team);
    expect(teams()).toEqual(['orange', 'teal', 'orange']);
    h.msg('p3', { t: 'crew:join', team: 'teal' });
    expect(teams()).toEqual(['orange', 'teal', 'teal']);
  });

  it('lets only the host move players, shuffle and change settings', () => {
    const h = createHarness();
    for (const id of ['p1', 'p2', 'p3', 'p4']) h.join(id);
    h.msg('p2', { t: 'crew:move', playerId: 'p1', team: 'teal' });
    expect(h.to('p2', 'error').at(-1)?.code).toBe('NOT_HOST');
    h.msg('p1', { t: 'crew:move', playerId: 'p2', team: 'orange' });
    expect(h.state.players.get('p2')?.team).toBe('orange');
    h.msg('p1', { t: 'settings:update', settings: { line: 'tall', roundSeconds: 45 } });
    expect(h.state.settings).toMatchObject({ line: 'tall', roundSeconds: 45 });
    expect(h.to('p3', 'room:settings').at(-1)?.settings.line).toBe('tall');
    h.msg('p1', { t: 'crew:shuffle' });
    const sizes = ['orange', 'teal'].map(
      (t) => [...h.state.players.values()].filter((p) => p.team === t).length,
    );
    expect(sizes).toEqual([2, 2]);
  });

  it('needs two players in each crew, and the words, to start', () => {
    const h = createHarness();
    for (const id of ['p1', 'p2', 'p3']) h.join(id);
    h.msg('p1', { t: 'match:start' });
    expect(h.to('p1', 'error').at(-1)?.code).toBe('NOT_ENOUGH_PLAYERS');
    h.join('p4');
    h.msg('p2', { t: 'match:start' });
    expect(h.to('p2', 'error').at(-1)?.code).toBe('NOT_HOST');
    h.msg('p1', { t: 'match:start' });
    expect(h.state.phase).toBe('playing');
  });
});

describe('a match starting', () => {
  it('gives each crew its own drawer and a different word, and everyone a snapshot', () => {
    const h = createHarness();
    const mark = h.mark();
    h.startFour();
    expect(h.drawer('orange')).not.toBe(h.drawer('teal'));
    expect(h.state.players.get(h.drawer('orange'))?.team).toBe('orange');
    expect(h.word('orange')).not.toBe(h.word('teal'));
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      expect(h.to(id, 'room:snapshot', mark).at(-1)?.phase).toBe('playing');
    }
    expect(h.physics.filter((p) => p.physics.op === 'reset')).toHaveLength(2);
  });

  it('shows the word only to the drawer, and the mask only to the drawer’s crew', () => {
    const h = createHarness();
    const mark = h.mark();
    h.startFour();
    const drawer = h.drawer('orange');
    const teammate = h.guesser('orange');
    const view = (id: string) => h.to(id, 'room:snapshot', mark).at(-1)?.crews.orange.round;
    expect(view(drawer)?.word).toBe(h.word('orange'));
    expect(view(teammate)?.word).toBeUndefined();
    expect(view(teammate)?.mask).toMatch(/^_+$/);
    for (const other of ['p2', 'p4']) {
      expect(view(other)?.word).toBeUndefined();
      expect(view(other)?.mask).toBeUndefined();
    }
  });
});

describe('guessing', () => {
  it('shows a wrong guess to the guesser’s crew only, never to the other crew', () => {
    const h = createHarness();
    h.startFour();
    const guesser = h.guesser('orange');
    const mark = h.mark();
    h.msg(guesser, { t: 'guess', text: 'banana', target: 'own' });
    expect(h.to(guesser, 'guess:result', mark)[0]?.result).toBe('wrong');
    expect(h.to(h.drawer('orange'), 'crew:feed', mark)[0]?.text).toBe('banana');
    for (const other of ['p2', 'p4']) expect(h.to(other, 'crew:feed', mark)).toEqual([]);
  });

  it('tells only the guesser a guess was close', () => {
    const h = createHarness();
    h.startFour();
    const guesser = h.guesser('orange');
    const mark = h.mark();
    h.msg(guesser, { t: 'guess', text: `${h.word('orange').slice(0, -1)}x`, target: 'own' });
    expect(h.to(guesser, 'guess:result', mark)[0]?.result).toBe('close');
    expect(h.to(h.drawer('orange'), 'crew:feed', mark)).toEqual([]);
  });

  it("doesn't let the drawer guess", () => {
    const h = createHarness();
    h.startFour();
    const drawer = h.drawer('orange');
    h.msg(drawer, { t: 'guess', text: h.word('teal'), target: 'steal' });
    expect(h.to(drawer, 'error').at(-1)?.code).toBe('NOT_DRAWER');
  });

  it('turns a solved drawing into a piece and starts the next round with the next drawer', () => {
    const h = createHarness();
    h.startFour();
    const drawer = h.drawer('orange');
    const guesser = h.guesser('orange');
    const mark = h.mark();
    const pieceId = solve(h, 'orange', guesser);
    const end = h.to('p2', 'round:end', mark)[0];
    expect(end).toMatchObject({ team: 'orange', outcome: 'solved', solverId: guesser, pieceId });
    const piece = h.state.match?.pieces.get(pieceId);
    expect(piece?.shape.parts.length).toBeGreaterThan(0);
    expect(piece?.decideBy).toBe(h.now + TIMINGS.decideMs);
    // A new drawer every round: the other orange player.
    expect(h.drawer('orange')).toBe(guesser);
    expect(h.drawer('orange')).not.toBe(drawer);
  });

  it('ends a blank drawing with no piece', () => {
    const h = createHarness();
    h.startFour();
    const guesser = h.guesser('orange');
    const mark = h.mark();
    h.msg(guesser, { t: 'guess', text: h.word('orange'), target: 'own' });
    expect(h.to('p2', 'round:end', mark)[0]?.outcome).toBe('blank');
    expect(h.state.match?.pieces.size).toBe(0);
  });

  it('expires a drawing nobody guessed, and moves on', () => {
    const h = createHarness({ settings: { roundSeconds: 30 } });
    h.startFour();
    const first = h.drawer('teal');
    const mark = h.mark();
    h.advance(30_000);
    expect(h.to('p1', 'round:end', mark).map((e) => e.outcome)).toContain('expired');
    expect(h.drawer('teal')).not.toBe(first);
  });

  it('reveals hint letters to the crew at a third and two thirds of the round', () => {
    const h = createHarness({ settings: { roundSeconds: 60 } });
    h.startFour();
    const guesser = h.guesser('orange');
    const mark = h.mark();
    h.advance(20_000);
    const hint = h.to(guesser, 'round:hint', mark).find((m) => m.team === 'orange');
    expect(hint?.mask.replace(/_/g, '').length).toBe(1);
    expect(h.to('p2', 'round:hint', mark).filter((m) => m.team === 'orange')).toEqual([]);
  });
});

describe('stealing', () => {
  it('lets the other crew take the piece', () => {
    const h = createHarness();
    h.startFour();
    const thief = h.guesser('teal');
    const mark = h.mark();
    const pieceId = solve(h, 'orange', thief, 'steal');
    expect(h.to('p1', 'round:end', mark)[0]).toMatchObject({ outcome: 'stolen', solverId: thief });
    expect(h.state.match?.pieces.get(pieceId)?.stolen).toBe(true);
    expect(h.state.players.get(thief)?.stats.steals).toBe(1);
  });

  it('cools steal guesses down after a wrong one', () => {
    const h = createHarness();
    h.startFour();
    const thief = h.guesser('teal');
    h.msg(thief, { t: 'guess', text: 'banana', target: 'steal' });
    const mark = h.mark();
    // Even the right answer doesn't count during the cooldown.
    h.msg(thief, { t: 'guess', text: h.word('orange'), target: 'steal' });
    expect(h.to(thief, 'guess:result', mark)[0]).toMatchObject({
      result: 'wrong',
      cooldownUntil: h.now + TIMINGS.stealCooldownMs,
    });
    expect(h.crew('orange').round).not.toBeNull();
    h.advance(TIMINGS.stealCooldownMs);
    h.drawBrick('orange');
    h.msg(thief, { t: 'guess', text: h.word('orange'), target: 'steal' });
    expect(h.state.match?.pieces.size).toBe(1);
  });

  it('gives a steal no "close"', () => {
    const h = createHarness();
    h.startFour();
    const thief = h.guesser('teal');
    const mark = h.mark();
    h.msg(thief, { t: 'guess', text: `${h.word('orange').slice(0, -1)}x`, target: 'steal' });
    expect(h.to(thief, 'guess:result', mark)[0]?.result).toBe('wrong');
  });

  it('can be turned off', () => {
    const h = createHarness({ settings: { steals: false } });
    h.startFour();
    const thief = h.guesser('teal');
    h.msg(thief, { t: 'guess', text: h.word('orange'), target: 'steal' });
    expect(h.to(thief, 'error').at(-1)?.code).toBe('FORBIDDEN');
  });
});

describe('build or send', () => {
  it('builds: the solver places it on their own tower', () => {
    const h = createHarness();
    h.startFour();
    const solver = h.guesser('orange');
    const pieceId = solve(h, 'orange', solver);
    h.msg(solver, { t: 'piece:decide', pieceId, choice: 'build' });
    // The solver is drawing now (next round), so the other orange player places it.
    const placing = h.crew('orange').placing;
    expect(placing?.pieceId).toBe(pieceId);
    expect(placing?.placerId).not.toBe(h.drawer('orange'));
    expect(h.physics.at(-1)).toMatchObject({
      tower: 'orange',
      physics: { op: 'spawn', pieceId, gap: SPAWN_GAP },
    });
  });

  it('sends: the other crew places it', () => {
    const h = createHarness();
    h.startFour();
    const solver = h.guesser('orange');
    const pieceId = solve(h, 'orange', solver);
    const mark = h.mark();
    h.msg(solver, { t: 'piece:decide', pieceId, choice: 'send' });
    expect(h.to('p2', 'piece:queued', mark)[0]).toMatchObject({
      pieceId,
      tower: 'teal',
      sent: true,
    });
    const placing = h.crew('teal').placing;
    expect(placing?.pieceId).toBe(pieceId);
    expect(h.state.players.get(placing?.placerId ?? '')?.team).toBe('teal');
    expect(placing?.placerId).not.toBe(h.drawer('teal'));
    expect(h.state.players.get(solver)?.stats.sends).toBe(1);
  });

  it('builds when the solver doesn’t choose in time', () => {
    const h = createHarness();
    h.startFour();
    const pieceId = solve(h, 'orange', h.guesser('orange'));
    h.advance(TIMINGS.decideMs);
    expect(h.state.match?.pieces.get(pieceId)?.tower).toBe('orange');
  });

  it('lets only the solver choose', () => {
    const h = createHarness();
    h.startFour();
    const pieceId = solve(h, 'orange', h.guesser('orange'));
    h.msg('p2', { t: 'piece:decide', pieceId, choice: 'send' });
    expect(h.to('p2', 'error').at(-1)?.code).toBe('FORBIDDEN');
    expect(h.state.match?.pieces.get(pieceId)?.tower).toBeNull();
  });

  it('builds a stolen piece on the thief’s tower', () => {
    const h = createHarness();
    h.startFour();
    const thief = h.guesser('teal');
    const pieceId = solve(h, 'orange', thief, 'steal');
    h.msg(thief, { t: 'piece:decide', pieceId, choice: 'build' });
    expect(h.state.match?.pieces.get(pieceId)?.tower).toBe('teal');
  });
});

describe('placing', () => {
  function placingPiece(players = 4) {
    const h = createHarness();
    h.startWith(players);
    const pieceId = solve(h, 'orange', h.guesser('orange'));
    h.msg(h.state.match?.pieces.get(pieceId)?.solvedBy ?? '', {
      t: 'piece:decide',
      pieceId,
      choice: 'build',
    });
    const placerId = h.crew('orange').placing?.placerId ?? '';
    return { h, pieceId, placerId };
  }

  it('passes the placer’s steering and drop to the physics, and nobody else’s', () => {
    const { h, placerId } = placingPiece();
    const before = h.physics.length;
    h.msg('p2', { t: 'place:steer', x: 2 });
    h.msg(placerId, { t: 'place:steer', x: 1.5, angle: 0.26, fast: true });
    h.msg(placerId, { t: 'place:drop' });
    expect(h.physics.slice(before)).toEqual([
      { tower: 'orange', physics: { op: 'steer', x: 1.5, angle: 0.26, fast: true } },
      { tower: 'orange', physics: { op: 'drop' } },
    ]);
  });

  it('drops the piece when the time is up', () => {
    const { h } = placingPiece();
    h.advance(TIMINGS.placeMs);
    expect(h.physics.at(-1)).toEqual({ tower: 'orange', physics: { op: 'drop' } });
  });

  it('ends the placement when the physics releases the piece, and counts it', () => {
    const { h, pieceId, placerId } = placingPiece();
    const mark = h.mark();
    h.dispatch({ type: 'released', tower: 'orange', pieceId });
    expect(h.crew('orange').placing).toBeNull();
    expect(h.to('p2', 'place:end', mark)[0]).toEqual({ t: 'place:end', tower: 'orange', pieceId });
    expect(h.state.players.get(placerId)?.stats.placements).toBe(1);
  });

  it("doesn't let the placer guess", () => {
    const { h, placerId } = placingPiece();
    h.msg(placerId, { t: 'guess', text: h.word('orange'), target: 'own' });
    expect(h.to(placerId, 'error').at(-1)?.code).toBe('WRONG_PHASE');
  });

  it('places queued pieces one at a time, in order', () => {
    const { h, pieceId } = placingPiece(6);
    // A second orange piece while the first is still being placed.
    const solver = h.guesser('orange');
    const second = solve(h, 'orange', solver);
    h.msg(solver, { t: 'piece:decide', pieceId: second, choice: 'build' });
    expect(h.crew('orange').queue.map((q) => q.pieceId)).toEqual([second]);
    h.dispatch({ type: 'released', tower: 'orange', pieceId });
    expect(h.crew('orange').placing?.pieceId).toBe(second);
  });
});

describe('fumbles', () => {
  it('dazes the crew: no new placement until the daze is over', () => {
    const h = createHarness();
    h.startWith(6);
    const first = solve(h, 'orange', h.guesser('orange'));
    h.advance(TIMINGS.decideMs); // built
    const second = solve(h, 'orange', h.guesser('orange'));
    h.advance(TIMINGS.decideMs); // queued behind the first
    const mark = h.mark();
    h.dispatch({ type: 'fumbled', tower: 'orange', pieceIds: [first] });
    expect(h.to('p1', 'tower:fumble', mark)[0]).toMatchObject({ dazedUntil: h.now + 5_000 });
    expect(h.crew('orange').placing).toBeNull();
    expect(h.state.match?.pieces.get(first)?.fumbled).toBe(true);
    h.advance(4_999);
    expect(h.crew('orange').placing).toBeNull();
    h.advance(1);
    expect(h.crew('orange').placing?.pieceId).toBe(second);
  });

  it('lengthens a daze by 2s per extra fumble, up to 10s', () => {
    const h = createHarness();
    h.startFour();
    const since = h.now;
    for (let i = 0; i < 5; i++) h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [] });
    expect(h.crew('teal').daze).toEqual({ since, until: since + TIMINGS.dazeMaxMs });
  });

  it('has no daze when it’s turned off', () => {
    const h = createHarness({ settings: { dazeSeconds: 0 } });
    h.startFour();
    h.dispatch({ type: 'fumbled', tower: 'teal', pieceIds: [] });
    expect(h.crew('teal').daze).toBeNull();
  });
});

describe('topping out', () => {
  it('wins after 3s above the line', () => {
    const h = createHarness();
    h.startFour();
    const line = LINE_HEIGHTS.medium;
    h.dispatch({ type: 'height', tower: 'teal', height: line + 0.2 });
    expect(h.crew('teal').toppingSince).toBe(h.now);
    const mark = h.mark();
    h.advance(TIMINGS.toppingMs);
    const end = h.to('p1', 'match:end', mark)[0];
    expect(end?.results).toMatchObject({ winner: 'teal', reason: 'topped_out' });
    expect(h.state.phase).toBe('results');
    expect(h.effects.some((e) => e.kind === 'matchEnded')).toBe(true);
    expect(h.physics.filter((p) => p.physics.op === 'stop')).toHaveLength(2);
  });

  it('resets when the tower drops below the line', () => {
    const h = createHarness();
    h.startFour();
    const line = LINE_HEIGHTS.medium;
    h.dispatch({ type: 'height', tower: 'orange', height: line + 0.1 });
    h.advance(2_000);
    h.dispatch({ type: 'height', tower: 'orange', height: line - 0.5 });
    h.advance(2_000);
    expect(h.state.phase).toBe('playing');
    expect(h.crew('orange').toppingSince).toBeNull();
  });

  it('sends heights only when they change noticeably', () => {
    const h = createHarness();
    h.startFour();
    const mark = h.mark();
    h.dispatch({ type: 'height', tower: 'orange', height: 1 });
    h.dispatch({ type: 'height', tower: 'orange', height: 1.02 });
    h.dispatch({ type: 'height', tower: 'orange', height: 1.1 });
    expect(h.to('p2', 'tower:height', mark).map((m) => m.height)).toEqual([1, 1.1]);
  });

  it('gives the taller tower the win when time runs out', () => {
    const h = createHarness();
    h.startFour();
    h.dispatch({ type: 'height', tower: 'orange', height: 4 });
    h.dispatch({ type: 'height', tower: 'teal', height: 3 });
    h.advance(TIMINGS.matchMs);
    expect(h.state.results).toMatchObject({ winner: 'orange', reason: 'time' });
  });
});

describe('players coming and going', () => {
  it('ends the drawing when its drawer leaves', () => {
    const h = createHarness();
    h.startFour();
    const drawer = h.drawer('orange');
    const mark = h.mark();
    h.leave(drawer);
    expect(h.to('p2', 'round:end', mark)[0]?.outcome).toBe('drawer_left');
    expect(h.drawer('orange')).not.toBe(drawer);
  });

  it('skips the placer in the drawer rotation, so a crew of two keeps going', () => {
    const h = createHarness();
    h.startFour();
    const solver = h.guesser('orange');
    const pieceId = solve(h, 'orange', solver);
    // The solver is now drawing; the first drawer places. Then the solver's drawing is guessed:
    h.msg(solver, { t: 'piece:decide', pieceId, choice: 'build' });
    const placer = h.crew('orange').placing?.placerId;
    expect(placer).not.toBe(solver);
    h.drawBrick('orange');
    h.msg('p2', { t: 'guess', text: h.word('orange'), target: 'steal' });
    // The next drawer would be the placer, who's busy: the solver draws again.
    expect(h.drawer('orange')).toBe(solver);
  });

  it('gets the snapshot again on reconnect, and keeps the crew', () => {
    const h = createHarness();
    h.startFour();
    h.leave('p3');
    const mark = h.mark();
    h.join('p3');
    expect(h.to('p3', 'room:snapshot', mark)[0]?.phase).toBe('playing');
    expect(h.state.players.get('p3')?.team).toBe('orange');
  });

  it('passes host rights on after the host has been gone a while', () => {
    const h = createHarness();
    h.startFour();
    h.leave('p1');
    h.advance(TIMINGS.hostGraceMs);
    expect(h.state.hostId).toBe('p2');
  });
});

describe('words', () => {
  it('never deals both crews words a single guess would solve', () => {
    const words = [
      { text: 'Cup', kind: 'easy' as const, alternates: [], keywords: ['cup'] },
      { text: 'Mug', kind: 'easy' as const, alternates: ['cup'], keywords: ['mug'] },
      { text: 'Lamp', kind: 'easy' as const, alternates: [], keywords: ['lamp'] },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const h = createHarness({ seed, words });
      h.startFour();
      expect([h.word('orange'), h.word('teal')].sort()).not.toEqual(['Cup', 'Mug']);
    }
  });
});

describe('results', () => {
  it('awards the thief and the sender, and goes back to the waiting room on a rematch', () => {
    const h = createHarness();
    h.startFour();
    const thief = h.guesser('teal');
    const pieceId = solve(h, 'orange', thief, 'steal');
    h.msg(thief, { t: 'piece:decide', pieceId, choice: 'send' });
    h.dispatch({ type: 'height', tower: 'orange', height: 20 });
    h.advance(TIMINGS.toppingMs);
    expect(h.state.results?.awards).toEqual(
      expect.arrayContaining([
        { kind: 'best_thief', playerId: thief },
        { kind: 'meanest_sender', playerId: thief },
      ]),
    );
    h.msg('p1', { t: 'match:rematch' });
    expect(h.state.phase).toBe('waiting');
    expect([...h.state.players.values()].map((p) => p.team)).toEqual([
      'orange',
      'teal',
      'orange',
      'teal',
    ]);
  });
});
