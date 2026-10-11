import type { DeckLanguage } from '@pictiotheme/protocol';
import {
  ALTERNATES_RULES,
  DRAWABLE_RULES,
  GUARDRAILS,
  LANGUAGE_RULES,
  languageLine,
  UNTRUSTED_INPUT,
} from './deck-prompt';

/**
 * Prompts for a deck's Chaos cards: their own call, at generation or later for a deck without
 * them. Why it looks like this: docs/technical/ai-deck-pipeline.md#chaos-cards. In short, the old
 * "theme subject + unrelated everyday activity" recipe gave swappable cards ("Laminator painting
 * a fence"), so this one ties every twist to what its subject is.
 */

/** How many Chaos cards to ask for: a whole Chaos match plays from this pool. */
export const CHAOS_TARGET = 50;

/** Static, so providers can cache it. User input never goes in here. */
export const CHAOS_PROMPT = `You write Chaos cards for a Pictionary-style drawing game. One player draws the
card while the others try to guess it by typing. Chaos cards are the absurd, funny ones: the
deck's subjects in situations that make the room laugh while they draw and guess.

# What makes a Chaos card funny
A Chaos card puts ONE subject from the deck into a situation that plays on what that subject
IS: its shape, its body, its job, its home, its famous trait or its weakness. The joke comes
from the subject. A generic activity bolted onto a noun is not a joke.

Ways that work:
- Its trait in the wrong place: Snowman in a sauna, Cactus at a balloon party
- Its job taken too far: Paper shredder making spaghetti, Laminator laminating a sandwich
- Role reversal: Mouse chasing a cat, Carrot eating a rabbit, Dog walking its owner
- Its body used for something else: Giraffe cleaning windows, Octopus playing drums
- It suffers from its own trait: Snail getting a speeding ticket, Vampire buying sunscreen,
  Knight rusting in the rain
- The perfect job for it: Realtor skeleton (skeletons come with closets and old houses),
  Kangaroo mail carrier (the pouch), Dragon lighting birthday candles

# The swap test (every card must pass it)
Replace the subject with another subject from this deck. If the card is just as funny, it is
generic: rewrite it so that it only works for this subject.
  bad: Laminator painting a fence, Whiteboard flying a kite, Mail cart pulling a wagon,
       Knight painting a fence, Wizard mowing a lawn, Robot doing yoga
       (any subject could do these: the activity has nothing to do with the thing)
  bad: Cow accountant (the job isn't visible), Philosophical purple goose (random, not drawable)

# Bend the trait, don't just show it
The subject doing what it normally does is a hard card, not a Chaos card. Push it: the wrong
place, the wrong scale, the wrong way round, or much too far.
  bad: Spatula flipping a pancake, Frying pan frying an egg, Magikarp climbing a waterfall
       (that's just its job, or a famous moment)
  good: Spatula flipping the chef, Frying pan wearing an egg as a hat, Magikarp in a goldfish bowl

# Every card is different
- Each twist (the situation, activity, place or object the subject is paired with) appears
  at most ONCE in the deck. Near-repeats count as repeats: "riding a bike", "riding a scooter"
  and "riding a skateboard" are one joke.
- No subject in more than 3 cards. Use at least 20 different subjects.
- Stock activities are almost always generic: walking a dog, painting a fence, doing yoga,
  flying a kite, mowing the lawn, riding a bicycle, doing laundry, at a car wash, knitting,
  juggling, lifting weights, on a trampoline. Use one only when the joke is about the subject
  (a role reversal like "Dog walking its owner").
- Prefer subjects with personality: characters, animals, creatures. Use an object only when
  the joke uses what the object does or looks like.
- You don't have to use every subject, and never just go down the deck's list in order. Start
  from the subjects with the strongest traits and skip the ones without a joke.
- Never repeat a card the deck already has, as either a normal or a Chaos card.

${DRAWABLE_RULES}
- The joke must be visible in the picture: no puns or wordplay that only work as text.
- Short: 2 to 5 words. If it takes more words to explain, it's too complicated to draw.
- The subject is named the way the deck names it.

# Fields, in this order, for each card
- "subject": the deck subject the card is about, as the deck names it ("Paper shredder").
- "hook": one short line on which trait of the subject the joke plays on, and how
  ("shreds paper into strips, like spaghetti"). If you can't name a trait, the card is
  generic: drop it and write another.
- "twist": the situation the subject is put in, in 1 to 4 words ("making spaghetti").
- "text": the card itself ("Paper shredder making spaghetti").
- "alternates" and "keywords", as below. Keywords are the subject and the twist's key thing.

${ALTERNATES_RULES}

${GUARDRAILS}

${LANGUAGE_RULES}
The hook may be in English; every other field is in the deck's language.

${UNTRUSTED_INPUT}

# Method (think it through before writing the JSON)
1. From the deck's cards and its theme, pick 25 or more subjects players will recognise.
2. For each subject, list 2 or 3 defining traits: its shape, body, job, home, habit or weakness.
3. For each trait, find a situation that clashes with it, exaggerates it or turns it around.
   Keep the funniest that are still easy to picture.
4. Check every card: the swap test, one twist per deck, at most 3 cards per subject, drawable.
   Rewrite or replace the ones that fail.

# Output
Reply with JSON only, no prose and no code fences, in exactly this shape:
{
  "cards": [
    {
      "subject": "Paper shredder",
      "hook": "shreds paper into strips, like spaghetti",
      "twist": "making spaghetti",
      "text": "Paper shredder making spaghetti",
      "alternates": ["shredder making spaghetti"],
      "keywords": ["shredder", "spaghetti"]
    }
  ]
}`;

/** What Chaos cards are made from: a new deck, or a saved one getting them later. */
export type ChaosInput = {
  /** The theme the creator typed, or a saved deck's title. */
  theme: string;
  description: string;
  notes: string;
  language: DeckLanguage;
  /** The deck's easy and hard cards: the subjects to build on, and cards not to repeat. */
  deckCards: readonly string[];
  /** Chaos cards the deck already has (a top-up): no repeated twists or cards. */
  chaosCards: readonly string[];
};

/** Everything from users is JSON-encoded, so it can't break out of its field. */
export function chaosUserPrompt(input: ChaosInput, count: number): string {
  const lines = [
    `Theme: ${JSON.stringify(input.theme)}`,
    `Deck description: ${JSON.stringify(input.description)}`,
    `Notes from creator: ${JSON.stringify(input.notes)}`,
    languageLine(input.language),
    `The deck's cards (its subjects): ${JSON.stringify(input.deckCards)}`,
  ];
  if (input.chaosCards.length > 0) {
    lines.push(
      `Chaos cards it already has (repeat none of them, nor their twists): ${JSON.stringify(input.chaosCards)}`,
    );
  }
  lines.push(`Count: ${count} Chaos cards`);
  return lines.join('\n');
}
