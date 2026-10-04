export type Ranked<P> = { player: P; rank: number };

/**
 * Highest score first, with competition ranks (1, 1, 3). Ties keep the incoming (join) order.
 * Display only: the drawing order is the server's `turnOrder`, which this never touches.
 */
export function rankByScore<P extends { score: number }>(players: readonly P[]): Ranked<P>[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((player) => ({
    player,
    rank: sorted.findIndex((other) => other.score === player.score) + 1,
  }));
}

/** Ids now ranked strictly ahead of someone who was strictly ahead of them before. */
export function overtakers(
  before: ReadonlyMap<string, number>,
  after: readonly Ranked<{ id: string }>[],
): Set<string> {
  const ids = new Set<string>();
  for (const x of after) {
    const xBefore = before.get(x.player.id);
    if (xBefore === undefined) continue;
    const passed = after.some((y) => {
      const yBefore = before.get(y.player.id);
      return yBefore !== undefined && yBefore < xBefore && x.rank < y.rank;
    });
    if (passed) ids.add(x.player.id);
  }
  return ids;
}
