/**
 * The results' podium ceremony (screens.md §6): who stands where, and when each beat plays.
 * Pure, so it is unit-tested; components/PodiumCeremony plays it.
 */

export type PodiumRank = 1 | 2 | 3;

export type Step<P> = { rank: PodiumRank; players: P[] };

export type Podium<P> = {
  /**
   * Left to right: 2nd, 1st, 3rd. A place nobody holds (ties: 1, 1, 3) has no step, except 3rd in
   * a two-player match, which stays empty for the tumbleweed.
   */
  steps: Step<P>[];
  /** 4th and below, under the podium. */
  crowd: { player: P; rank: number }[];
  /** Keels over once the show is done: whoever came last, unless everyone tied for first. */
  last: P | null;
};

/** Competition ranks (1, 1, 3) by score; ties keep the server's ranking order. */
export function arrangePodium<P extends { score: number }>(ranking: readonly P[]): Podium<P> {
  const sorted = [...ranking].sort((a, b) => b.score - a.score);
  const placed = sorted.map((player) => ({
    player,
    rank: 1 + sorted.filter((other) => other.score > player.score).length,
  }));
  const steps: Step<P>[] = [];
  for (const rank of [2, 1, 3] as const) {
    const players = placed.filter((x) => x.rank === rank).map((x) => x.player);
    if (players.length > 0 || (rank === 3 && sorted.length === 2)) steps.push({ rank, players });
  }
  const bottom = placed.at(-1);
  return {
    steps,
    crowd: placed.filter((x) => x.rank > 3),
    last: bottom && bottom.rank > 1 ? bottom.player : null,
  };
}

/**
 * When each beat starts, in ms. Tuned in the prototype, then slowed to 0.75×: the podium draws
 * itself, 3rd and 2nd hop on, a drumroll, the winner drops in, the crowd waves, the awards slap
 * on, and from `idle` everyone celebrates and can be poked.
 */
export const BEATS = {
  podium: 0,
  third: 1050,
  second: 1850,
  drumroll: 2650,
  winner: 4250,
  crowd: 5050,
  awards: 6000,
  idle: 8000,
} as const;

export type Beat = keyof typeof BEATS;

export const BEAT_ORDER = Object.keys(BEATS) as Beat[];

/** Which beat brings each podium place on. */
export const ENTERS_AT: Record<PodiumRank, Beat> = { 3: 'third', 2: 'second', 1: 'winner' };

/** How long each move takes (ms), at the same 0.75×. `*Lands`: when the feet touch the step. */
export const MOVES = {
  draw: 830,
  hop: 830,
  hopLands: 580,
  drop: 1090,
  dropLands: 570,
  /** Between two players landing on the same step (a tie). */
  tieGap: 180,
  wave: 750,
  waveGap: 120,
  crown: 750,
  slap: 590,
  slapGap: 350,
  slapLands: 350,
  letters: 670,
  letterGap: 60,
  write: 1200,
  lean: 500,
  react: 870,
  keelDelay: 600,
  keel: 2400,
} as const;
