import { describe, expect, it } from 'vitest';
import { createHarness, receivedOfType, TEST_DECK } from './test-harness';
import { TIMINGS, type Effect } from './types';

/** The metric effects the shell records (docs/technical/data-model.md#metrics). */

const ofKind = <K extends Effect['kind']>(fx: Effect[], kind: K) =>
  fx.filter((e): e is Extract<Effect, { kind: K }> => e.kind === kind);

describe('metric effects', () => {
  it('reports the match start, the cards dealt and picked, and the turn result', () => {
    const h = createHarness();
    const start = h.startWith();
    expect(ofKind(start, 'matchStarted')).toEqual([
      { kind: 'matchStarted', deckId: TEST_DECK.id, playerIds: ['p1', 'p2', 'p3'] },
    ]);

    const drawer = h.drawerId();
    const chose = h.send(drawer, { t: 'turn:choose', index: 1 });
    const [dealt] = ofKind(chose, 'cardsDealt');
    expect(dealt?.offered).toHaveLength(3);
    expect(dealt).toMatchObject({ pickedByDrawer: true, drawn: dealt?.offered[1] });

    const guesser = drawer === 'p2' ? 'p3' : 'p2';
    h.send(guesser, { t: 'guess', text: dealt?.drawn ?? '' });
    const ended = h.advance(TIMINGS.chooseMs + 200_000);
    expect(ofKind(ended, 'turnEnded')[0]).toMatchObject({
      card: dealt?.drawn,
      reason: 'time',
      guessers: 2,
      solved: 1,
    });
  });

  it('marks a card picked at random when time runs out as not picked by the drawer', () => {
    const h = createHarness();
    h.startWith();
    const fx = h.advance(TIMINGS.chooseMs + 10);
    expect(ofKind(fx, 'cardsDealt')[0]).toMatchObject({ pickedByDrawer: false });
  });

  it('reports dealt cards with nothing drawn when the turn is skipped while choosing', () => {
    const h = createHarness();
    h.startWith();
    const fx = h.send('p1', { t: 'room:skipTurn' });
    expect(ofKind(fx, 'cardsDealt')[0]).toMatchObject({ drawn: null, pickedByDrawer: false });
  });

  it('lets the drawer rate the face-up options, and nobody else', () => {
    const h = createHarness();
    h.startWith();
    const drawer = h.drawerId();
    const phase = h.state.phase;
    if (phase.kind !== 'choosing') throw new Error(phase.kind);

    const up = h.send(drawer, { t: 'turn:vote', index: 2, vote: 'up' });
    expect(ofKind(up, 'cardVoted')).toEqual([
      {
        kind: 'cardVoted',
        deckId: TEST_DECK.id,
        card: phase.options[2]?.text,
        playerId: drawer,
        vote: 'up',
      },
    ]);
    // Voting doesn't pick the card.
    expect(h.state.phase.kind).toBe('choosing');
    expect(
      ofKind(h.send(drawer, { t: 'turn:vote', index: 2, vote: null }), 'cardVoted')[0]?.vote,
    ).toBeNull();

    const other = drawer === 'p2' ? 'p3' : 'p2';
    const refused = h.send(other, { t: 'turn:vote', index: 0, vote: 'down' });
    expect(ofKind(refused, 'cardVoted')).toEqual([]);
    expect(receivedOfType(refused, other, 'error')[0]).toMatchObject({ code: 'WRONG_PHASE' });
  });

  it('says why a match ended, and how many turns were drawn', () => {
    const h = createHarness();
    h.startWith();
    h.chooseFirst();
    h.advance(h.state.settings.drawSeconds * 1000 + 10); // the turn ends on time
    const fx = h.send('p1', { t: 'room:end' });
    expect(ofKind(fx, 'matchEnded')[0]?.summary).toMatchObject({ reason: 'host_ended', turns: 1 });
  });
});
