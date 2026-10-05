/**
 * The deck picker's category chips: the tags most decks share, most common first (ties
 * alphabetical). A tag on a single deck isn't a category, so it needs `minDecks` of them.
 */
export function topTags(
  decks: readonly { tags: readonly string[] }[],
  count: number,
  minDecks = 2,
): string[] {
  const tally = new Map<string, number>();
  for (const deck of decks) {
    for (const tag of new Set(deck.tags.map((t) => t.trim().toLowerCase()))) {
      if (tag) tally.set(tag, (tally.get(tag) ?? 0) + 1);
    }
  }
  return [...tally]
    .filter(([, n]) => n >= minDecks)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, count)
    .map(([tag]) => tag);
}
