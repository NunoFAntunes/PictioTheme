import { describe, expect, it } from 'vitest';
import { createHarness, receivedOfType } from './test-harness';
import { TIMINGS } from './types';

const PLAYERS = ['p1', 'p2', 'p3'];

/** Plays one turn: the drawer picks, `likers` ❤️ it, the host skips to the reveal. */
function playTurn(h: ReturnType<typeof createHarness>, likeCount: number) {
  h.chooseFirst();
  const drawer = h.drawerId();
  const others = PLAYERS.filter((p) => p !== drawer);
  for (const p of others.slice(0, likeCount)) h.send(p, { t: 'turn:like', liked: true });
  h.send('p1', { t: 'room:skipTurn' });
  return { drawer, revealEnd: () => h.advance(TIMINGS.revealMs) };
}

describe('likes', () => {
  it('everyone but the drawer can like the drawing, once, and take it back', () => {
    const h = createHarness();
    h.startWith(PLAYERS);
    // Not while choosing.
    h.send('p2', { t: 'turn:like', liked: true });
    expect(h.state.likes).toBeNull();

    h.chooseFirst();
    const drawer = h.drawerId();
    const [a, b] = PLAYERS.filter((p) => p !== drawer) as [string, string];
    const fx = h.send(a, { t: 'turn:like', liked: true });
    expect(receivedOfType(fx, drawer, 'turn:likes')).toEqual([{ t: 'turn:likes', likers: [a] }]);
    expect(h.send(a, { t: 'turn:like', liked: true })).toEqual([]); // already liked
    expect(h.send(drawer, { t: 'turn:like', liked: true })).toEqual([]); // not your own
    h.send(b, { t: 'turn:like', liked: true });
    h.send(a, { t: 'turn:like', liked: false });
    expect([...(h.state.likes?.likers ?? [])]).toEqual([b]);

    // Still at the reveal.
    h.send('p1', { t: 'room:skipTurn' });
    h.send(a, { t: 'turn:like', liked: true });
    expect(h.state.likes?.likers.size).toBe(2);
  });

  it('the most liked drawing becomes the cover; a tie keeps the old one', () => {
    const h = createHarness();
    h.startWith(PLAYERS);

    // Turn 1: two likes beat no cover, so its drawer is asked for a picture.
    const first = playTurn(h, 2);
    const request = receivedOfType(first.revealEnd(), first.drawer, 'cover:request');
    expect(request).toEqual([{ t: 'cover:request', turn: 1 }]);
    h.dispatch({ type: 'coverStored', turn: 1 });
    expect(h.state.cover).toEqual({ likes: 2, version: 1 });

    // Turn 2: also two likes, a tie: nobody is asked.
    const second = playTurn(h, 2);
    const fx = second.revealEnd();
    expect(PLAYERS.flatMap((p) => receivedOfType(fx, p, 'cover:request'))).toEqual([]);

    // A stale upload changes nothing.
    h.dispatch({ type: 'coverStored', turn: 2 });
    expect(h.state.cover).toEqual({ likes: 2, version: 1 });
  });

  it('a drawing nobody liked never becomes the cover', () => {
    const h = createHarness();
    h.startWith(PLAYERS);
    const turn = playTurn(h, 0);
    expect(receivedOfType(turn.revealEnd(), turn.drawer, 'cover:request')).toEqual([]);
    expect(h.state.pendingCover).toBeNull();
  });
});
