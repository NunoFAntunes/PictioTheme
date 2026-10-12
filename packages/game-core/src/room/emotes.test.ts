import { EMOTE_CHARGES, EMOTE_GAP_MS, EMOTE_REFILL_MS } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { createHarness, receivedOfType } from './test-harness';

/** A room in the waiting phase with p1, p2 and p3: emotes work in any phase. */
function waitingRoom() {
  const h = createHarness();
  h.init();
  for (const id of ['p1', 'p2', 'p3']) h.join(id);
  return h;
}

describe('emotes', () => {
  it('shows a solo emote to everyone and tells the player their charges', () => {
    const h = waitingRoom();
    const fx = h.send('p2', { t: 'emote', emote: 'dance' });
    for (const p of ['p1', 'p2', 'p3']) {
      expect(receivedOfType(fx, p, 'emote')).toEqual([
        { t: 'emote', playerId: 'p2', emote: 'dance' },
      ]);
    }
    expect(receivedOfType(fx, 'p2', 'emote:charges')).toEqual([
      {
        t: 'emote:charges',
        charges: {
          left: EMOTE_CHARGES - 1,
          refillAt: h.now + EMOTE_REFILL_MS,
          readyAt: h.now + EMOTE_GAP_MS,
        },
      },
    ]);
    expect(receivedOfType(fx, 'p1', 'emote:charges')).toEqual([]);
  });

  it('aims targeted emotes at another connected player', () => {
    const h = waitingRoom();
    const fx = h.send('p1', { t: 'emote', emote: 'slap', target: 'p3' });
    expect(receivedOfType(fx, 'p2', 'emote')).toEqual([
      { t: 'emote', playerId: 'p1', emote: 'slap', target: 'p3' },
    ]);

    // Not without a target, not at yourself, not at someone who's away or not here.
    h.disconnect('p2');
    for (const target of [undefined, 'p3', 'p2', 'nobody']) {
      const sender = target === 'p3' ? 'p3' : 'p1';
      const errors = receivedOfType(
        h.send(sender, { t: 'emote', emote: 'squish', ...(target && { target }) }),
        sender,
        'error',
      );
      expect(errors.map((e) => e.code)).toEqual(['VALIDATION']);
    }
    // And solo emotes only on yourself.
    const solo = h.send('p1', { t: 'emote', emote: 'flex', target: 'p3' });
    expect(receivedOfType(solo, 'p1', 'error').map((e) => e.code)).toEqual(['VALIDATION']);
    // Rejected emotes don't use a charge.
    expect(h.state.emoteCharges.get('p1')?.left).toBe(EMOTE_CHARGES - 1);
  });

  it('runs out of charges, waits between emotes and refills one at a time', () => {
    const h = waitingRoom();
    const emote = () => h.send('p1', { t: 'emote', emote: 'taunt' });
    const played = (fx: ReturnType<typeof emote>) => receivedOfType(fx, 'p2', 'emote').length > 0;

    expect(played(emote())).toBe(true);
    // Too soon after the last one.
    const tooSoon = emote();
    expect(played(tooSoon)).toBe(false);
    expect(receivedOfType(tooSoon, 'p1', 'error').map((e) => e.code)).toEqual(['RATE_LIMITED']);

    for (let i = 1; i < EMOTE_CHARGES; i++) {
      h.advance(EMOTE_GAP_MS);
      expect(played(emote())).toBe(true);
    }
    h.advance(EMOTE_GAP_MS);
    expect(played(emote())).toBe(false); // out of charges

    // The first charge comes back EMOTE_REFILL_MS after the first emote, and only one.
    h.advance(EMOTE_REFILL_MS - EMOTE_CHARGES * EMOTE_GAP_MS);
    expect(played(emote())).toBe(true);
    h.advance(EMOTE_GAP_MS);
    expect(played(emote())).toBe(false);

    // Others have their own charges.
    expect(receivedOfType(h.send('p2', { t: 'emote', emote: 'cry' }), 'p3', 'emote')).toHaveLength(
      1,
    );
  });

  it('refills completely after a long wait, and never above the maximum', () => {
    const h = waitingRoom();
    for (let i = 0; i < EMOTE_CHARGES; i++) {
      h.send('p1', { t: 'emote', emote: 'dance' });
      h.advance(EMOTE_GAP_MS);
    }
    h.advance(EMOTE_REFILL_MS * (EMOTE_CHARGES + 2));
    const fx = h.send('p1', { t: 'emote', emote: 'dance' });
    expect(receivedOfType(fx, 'p1', 'emote:charges')[0]?.charges.left).toBe(EMOTE_CHARGES - 1);
  });

  it('keeps charges through a reconnect and sends them in the snapshot', () => {
    const h = waitingRoom();
    h.send('p2', { t: 'emote', emote: 'dance' });
    h.disconnect('p2');
    const [snapshot] = receivedOfType(h.join('p2'), 'p2', 'room:snapshot');
    expect(snapshot?.emoteCharges.left).toBe(EMOTE_CHARGES - 1);
  });

  it('works mid-match, the drawer included', () => {
    const h = createHarness();
    h.startWith(['p1', 'p2']);
    h.chooseFirst();
    const drawer = h.drawerId();
    const other = drawer === 'p1' ? 'p2' : 'p1';
    const fx = h.send(drawer, { t: 'emote', emote: 'hug', target: other });
    expect(receivedOfType(fx, other, 'emote')).toHaveLength(1);
  });
});
