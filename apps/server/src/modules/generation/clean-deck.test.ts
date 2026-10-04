import { classifyGuess, prepareCard } from '@pictiotheme/game-core';
import type { Card, DeckGenerationRequest, Difficulty } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { buildDeck, cleanCards, missingCounts } from './clean-deck';
import type { LlmCard } from './generation.schemas';

const request: DeckGenerationRequest = {
  theme: 'Halloween',
  notes: '',
  difficulties: ['easy', 'medium'],
  silly: true,
};

function card(text: string, overrides: Partial<LlmCard> = {}): LlmCard {
  return { text, difficulty: 'easy', silly: false, alternates: [], keywords: [], ...overrides };
}

describe('cleanCards', () => {
  it('keeps good cards and tidies whitespace', () => {
    const { cards } = cleanCards([card('  Witch   hat ', { keywords: ['witch', 'hat'] })], request);
    expect(cards).toEqual([
      {
        text: 'Witch hat',
        difficulty: 'easy',
        silly: false,
        alternates: [],
        keywords: ['witch', 'hat'],
      },
    ]);
  });

  it('drops blocked cards and blocked alternates', () => {
    const { cards, dropped } = cleanCards(
      [
        card('Bullshit detector'),
        card('Black cat', { alternates: ['pussy', 'kitty'], keywords: ['cat'] }),
      ],
      request,
    );
    expect(cards.map((c) => [c.text, c.alternates])).toEqual([['Black cat', ['kitty']]]);
    expect(dropped.blocked).toBe(1);
  });

  it('drops cards outside the requested pools', () => {
    const { cards, dropped } = cleanCards(
      [card('Seance', { difficulty: 'hard' }), card('Bat')],
      request,
    );
    expect(cards.map((c) => c.text)).toEqual(['Bat']);
    expect(dropped.wrongPool).toBe(1);

    const noSilly = cleanCards([card('Mummy doing yoga', { silly: true })], {
      ...request,
      silly: false,
    });
    expect(noSilly.cards).toEqual([]);
    expect(noSilly.dropped.wrongPool).toBe(1);
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
      request,
    );
    expect(cards.map((c) => c.text)).toEqual(["Jack-o'-lantern"]);
    expect(dropped).toMatchObject({ length: 2, characters: 2 });
  });

  it('keeps accented letters', () => {
    expect(cleanCards([card('Séance')], request).cards).toHaveLength(1);
  });

  it('drops duplicates, including the same words in another order and existing cards', () => {
    const { cards, dropped } = cleanCards(
      [
        card('Vampire on a unicycle', { silly: true, difficulty: 'medium' }),
        card('Unicycle vampire', { silly: true, difficulty: 'medium' }),
        card('Pumpkins'),
        card('Ghost'),
      ],
      request,
      [
        {
          text: 'Pumpkin',
          difficulty: 'easy',
          silly: false,
          alternates: [],
          keywords: ['pumpkin'],
        },
      ],
    );
    expect(cards.map((c) => c.text)).toEqual(['Vampire on a unicycle', 'Ghost']);
    expect(dropped.duplicate).toBe(2);
  });

  it('dedupes alternates and drops ones equal to the text', () => {
    const { cards } = cleanCards(
      [
        card('Witch hat', {
          alternates: ['witch hat', "Witch's hat", 'Wizard hat', 'wizard  hat', '1 hat'],
        }),
      ],
      request,
    );
    expect(cards[0]?.alternates).toEqual(['Wizard hat']);
  });

  it("keeps only keywords found in the text or alternates, else uses the text's words", () => {
    const kept = cleanCards(
      [
        card('Vampire on a unicycle', {
          silly: true,
          keywords: ['Vampire', 'dracula', 'unicycle'],
        }),
      ],
      request,
    );
    expect(kept.cards[0]?.keywords).toEqual(['vampire', 'unicycle']);

    const fallback = cleanCards(
      [card('Mummy doing yoga', { silly: true, keywords: ['pharaoh'] })],
      request,
    );
    expect(fallback.cards[0]?.keywords).toEqual(['mummy', 'yoga']);
  });

  it('every kept card accepts its text and alternates as a correct guess', () => {
    const { cards } = cleanCards(
      [
        card('Haunted house', {
          difficulty: 'medium',
          alternates: ['haunted mansion'],
          keywords: ['house'],
        }),
        card('Skeleton playing drums', {
          silly: true,
          alternates: ['skeleton drummer'],
          keywords: ['skeleton', 'drum'],
        }),
      ],
      request,
    );
    for (const c of cards) {
      for (const answer of [c.text, ...c.alternates]) {
        expect(classifyGuess(prepareCard(c), answer), answer).toBe('correct');
      }
    }
  });
});

describe('missingCounts', () => {
  it('reports pools below 70% of their target, as the count needed to reach it', () => {
    const make = (difficulty: Difficulty, n: number): Card[] =>
      Array.from({ length: n }, (_, i) => ({
        text: `${difficulty} ${i}`,
        difficulty,
        silly: false,
        alternates: [],
        keywords: [difficulty],
      }));
    const cards = [...make('easy', 28), ...make('medium', 27)];
    // Targets: easy 40 (needs 28), medium 40 (needs 28), silly 40 (needs 28).
    expect(missingCounts(request, cards)).toEqual(
      new Map([
        ['medium', 13],
        ['silly', 40],
      ]),
    );
  });
});

describe('buildDeck', () => {
  const cards = cleanCards([card('Bat')], request).cards;

  it('falls back to the theme for a bad title and tags', () => {
    const deck = buildDeck(
      { title: 'X', description: 'Spooky.', tags: ['  ', 'x'.repeat(31)] },
      cards,
      request,
    );
    expect(deck.title).toBe('Halloween');
    expect(deck.tags).toEqual(['halloween']);
  });

  it('lowercases and dedupes tags', () => {
    const deck = buildDeck(
      { title: 'Spooky Halloween', description: 'd', tags: ['Spooky', 'spooky ', 'October'] },
      cards,
      request,
    );
    expect(deck.tags).toEqual(['spooky', 'october']);
  });
});
