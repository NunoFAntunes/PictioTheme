import type { Card, Difficulty, RoomSettings } from '@pictiotheme/protocol';
import { shuffle, type Rng } from './rng';

/**
 * The cards available for one match. Rules: docs/product/game-rules.md#card-pool.
 * Pool operations happen once per turn, so they return new values instead of mutating.
 */
export type CardPool = {
  /** Shuffled cards not yet drawn this match, next card first. */
  remaining: Card[];
  /** Cards already drawn this match. Recycled only when `remaining` runs out. */
  used: Card[];
};

export function buildCardPool(
  cards: readonly Card[],
  settings: Pick<RoomSettings, 'difficulties' | 'silly'>,
  rng: Rng,
): CardPool {
  const allowed = new Set<Difficulty>(settings.difficulties);
  const inDifficulty = cards.filter((c) => allowed.has(c.difficulty));
  const normal = inDifficulty.filter((c) => !c.silly);
  const silly = inDifficulty.filter((c) => c.silly);

  let selected: Card[];
  if (!settings.silly.enabled || silly.length === 0) {
    selected = normal;
  } else if (normal.length === 0 || settings.silly.ratio >= 1) {
    selected = silly;
  } else {
    // Mix so that silly cards make up ~ratio of the pool.
    const { ratio } = settings.silly;
    const sillyCount = Math.min(silly.length, Math.round((normal.length * ratio) / (1 - ratio)));
    selected = [...normal, ...shuffle(silly, rng).slice(0, sillyCount)];
  }

  return { remaining: shuffle(selected, rng), used: [] };
}

/**
 * Takes up to `count` options for the drawer, spread across difficulties when possible
 * (one easy, one medium, one hard) so the drawer can choose their risk.
 * Recycles used cards when the pool runs out; `reshuffled` tells the room to notify the host.
 */
export function takeOptions(
  pool: CardPool,
  count: number,
  rng: Rng,
): { pool: CardPool; options: Card[]; reshuffled: boolean } {
  let remaining = pool.remaining;
  let used = pool.used;
  let reshuffled = false;
  if (remaining.length < count && used.length > 0) {
    remaining = [...remaining, ...shuffle(used, rng)];
    used = [];
    reshuffled = true;
  }

  const picked = new Set<number>();
  const seenDifficulties = new Set<Difficulty>();
  remaining.forEach((card, i) => {
    if (picked.size < count && !seenDifficulties.has(card.difficulty)) {
      seenDifficulties.add(card.difficulty);
      picked.add(i);
    }
  });
  for (let i = 0; i < remaining.length && picked.size < count; i++) picked.add(i);

  const indices = [...picked].sort((a, b) => a - b);
  return {
    pool: { remaining: remaining.filter((_, i) => !picked.has(i)), used },
    options: indices.map((i) => remaining[i] as Card),
    reshuffled,
  };
}

/** The chosen card is used up. The other options go back to the end of the pool for later turns. */
export function settleOptions(pool: CardPool, options: readonly Card[], chosen: Card): CardPool {
  return {
    remaining: [...pool.remaining, ...options.filter((c) => c !== chosen)],
    used: [...pool.used, chosen],
  };
}
