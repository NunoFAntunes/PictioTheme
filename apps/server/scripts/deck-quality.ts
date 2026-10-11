/**
 * Prints the automatic quality numbers (scripts/eval/quality.ts) for a set of decks: a JSON file
 * of decks (`[{ title, cards: [{ text, kind }] }]`), or an eval run's folder of results. Free: no
 * model calls.
 *
 *   pnpm --filter @pictiotheme/server deck:quality evals/results/baseline-2026-10-11/decks.json
 *   pnpm --filter @pictiotheme/server deck:quality evals/results/2026-10-11-12-00
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { acrossDecks, type QualityDeck } from './eval/quality';

async function load(path: string): Promise<QualityDeck[]> {
  if (!(await stat(path)).isDirectory()) {
    return JSON.parse(await readFile(path, 'utf8')) as QualityDeck[];
  }
  const decks: QualityDeck[] = [];
  for (const entry of await readdir(path, { recursive: true })) {
    if (!entry.endsWith('.json') || entry.endsWith('summary.json')) continue;
    const record = JSON.parse(await readFile(join(path, entry), 'utf8')) as {
      deck: QualityDeck | null;
    };
    if (record.deck) decks.push({ ...record.deck, title: entry });
  }
  return decks;
}

const path = process.argv[2];
if (!path) {
  process.stderr.write('usage: deck:quality <decks.json | eval results folder> [--per-deck]\n');
  process.exit(1);
}
const report = acrossDecks(await load(path));
const { perDeck, ...totals } = report;
process.stdout.write(
  `${JSON.stringify(process.argv.includes('--per-deck') ? report : totals, null, 2)}\n`,
);
void perDeck;
