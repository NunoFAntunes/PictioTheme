import type { ClientMessageType } from '@pictiotheme/protocol';

/** Token buckets per connection (rule R5): an overall cap plus tighter caps on guesses and chat. */

type Bucket = { take(): boolean };

function tokenBucket(perSecond: number, burst: number, now: () => number): Bucket {
  let tokens = burst;
  let last = now();
  return {
    take() {
      const t = now();
      tokens = Math.min(burst, tokens + ((t - last) / 1000) * perSecond);
      last = t;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

export function createMessageLimiter(now: () => number = Date.now) {
  // Drawing sends ~30 batches/s, so the overall cap leaves room for that plus guesses.
  const all = tokenBucket(60, 120, now);
  const perType: Partial<Record<ClientMessageType, Bucket>> = {
    guess: tokenBucket(3, 5, now), // game-rules.md: ~3 guesses per second
    chat: tokenBucket(2, 5, now),
    'vote:kick': tokenBucket(0.5, 3, now),
  };
  return {
    allow(type: ClientMessageType): boolean {
      const specific = perType[type];
      return all.take() && (specific ? specific.take() : true);
    },
  };
}
