/**
 * Damerau–Levenshtein distance (optimal string alignment variant):
 * insertions, deletions, substitutions and adjacent transpositions ("pumpkni" → "pumpkin" = 1).
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const cols = b.length + 1;
  // Three rolling rows: two back (for transpositions), previous, current.
  let prevPrev = new Array<number>(cols).fill(0);
  let prev = Array.from({ length: cols }, (_, j) => j);
  let curr = new Array<number>(cols).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        (prev[j] as number) + 1, // deletion
        (curr[j - 1] as number) + 1, // insertion
        (prev[j - 1] as number) + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (prevPrev[j - 2] as number) + 1); // transposition
      }
      curr[j] = best;
    }
    [prevPrev, prev, curr] = [prev, curr, prevPrev];
  }
  return prev[b.length] as number;
}
