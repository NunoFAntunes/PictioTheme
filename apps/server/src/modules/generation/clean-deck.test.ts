import { classifyGuess, prepareCard } from '@pictiotheme/game-core';
import type { Card, CardKind } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import {
  buildDeck,
  cleanCards,
  cleanChaosCards,
  emptyVariety,
  isLabelledName,
  MAX_CARDS_PER_SUBJECT,
  MAX_STOCK_TWISTS,
  missingChaos,
  missingCounts,
  type CardRules,
  type RawCard,
} from './clean-deck';
import type { LlmChaosCard } from './generation.schemas';

const rules: CardRules = { kinds: ['easy', 'hard', 'chaos'], language: 'en' };
const theme = 'Halloween';

function card(text: string, overrides: Partial<RawCard> = {}): RawCard {
  return { text, kind: 'easy', alternates: [], keywords: [], ...overrides };
}

function chaos(text: string, overrides: Partial<LlmChaosCard> = {}): LlmChaosCard {
  return {
    subject: text.split(' ')[0] ?? text,
    hook: 'a trait of the subject',
    twist: text.split(' ').slice(1).join(' '),
    text,
    alternates: [],
    keywords: [],
    ...overrides,
  };
}

const saved = (text: string, kind: CardKind = 'easy'): Card => ({
  text,
  kind,
  alternates: [],
  keywords: [text.toLowerCase()],
});

describe('cleanCards', () => {
  it('keeps good cards and tidies whitespace', () => {
    const { cards } = cleanCards([card('  Witch   hat ', { keywords: ['witch', 'hat'] })], rules);
    expect(cards).toEqual([
      { text: 'Witch hat', kind: 'easy', alternates: [], keywords: ['witch', 'hat'] },
    ]);
  });

  it('drops blocked cards and blocked alternates', () => {
    const { cards, dropped } = cleanCards(
      [
        card('Bullshit detector'),
        card('Black cat', { alternates: ['pussy', 'kitty'], keywords: ['cat'] }),
      ],
      rules,
    );
    expect(cards.map((c) => [c.text, c.alternates])).toEqual([['Black cat', ['kitty']]]);
    expect(dropped.blocked).toBe(1);
  });

  it('drops cards of kinds not asked for', () => {
    const { cards, dropped } = cleanCards(
      [card('Mummy unravelling', { kind: 'chaos' }), card('Bat')],
      { kinds: ['easy', 'hard'], language: 'en' },
    );
    expect(cards.map((c) => c.text)).toEqual(['Bat']);
    expect(dropped.wrongPool).toBe(1);
  });

  it('drops cards that are too short, too long or have digits and emoji', () => {
    const { cards, dropped } = cleanCards(
      [
        card('X'),
        card('A'.repeat(41)),
        card('Friday the 13th'),
        card('Ghost 👻'),
        card("Jack-o'-lantern"),
      ],
      rules,
    );
    expect(cards.map((c) => c.text)).toEqual(["Jack-o'-lantern"]);
    expect(dropped).toMatchObject({ length: 2, characters: 2 });
  });

  it('keeps accented letters', () => {
    expect(cleanCards([card('Séance')], rules).cards).toHaveLength(1);
  });

  it('drops duplicates, including the same words in another order and existing cards', () => {
    const { cards, dropped } = cleanCards(
      [
        card('Vampire on a unicycle', { kind: 'chaos' }),
        card('Unicycle vampire', { kind: 'chaos' }),
        card('Pumpkins'),
        card('Ghost'),
      ],
      rules,
      [saved('Pumpkin')],
    );
    expect(cards.map((c) => c.text)).toEqual(['Vampire on a unicycle', 'Ghost']);
    expect(dropped.duplicate).toBe(2);
  });

  it('drops hard cards that are an easy card with a label stuck on', () => {
    const { cards, dropped } = cleanCards(
      [
        card('Cassiopeia'),
        card('Pig'),
        card('Cassiopeia snake queen', { kind: 'hard' }),
        card('Muddy pig', { kind: 'hard' }),
        card('Pig rolling in mud', { kind: 'hard' }),
        card('Cassiopeia turning a hero to stone', { kind: 'hard' }),
      ],
      rules,
    );
    expect(cards.map((c) => c.text)).toEqual([
      'Cassiopeia',
      'Pig',
      'Pig rolling in mud',
      'Cassiopeia turning a hero to stone',
    ]);
    expect(dropped.label).toBe(2);
  });

  it('dedupes alternates and drops ones equal to the text', () => {
    const { cards } = cleanCards(
      [
        card('Witch hat', {
          alternates: ['witch hat', "Witch's hat", 'Wizard hat', 'wizard  hat', '1 hat'],
        }),
      ],
      rules,
    );
    expect(cards[0]?.alternates).toEqual(['Wizard hat']);
  });

  it("keeps only keywords found in the text or alternates, else uses the text's words", () => {
    const kept = cleanCards(
      [
        card('Vampire on a unicycle', {
          kind: 'chaos',
          keywords: ['Vampire', 'dracula', 'unicycle'],
        }),
      ],
      rules,
    );
    expect(kept.cards[0]?.keywords).toEqual(['vampire', 'unicycle']);

    const fallback = cleanCards(
      [card('Mummy unravelling', { kind: 'chaos', keywords: ['pharaoh'] })],
      rules,
    );
    expect(fallback.cards[0]?.keywords).toEqual(['mummy', 'unravelling']);
  });

  it('every kept card accepts its text and alternates as a correct guess', () => {
    const { cards } = cleanCards(
      [
        card('Haunted house', { alternates: ['haunted mansion'], keywords: ['house'] }),
        card('Skeleton playing drums', {
          kind: 'chaos',
          alternates: ['skeleton drummer'],
          keywords: ['skeleton', 'drum'],
        }),
        card('Witch stirring a cauldron', {
          kind: 'hard',
          alternates: ['witch with a cauldron'],
          keywords: ['witch', 'cauldron'],
        }),
      ],
      rules,
    );
    expect(cards).toHaveLength(3);
    for (const c of cards) {
      for (const answer of [c.text, ...c.alternates]) {
        expect(classifyGuess(prepareCard(c), answer), answer).toBe('correct');
      }
    }
  });
});

describe('isLabelledName', () => {
  const easy = [['cassiopeia'], ['pig'], ['tin', 'man']];

  it('spots a name with words added that are not a scene', () => {
    expect(isLabelledName('Cassiopeia snake queen', easy, 'en')).toBe(true);
    expect(isLabelledName('Muddy pig', easy, 'en')).toBe(true);
  });

  it('lets scenes through', () => {
    expect(isLabelledName('Tin Man getting oiled', easy, 'en')).toBe(false);
    expect(isLabelledName('Pig in a mud bath', easy, 'en')).toBe(false);
    expect(isLabelledName('Cassiopeia', easy, 'en')).toBe(false);
  });

  it('only judges English', () => {
    expect(isLabelledName('Muddy pig', easy, 'de')).toBe(false);
  });
});

describe('cleanChaosCards', () => {
  it('keeps each twist once, near-repeats included', () => {
    const { cards, dropped } = cleanChaosCards(
      [
        chaos('Shredder making spaghetti'),
        chaos('Stapler eating spaghetti'),
        chaos('Laminator laminating a sandwich'),
        chaos('Printer laminating'),
      ],
      'en',
      [],
      emptyVariety(),
    );
    expect(cards.map((c) => c.text)).toEqual([
      'Shredder making spaghetti',
      'Laminator laminating a sandwich',
    ]);
    expect(cards.every((c) => c.kind === 'chaos')).toBe(true);
    expect(dropped.repeatedTwist).toBe(2);
  });

  it(`gives a subject at most ${MAX_CARDS_PER_SUBJECT} cards`, () => {
    const { cards, dropped } = cleanChaosCards(
      ['in a sauna', 'at a balloon party', 'on the moon', 'in a snowstorm'].map((twist) =>
        chaos(`Cactus ${twist}`, { subject: 'Cactus', twist }),
      ),
      'en',
      [],
      emptyVariety(),
    );
    expect(cards).toHaveLength(MAX_CARDS_PER_SUBJECT);
    expect(dropped.busySubject).toBe(1);
  });

  it(`allows at most ${MAX_STOCK_TWISTS} stock activities, judged on the twist`, () => {
    const { cards, dropped } = cleanChaosCards(
      [
        chaos('Laminator painting a fence'),
        chaos('Whiteboard flying a kite'),
        chaos('Robot doing yoga'),
        chaos('Knight mowing the lawn'),
        chaos('Dog walking its owner'),
      ],
      'en',
      [],
      emptyVariety(),
    );
    expect(cards.map((c) => c.text)).toEqual([
      'Laminator painting a fence',
      'Whiteboard flying a kite',
      'Robot doing yoga',
      'Dog walking its owner',
    ]);
    expect(dropped.stockTwist).toBe(1);
  });

  it('drops cards without a hook, and cards that repeat the deck', () => {
    const { cards, dropped } = cleanChaosCards(
      [chaos('Ghost scared of a sheet', { hook: ' ' }), chaos('Pumpkin carving a person')],
      'en',
      [saved('Pumpkin carving a person', 'chaos')],
      emptyVariety(),
    );
    expect(cards).toEqual([]);
    expect(dropped).toMatchObject({ noHook: 1, duplicate: 1 });
  });

  it('carries its limits over to a top-up', () => {
    const variety = emptyVariety();
    cleanChaosCards([chaos('Shredder making spaghetti')], 'en', [], variety);
    const topUp = cleanChaosCards([chaos('Stapler making spaghetti')], 'en', [], variety);
    expect(topUp.dropped.repeatedTwist).toBe(1);
  });
});

describe('missingCounts', () => {
  const make = (kind: CardKind, n: number): Card[] =>
    Array.from({ length: n }, (_, i) => saved(`${kind} ${i}`, kind));

  it('reports difficulties below 70% of their target, as the count needed to reach it', () => {
    // Targets: easy 50 (needs 35), hard 40 (needs 28).
    expect(missingCounts([...make('easy', 35), ...make('hard', 27)])).toEqual(
      new Map([['hard', 13]]),
    );
  });

  it('reports Chaos cards below 70% of their target', () => {
    // Target 50, needs 35.
    expect(missingChaos(make('chaos', 35))).toBe(0);
    expect(missingChaos(make('chaos', 30))).toBe(20);
  });
});

describe('buildDeck', () => {
  const cards = cleanCards([card('Bat')], rules).cards;

  it('falls back to the theme for a bad title and tags', () => {
    const deck = buildDeck(
      { title: 'X', description: 'Spooky.', tags: ['  ', 'x'.repeat(31)] },
      cards,
      theme,
    );
    expect(deck.title).toBe('Halloween');
    expect(deck.tags).toEqual(['halloween']);
  });

  it('lowercases and dedupes tags', () => {
    const deck = buildDeck(
      { title: 'Spooky Halloween', description: 'd', tags: ['Spooky', 'spooky ', 'October'] },
      cards,
      theme,
    );
    expect(deck.tags).toEqual(['spooky', 'october']);
  });
});
