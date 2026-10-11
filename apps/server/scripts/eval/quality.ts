import { meaningfulWords, tokenize } from '@pictiotheme/game-core';
import type { DeckLanguage } from '@pictiotheme/protocol';
import { isLabelledName } from '../../src/modules/generation';

/**
 * Automatic quality signals for decks (ai-deck-pipeline.md#evaluation), for the eval and for
 * `deck:quality`. The Chaos ones measure what the 2026-10 review found: "[noun] + [stock
 * activity]" cards ("walking a dog" on 25 decks). Human (blind) grading covers the rest.
 */

/** A card as the report reads it. Old decks may still say `medium`. */
export type QualityCard = { text: string; kind: string };
export type QualityDeck = { title: string; language?: DeckLanguage; cards: QualityCard[] };

/** The stock activities the old prompt leaned on, as word prefixes. */
const STOCK = [
  ['walk', 'dog'],
  ['paint', 'fence'],
  ['yoga'],
  ['kite'],
  ['mow'],
  ['bicycle'],
  ['scooter'],
  ['skateboard'],
  ['unicycle'],
  ['laundry'],
  ['car', 'wash'],
  ['knit'],
  ['juggl'],
  ['tennis'],
  ['basketball'],
  ['lemonade'],
  ['dish'],
  ['surf'],
  ['trampoline'],
];

const words = (text: string) => meaningfulWords(tokenize(text));

/**
 * A Chaos card's subject and twist, guessed from its text: the longest easy card it starts
 * with, else its first word ("Laminator painting a fence" → "painting fence").
 */
export function splitChaos(
  text: string,
  easy: readonly string[][],
): { subject: string; twist: string } {
  const tokens = words(text);
  const subject =
    easy
      .filter((e) => e.length < tokens.length && e.every((w, i) => tokens[i] === w))
      .sort((a, b) => b.length - a.length)[0] ?? tokens.slice(0, 1);
  return { subject: subject.join(' '), twist: tokens.slice(subject.length).join(' ') };
}

const isStock = (twist: string) =>
  STOCK.some((stock) => stock.every((p) => twist.split(' ').some((w) => w.startsWith(p))));

const share = (n: number, of: number) => (of === 0 ? null : +(n / of).toFixed(3));

export function deckQuality(deck: QualityDeck) {
  const of = (kind: string) => deck.cards.filter((c) => c.kind === kind);
  const easy = of('easy').map((c) => tokenize(c.text));
  const chaos = of('chaos').map((c) => splitChaos(c.text, easy));
  const twistCounts = new Map<string, number>();
  for (const c of chaos) twistCounts.set(c.twist, (twistCounts.get(c.twist) ?? 0) + 1);
  const subjectCounts = new Map<string, number>();
  for (const c of chaos) subjectCounts.set(c.subject, (subjectCounts.get(c.subject) ?? 0) + 1);
  const labelled = (kind: string) =>
    of(kind).filter((c) => isLabelledName(c.text, easy, deck.language ?? 'en')).length;
  const avgWords = (kind: string) => {
    const cards = of(kind);
    if (cards.length === 0) return null;
    return +(cards.reduce((n, c) => n + c.text.split(' ').length, 0) / cards.length).toFixed(2);
  };
  return {
    counts: {
      easy: of('easy').length,
      medium: of('medium').length,
      hard: of('hard').length,
      chaos: chaos.length,
    },
    avgWords: { easy: avgWords('easy'), hard: avgWords('hard'), chaos: avgWords('chaos') },
    /** Hard (and old medium) cards that are an easy card with a label stuck on. */
    labelShare: {
      medium: share(labelled('medium'), of('medium').length),
      hard: share(labelled('hard'), of('hard').length),
    },
    chaosStockShare: share(chaos.filter((c) => isStock(c.twist)).length, chaos.length),
    /** Chaos cards whose twist another card of the same deck has too. */
    chaosRepeatedTwists: [...twistCounts.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0),
    chaosDistinctSubjects: subjectCounts.size,
    chaosTopSubjectShare: share(Math.max(0, ...subjectCounts.values()), chaos.length),
    twists: chaos.map((c) => c.twist),
  };
}

/** The numbers across decks, and the twists repeated the most between decks. */
export function acrossDecks(decks: QualityDeck[]) {
  const each = decks.map((d) => ({ title: d.title, ...deckQuality(d) }));
  const twistDecks = new Map<string, number>();
  for (const d of each)
    for (const t of new Set(d.twists)) twistDecks.set(t, (twistDecks.get(t) ?? 0) + 1);
  const chaosCards = each.reduce((n, d) => n + d.counts.chaos, 0);
  const weighted = (
    pick: (d: (typeof each)[number]) => number | null,
    weight: (d: (typeof each)[number]) => number,
  ) => {
    const total = each.reduce((n, d) => n + weight(d), 0);
    return total === 0
      ? null
      : +(each.reduce((n, d) => n + (pick(d) ?? 0) * weight(d), 0) / total).toFixed(3);
  };
  return {
    decks: each.length,
    chaosCards,
    chaosStockShare: weighted(
      (d) => d.chaosStockShare,
      (d) => d.counts.chaos,
    ),
    chaosRepeatedTwistsPerDeck: +(
      each.reduce((n, d) => n + d.chaosRepeatedTwists, 0) / Math.max(1, each.length)
    ).toFixed(2),
    mediumLabelShare: weighted(
      (d) => d.labelShare.medium,
      (d) => d.counts.medium,
    ),
    hardLabelShare: weighted(
      (d) => d.labelShare.hard,
      (d) => d.counts.hard,
    ),
    /** Twists found on the most decks: "walking dog" on 19 of 22 is the problem. */
    topTwists: [...twistDecks].sort((a, b) => b[1] - a[1]).slice(0, 12),
    perDeck: each.map(({ twists: _, ...d }) => d),
  };
}
