import { DEFAULT_ROOM_SETTINGS, type ServerMessage } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { applyServerMessage, startsNewDrawing, viewFromSnapshot, type RoomView } from './room-view';

function snapshot(overrides: Partial<Extract<ServerMessage, { t: 'room:snapshot' }>> = {}) {
  return {
    t: 'room:snapshot',
    you: 'p2',
    code: 'ABC-DEF',
    name: 'Room',
    isPublic: false,
    settings: { ...DEFAULT_ROOM_SETTINGS, deckId: 'd' },
    players: [
      {
        id: 'p1',
        name: 'Ana',
        avatar: 'a'.repeat(32),
        score: 0,
        connected: true,
        isHost: true,
        guessedThisTurn: false,
      },
      {
        id: 'p2',
        name: 'Bo',
        avatar: 'b'.repeat(32),
        score: 0,
        connected: true,
        isHost: false,
        guessedThisTurn: false,
      },
    ],
    phase: { kind: 'waiting' },
    paused: null,
    round: 0,
    deck: { id: 'd', title: 'Deck', coverId: null, language: 'en' },
    strokes: [],
    likers: [],
    secret: {},
    ...overrides,
  } as const satisfies ServerMessage;
}

function apply(view: RoomView, ...msgs: ServerMessage[]): RoomView {
  return msgs.reduce((v, m) => applyServerMessage(v, m, 1000), view);
}

const drawing = { t: 'phase:drawing', drawerId: 'p1', round: 1, endsAt: 99, mask: '___' } as const;

describe('room view reducer', () => {
  it('tracks phases, the round and the drawer-only secrets', () => {
    let view = viewFromSnapshot(snapshot(), null);
    view = apply(view, { t: 'phase:choosing', drawerId: 'p1', round: 1, endsAt: 50 });
    expect(view.phase).toEqual({ kind: 'choosing', drawerId: 'p1', endsAt: 50 });
    expect(view.secret).toEqual({});
    view = apply(view, drawing, { t: 'hint', mask: 'B__' });
    expect(view.phase).toMatchObject({ kind: 'drawing', mask: 'B__' });
    expect(view.round).toBe(1);
  });

  it('learns the word once the guess is correct, and puts the solve in the feed once', () => {
    let view = apply(viewFromSnapshot(snapshot(), null), drawing);
    view = apply(
      view,
      { t: 'guess:self', kind: 'correct', text: 'bat', word: 'Bat' },
      { t: 'guess:feed', playerId: 'p2', kind: 'correct' },
      { t: 'turn:solved', playerId: 'p2', order: 1 },
    );
    expect(view.secret.word).toBe('Bat');
    expect(view.feed.map((f) => f.kind)).toEqual(['solved']);
    expect(view.bubbles.p2?.kind).toBe('correct');
  });

  it('marks turns, reveals, pauses and the end of the match in the feed once each', () => {
    let view = viewFromSnapshot(snapshot(), null);
    const choosing = { t: 'phase:choosing', drawerId: 'p1', round: 1, endsAt: 50 } as const;
    view = apply(
      view,
      choosing,
      { t: 'room:paused', paused: 'host' },
      { t: 'room:paused', paused: 'host' },
      { t: 'room:paused', paused: null },
      { ...choosing, endsAt: 60 }, // re-sent on resume: same turn
      drawing,
      { t: 'phase:reveal', word: 'Bat', deltas: {}, endsAt: 9 },
      { t: 'phase:results', ranking: ['p1', 'p2'], awards: [] },
    );
    expect(view.feed.map((f) => f.kind)).toEqual(['turn', 'pause', 'pause', 'reveal', 'matchOver']);
    expect(view.feed[0]).toMatchObject({ round: 1, drawerId: 'p1' });
    expect(view.feed[3]).toMatchObject({ word: 'Bat', drawerId: 'p1' });
  });

  it('keeps close guesses redacted (no text) when the server sends none', () => {
    const view = apply(apply(viewFromSnapshot(snapshot(), null), drawing), {
      t: 'guess:feed',
      playerId: 'p1',
      kind: 'close',
    });
    expect(view.feed[0]).toMatchObject({ kind: 'guess', guess: 'close', text: undefined });
  });

  it('counts likes for the current drawing, and starts over at the next turn', () => {
    let view = apply(viewFromSnapshot(snapshot(), null), drawing);
    expect(view.likes).toEqual({ drawerId: 'p1', likers: [] });
    view = apply(view, { t: 'turn:likes', likers: ['p2'] });
    // A pause re-sends phase:drawing: the likes stay.
    view = apply(view, drawing, { t: 'phase:reveal', word: 'Bat', deltas: {}, endsAt: 9 });
    expect(view.likes).toEqual({ drawerId: 'p1', likers: ['p2'] });
    view = apply(view, { t: 'phase:choosing', drawerId: 'p2', round: 1, endsAt: 50 });
    expect(view.likes).toBeNull();
  });

  it("follows the room's new name and public/private", () => {
    const view = apply(viewFromSnapshot(snapshot(), null), {
      t: 'room:details',
      name: 'Spooky night',
      isPublic: true,
    });
    expect(view).toMatchObject({ name: 'Spooky night', isPublic: true });
  });

  it('knows whether the phase started live or came in a snapshot', () => {
    const results: ServerMessage = { t: 'phase:results', ranking: ['p1', 'p2'], awards: [] };
    const live = apply(viewFromSnapshot(snapshot(), null), drawing, results);
    expect(live.phaseLive).toBe(true);
    const caughtUp = applyServerMessage(
      live,
      snapshot({ phase: { kind: 'results', ranking: ['p1', 'p2'], awards: [] } }),
      2000,
    );
    expect(caughtUp.phaseLive).toBe(false);
  });

  it('keeps the feed across a reconnect to the same room', () => {
    let view = apply(viewFromSnapshot(snapshot(), null), { t: 'chat', playerId: 'p1', text: 'hi' });
    view = applyServerMessage(view, snapshot(), 2000);
    expect(view.feed).toHaveLength(1);
  });

  it('clears the canvas on a new turn but not when drawing resumes after a pause', () => {
    const waiting = viewFromSnapshot(snapshot(), null);
    expect(startsNewDrawing(waiting, drawing)).toBe(true);
    const mid = apply(waiting, drawing);
    expect(startsNewDrawing(mid, { ...drawing, endsAt: 200 })).toBe(false);
    expect(
      startsNewDrawing(mid, { t: 'phase:choosing', drawerId: 'p2', round: 1, endsAt: 1 }),
    ).toBe(true);
  });
});
