import { describe, expect, it } from 'vitest';
import { createHarness, received, receivedOfType, TEST_DECK } from './test-harness';
import { TIMINGS } from './types';

describe('joining', () => {
  it('sends a snapshot to the joiner and the player list to everyone', () => {
    const h = createHarness();
    h.init();
    h.join('p1', 'Ana');
    const fx = h.join('p2', 'Bo');
    const snap = receivedOfType(fx, 'p2', 'room:snapshot')[0];
    expect(snap).toMatchObject({ you: 'p2', code: 'ABC-DEF', phase: { kind: 'waiting' } });
    expect(snap?.deck).toEqual({ id: TEST_DECK.id, title: TEST_DECK.title, coverId: null });
    expect(receivedOfType(fx, 'p1', 'room:players')[0]?.players).toHaveLength(2);
  });

  it('suffixes duplicate names', () => {
    const h = createHarness();
    h.init();
    h.join('p1', 'Ana');
    h.join('p2', 'ana');
    h.join('p3', 'Ana');
    expect([...h.state.players.values()].map((p) => p.name)).toEqual(['Ana', 'ana (2)', 'Ana (3)']);
  });

  it('refuses players when the room is full', () => {
    const h = createHarness({ settings: { maxPlayers: 2 } });
    h.init();
    h.join('p1');
    h.join('p2');
    const fx = h.join('p3');
    expect(fx).toContainEqual({ kind: 'disconnect', playerId: 'p3', reason: 'room_full' });
    expect(h.state.players.has('p3')).toBe(false);
  });
});

describe('starting a match', () => {
  it('only the host can start, with at least 2 players', () => {
    const h = createHarness();
    h.init();
    h.join('p1');
    expect(receivedOfType(h.send('p1', { t: 'room:start' }), 'p1', 'error')[0]?.code).toBe(
      'NOT_ENOUGH_PLAYERS',
    );
    h.join('p2');
    expect(receivedOfType(h.send('p2', { t: 'room:start' }), 'p2', 'error')[0]?.code).toBe(
      'NOT_HOST',
    );
    h.send('p1', { t: 'room:start' });
    expect(h.state.phase.kind).toBe('choosing');
  });

  it('waits for the deck to load', () => {
    const h = createHarness();
    h.dispatch({ type: 'init' });
    h.join('p1');
    h.join('p2');
    const fx = h.send('p1', { t: 'room:start' });
    expect(receivedOfType(fx, 'p1', 'error')[0]?.code).toBe('DECK_NOT_READY');
  });

  it('shows the options only to the drawer', () => {
    const h = createHarness();
    const fx = h.startWith();
    expect(h.drawerId()).toBe('p1');
    expect(receivedOfType(fx, 'p1', 'phase:choosing')[0]?.options).toHaveLength(3);
    expect(receivedOfType(fx, 'p2', 'phase:choosing')[0]?.options).toBeUndefined();
  });

  it('spreads the 3 options across difficulties', () => {
    const h = createHarness();
    h.startWith();
    if (h.state.phase.kind !== 'choosing') throw new Error();
    expect(new Set(h.state.phase.options.map((c) => c.difficulty)).size).toBe(3);
  });

  it('picks a card automatically when the drawer does not choose in time', () => {
    const h = createHarness();
    h.startWith();
    h.advance(TIMINGS.chooseMs);
    expect(h.state.phase.kind).toBe('drawing');
  });
});

describe('a turn', () => {
  it('never sends the word to a guesser before they solve it', () => {
    const h = createHarness();
    h.startWith();
    const startIndex = h.history.length;
    const word = h.chooseFirst();
    h.send('p2', { t: 'guess', text: 'something else' });
    h.advance(50_000); // hints happen
    const toP3 = JSON.stringify(received(h.history.slice(startIndex), 'p3')).toLowerCase();
    expect(toP3).not.toContain(word.toLowerCase());
    const toDrawer = received(h.history.slice(startIndex), 'p1');
    expect(toDrawer.find((m) => m.t === 'phase:drawing')).toMatchObject({ word });
  });

  it('classifies guesses and applies the feed visibility rules', () => {
    const h = createHarness();
    h.startWith();
    const word = h.chooseFirst();

    const wrong = h.send('p2', { t: 'guess', text: 'banana' });
    expect(receivedOfType(wrong, 'p2', 'guess:self')[0]).toMatchObject({ kind: 'wrong' });
    expect(receivedOfType(wrong, 'p3', 'guess:feed')[0]).toEqual({
      t: 'guess:feed',
      playerId: 'p2',
      kind: 'wrong',
      text: 'banana',
    });

    const close = h.send('p2', { t: 'guess', text: `${word}x` });
    expect(receivedOfType(close, 'p3', 'guess:feed')[0]).toEqual({
      t: 'guess:feed',
      playerId: 'p2',
      kind: 'close',
    });
    // The drawer sees the actual close guess.
    expect(receivedOfType(close, 'p1', 'guess:feed')[0]?.text).toBe(`${word}x`);

    const correct = h.send('p2', { t: 'guess', text: word });
    expect(receivedOfType(correct, 'p2', 'guess:self')[0]).toMatchObject({ kind: 'correct', word });
    expect(receivedOfType(correct, 'p3', 'guess:feed')[0]).toEqual({
      t: 'guess:feed',
      playerId: 'p2',
      kind: 'correct',
    });
    expect(receivedOfType(correct, 'p3', 'turn:solved')[0]).toMatchObject({
      playerId: 'p2',
      order: 1,
    });
  });

  it('hides wrong guesses from others when visibility is off', () => {
    const h = createHarness({ settings: { guessVisibility: 'hide' } });
    h.startWith();
    h.chooseFirst();
    const fx = h.send('p2', { t: 'guess', text: 'banana' });
    expect(receivedOfType(fx, 'p3', 'guess:feed')).toEqual([]);
    expect(receivedOfType(fx, 'p1', 'guess:feed')).toHaveLength(1); // drawer still sees it
  });

  it('masks profanity in guesses and chat that others see', () => {
    const h = createHarness({ settings: { maxPlayers: 4 } });
    h.init();
    for (const id of ['p1', 'p2', 'p3']) h.join(id);
    const lobby = h.send('p2', { t: 'chat', text: 'this is shit' });
    expect(receivedOfType(lobby, 'p3', 'chat')[0]).toMatchObject({ text: 'this is ****' });

    h.send('p1', { t: 'room:start' });
    const word = h.chooseFirst();
    const wrong = h.send('p2', { t: 'guess', text: 'sh1t' });
    expect(receivedOfType(wrong, 'p3', 'guess:feed')[0]).toMatchObject({ text: '****' });
    expect(receivedOfType(wrong, 'p1', 'guess:feed')[0]).toMatchObject({ text: '****' });
    // The guesser sees what they typed.
    expect(receivedOfType(wrong, 'p2', 'guess:self')[0]).toMatchObject({ text: 'sh1t' });

    h.send('p2', { t: 'guess', text: word });
    const solved = h.send('p2', { t: 'guess', text: 'fuck yes' });
    expect(receivedOfType(solved, 'p1', 'chat')[0]).toMatchObject({ text: '**** yes' });
  });

  it('routes messages from solvers only to the drawer and other solvers', () => {
    const h = createHarness({ settings: { maxPlayers: 4 } });
    h.startWith(['p1', 'p2', 'p3', 'p4']);
    const word = h.chooseFirst();
    h.send('p2', { t: 'guess', text: word });
    const fx = h.send('p2', { t: 'guess', text: `it was ${word}!` });
    expect(receivedOfType(fx, 'p1', 'chat')[0]).toMatchObject({ solvedChannel: true });
    expect(received(fx, 'p3')).toEqual([]);
    expect(received(fx, 'p4')).toEqual([]);
  });

  it('ends early when everyone has guessed, and scores guessers and drawer', () => {
    const h = createHarness();
    h.startWith();
    const word = h.chooseFirst();
    h.advance(20_000); // 60s of 80s left
    h.send('p2', { t: 'guess', text: word });
    h.advance(20_000); // 40s left
    const fx = h.send('p3', { t: 'guess', text: word });

    expect(h.state.phase.kind).toBe('reveal');
    const reveal = receivedOfType(fx, 'p3', 'phase:reveal')[0];
    expect(reveal?.word).toBe(word);
    const multiplier = { easy: 1, medium: 1.2, hard: 1.5 }[
      TEST_DECK.cards.find((c) => c.text === word)?.difficulty ?? 'easy'
    ];
    // p2: 50 + 250 × 60/80 + 50 first bonus = 287.5; p3: 50 + 250 × 40/80 = 175; drawer: 200.
    expect(reveal?.deltas).toEqual({
      p2: Math.round(287.5 * multiplier),
      p3: Math.round(175 * multiplier),
      p1: Math.round(200 * multiplier),
    });
  });

  it('ends at the timer and gives the drawer nothing if nobody guessed', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.advance(80_000);
    expect(h.state.phase.kind).toBe('reveal');
    if (h.state.phase.kind !== 'reveal') throw new Error();
    expect(h.state.phase.deltas).toEqual({});
  });

  it('reveals at most two hint letters, at 50% and 75% of the time', () => {
    const h = createHarness();
    h.startWith();
    if (h.state.phase.kind !== 'choosing') throw new Error();
    // The longest option, so the word allows 2 hints (at most a third of its letters).
    const lengths = h.state.phase.options.map((o) => o.text.length);
    h.send('p1', { t: 'turn:choose', index: lengths.indexOf(Math.max(...lengths)) });
    const first = h.advance(40_000);
    expect(receivedOfType(first, 'p2', 'hint')).toHaveLength(1);
    expect(receivedOfType(first, 'p1', 'hint')).toEqual([]); // the drawer knows the word
    const second = h.advance(20_000);
    expect(receivedOfType(second, 'p2', 'hint')).toHaveLength(1);
    expect(receivedOfType(h.advance(19_000), 'p2', 'hint')).toEqual([]);
  });
});

describe('a full match', () => {
  it('rotates drawers each turn and ends with results', () => {
    const h = createHarness({ settings: { rounds: 2 } });
    h.startWith();
    while (h.state.phase.kind !== 'results') h.advance(1_000);
    const drawers = receivedOfType(h.history, 'p2', 'phase:choosing').map((m) => m.drawerId);
    // Round 1 in join order, round 2 rotated by one.
    expect(drawers).toEqual(['p1', 'p2', 'p3', 'p2', 'p3', 'p1']);
    const ended = h.history.find((e) => e.kind === 'matchEnded');
    expect(ended).toBeDefined();
  });

  it('ranks by score, then correct guesses', () => {
    const h = createHarness({ settings: { rounds: 1 } });
    h.startWith();
    const word = h.chooseFirst(); // p1 draws
    h.send('p3', { t: 'guess', text: word });
    while (h.state.phase.kind !== 'results') h.advance(1_000);
    if (h.state.phase.kind !== 'results') throw new Error();
    expect(h.state.phase.ranking[0]).toBe('p3');
    expect(h.state.phase.awards).toContainEqual({ id: 'fastest_guesser', playerId: 'p3' });
  });

  it('can be started again from the results screen', () => {
    const h = createHarness({ settings: { rounds: 1 } });
    h.startWith();
    while (h.state.phase.kind !== 'results') h.advance(1_000);
    h.send('p1', { t: 'room:start' });
    expect(h.state.phase.kind).toBe('choosing');
    expect([...h.state.players.values()].every((p) => p.score === 0)).toBe(true);
  });
});

describe('edge cases (user-flows §9)', () => {
  it('ends the turn when the drawer is gone for 15s, without penalising guessers', () => {
    const h = createHarness();
    h.startWith();
    const word = h.chooseFirst();
    h.send('p2', { t: 'guess', text: word });
    h.disconnect('p1');
    h.advance(TIMINGS.drawerGraceMs - 1);
    expect(h.state.phase.kind).toBe('drawing');
    h.advance(1);
    expect(h.state.phase.kind).toBe('reveal');
    if (h.state.phase.kind !== 'reveal') throw new Error();
    expect(h.state.phase.deltas.p2).toBeGreaterThan(0);
    expect(h.state.phase.deltas.p1).toBeUndefined();
  });

  it('keeps the turn when the drawer reconnects in time, and sends them a snapshot', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.send('p1', {
      t: 'draw:begin',
      id: 's1',
      tool: 'brush',
      color: '#000000',
      size: 8,
      opacity: 1,
      x: 10,
      y: 10,
    });
    h.disconnect('p1');
    h.advance(5_000);
    const fx = h.join('p1');
    h.advance(TIMINGS.drawerGraceMs);
    expect(h.state.phase.kind).toBe('drawing');
    const snap = receivedOfType(fx, 'p1', 'room:snapshot')[0];
    expect(snap?.strokes).toHaveLength(1);
    expect(snap?.secret.word).toBeDefined();
  });

  it('passes host rights on after the host is gone for 30s', () => {
    const h = createHarness();
    h.init();
    h.join('p1');
    h.join('p2');
    h.disconnect('p1');
    h.advance(TIMINGS.hostGraceMs);
    expect(h.state.hostId).toBe('p2');
    h.join('p1'); // coming back doesn't give host back
    expect(h.state.hostId).toBe('p2');
  });

  it('removes a player who stays disconnected', () => {
    const h = createHarness();
    h.init();
    h.join('p1');
    h.join('p2');
    h.disconnect('p2');
    h.advance(TIMINGS.playerGraceMs);
    expect(h.state.players.has('p2')).toBe(false);
  });

  it('pauses when only one player is left, resumes when someone returns', () => {
    const h = createHarness();
    h.startWith(['p1', 'p2']);
    h.chooseFirst();
    h.advance(10_000); // 70s left
    h.disconnect('p2');
    expect(h.state.paused?.reason).toBe('players');
    h.advance(60_000);
    expect(h.state.phase.kind).toBe('drawing'); // the clock is stopped
    const fx = h.join('p2');
    expect(h.state.paused).toBeNull();
    const drawing = receivedOfType(fx, 'p1', 'phase:drawing')[0];
    expect(drawing?.endsAt).toBe(h.now + 70_000);
  });

  it('closes the room if nobody comes back within 5 minutes', () => {
    const h = createHarness();
    h.startWith(['p1', 'p2']);
    h.chooseFirst();
    h.disconnect('p2');
    const fx = h.advance(TIMINGS.aloneMs);
    expect(fx).toContainEqual({ kind: 'close' });
    expect(fx.some((e) => e.kind === 'matchEnded')).toBe(true);
  });

  it('closes an idle waiting room after 30 minutes', () => {
    const h = createHarness();
    h.init();
    h.join('p1');
    expect(h.advance(TIMINGS.idleMs)).toContainEqual({ kind: 'close' });
  });
});

describe('host controls', () => {
  it('pause keeps the remaining time', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.advance(30_000); // 50s left
    h.send('p1', { t: 'room:pause' });
    h.advance(120_000);
    expect(h.state.phase.kind).toBe('drawing');
    const guess = h.send('p2', { t: 'guess', text: 'x' });
    expect(receivedOfType(guess, 'p2', 'error')[0]?.code).toBe('WRONG_PHASE');
    h.send('p1', { t: 'room:resume' });
    h.advance(49_999);
    expect(h.state.phase.kind).toBe('drawing');
    h.advance(1);
    expect(h.state.phase.kind).toBe('reveal');
  });

  it('skip reveals the card and gives no drawer points', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.send('p1', { t: 'room:skipTurn' });
    expect(h.state.phase.kind).toBe('reveal');
  });

  it('allows only live settings during a match', () => {
    const h = createHarness();
    h.startWith();
    const fx = h.send('p1', { t: 'room:settings', settings: { rounds: 5 } });
    expect(receivedOfType(fx, 'p1', 'error')[0]?.code).toBe('WRONG_PHASE');
    h.send('p1', { t: 'room:settings', settings: { guessVisibility: 'hide' } });
    expect(h.state.settings.guessVisibility).toBe('hide');
  });

  it('loads the new deck when the host picks another one', () => {
    const h = createHarness();
    h.init();
    h.join('p1');
    const fx = h.send('p1', { t: 'room:settings', settings: { deckId: 'other-deck' } });
    expect(fx).toContainEqual({ kind: 'loadDeck', deckId: 'other-deck' });
  });

  it('kicks and bans a player', () => {
    const h = createHarness();
    h.init();
    h.join('p1');
    h.join('p2');
    const fx = h.send('p1', { t: 'room:kick', playerId: 'p2' });
    expect(fx).toContainEqual({ kind: 'disconnect', playerId: 'p2', reason: 'kicked' });
    expect(h.join('p2')).toContainEqual({ kind: 'disconnect', playerId: 'p2', reason: 'banned' });
  });
});

describe('vote kick', () => {
  it('kicks when more than half of the other players vote', () => {
    const h = createHarness({ settings: { maxPlayers: 4 } });
    h.init();
    for (const id of ['p1', 'p2', 'p3', 'p4']) h.join(id);
    const first = h.send('p2', { t: 'vote:kick', playerId: 'p1' });
    expect(receivedOfType(first, 'p3', 'room:notice')[0]).toMatchObject({ count: 1, needed: 2 });
    h.send('p3', { t: 'vote:kick', playerId: 'p1' });
    expect(h.state.players.has('p1')).toBe(false);
    expect(h.state.hostId).toBe('p2'); // a kicked host hands over
  });
});

describe('drawing', () => {
  it('stores strokes, forwards them to everyone but the drawer, and clamps points', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.send('p1', {
      t: 'draw:begin',
      id: 's1',
      tool: 'brush',
      color: '#ff0000',
      size: 8,
      opacity: 0.5,
      x: 1,
      y: 2,
    });
    const fx = h.send('p1', { t: 'draw:pts', id: 's1', pts: [5000, -10, 0.7, 3, 4, 0.5] });
    expect(receivedOfType(fx, 'p2', 'draw:pts')[0]?.pts).toEqual([1200, 0, 0.7, 3, 4, 0.5]);
    expect(received(fx, 'p1')).toEqual([]);
    expect(h.state.strokes[0]).toMatchObject({
      tool: 'brush',
      pts: [1, 2, 0.5, 1200, 0, 0.7, 3, 4, 0.5],
    });
  });

  it('supports undo, redo and an undoable clear', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.send('p1', { t: 'draw:fill', id: 'f1', x: 5, y: 5, color: '#00ff00', tolerance: 10 });
    h.send('p1', { t: 'draw:clear' });
    expect(h.state.strokes.map((s) => s.tool)).toEqual(['fill', 'clear']);
    h.send('p1', { t: 'draw:undo' });
    expect(h.state.strokes.map((s) => s.tool)).toEqual(['fill']);
    h.send('p1', { t: 'draw:redo' });
    expect(h.state.strokes.map((s) => s.tool)).toEqual(['fill', 'clear']);
  });

  it('rejects drawing from anyone but the drawer', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    const fx = h.send('p2', { t: 'draw:clear' });
    expect(receivedOfType(fx, 'p2', 'error')[0]?.code).toBe('NOT_DRAWER');
  });

  it('gives late joiners the current drawing', () => {
    const h = createHarness({ settings: { maxPlayers: 4 } });
    h.startWith();
    h.chooseFirst();
    h.send('p1', { t: 'draw:fill', id: 'f1', x: 5, y: 5, color: '#00ff00', tolerance: 10 });
    const fx = h.join('p4');
    const snap = receivedOfType(fx, 'p4', 'room:snapshot')[0];
    expect(snap?.strokes).toHaveLength(1);
    expect(snap?.secret.word).toBeUndefined();
    expect(snap?.phase.kind).toBe('drawing');
  });
});
