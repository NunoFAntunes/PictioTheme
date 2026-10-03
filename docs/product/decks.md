# Decks

Decks are the game's main content. This doc covers the product side. The AI pipeline is in [../technical/ai-deck-pipeline.md](../technical/ai-deck-pipeline.md).

## What a deck is

```
Deck "Spooky Halloween"
 ├─ theme tags: halloween, spooky, october, monsters
 ├─ language: en
 ├─ family-friendly: yes
 ├─ easy (≈40 cards):    Pumpkin, Ghost, Bat, Candy, Witch hat, …
 ├─ medium (≈40 cards):  Haunted house, Scarecrow, Trick or treat, Cauldron, …
 ├─ hard (≈30 cards):    Séance, Headless horseman, Full moon rising, …
 └─ silly (≈40 cards):   Vampire on a unicycle, A ghost plowing, Realtor skeleton,
                         Werewolf at the dentist, Mummy doing yoga, …
```

Each card has:

| Field | Example | Purpose |
|---|---|---|
| `text` | `Witch hat` | What the drawer sees and what counts as the answer |
| `difficulty` | `easy` | Pool filtering and score multiplier |
| `alternates` | `["witches hat", "witch's hat"]` | Other answers that also count as correct |
| `keywords` | `["witch", "hat"]` | Used by close-guess detection and silly-card matching |
| `silly` | `false` | Whether the card belongs to the silly pool |

## Difficulty, defined

The AI and reviewers need a shared definition of each level:

| Level | Definition | Examples (Halloween) |
|---|---|---|
| **Easy** | One concrete, common noun a child could draw; recognizable from a simple shape | Pumpkin, Bat, Ghost, Moon |
| **Medium** | A specific object, character, or simple scene; 1–2 words | Haunted house, Black cat, Candy corn |
| **Hard** | Abstract, multi-part, or action/scene that needs clever drawing; can be up to 3–4 words | Séance, Headless horseman, Trick or treat |
| **Silly** | An absurd combination of a theme character/object with a mundane activity, job, or object. Should make people laugh and still be drawable | Vampire on a unicycle, Realtor skeleton, Ghost plowing a field |

Silly cards are a separate pool inside each deck, not a fourth difficulty the host has to select. Silly Mode mixes them into whatever difficulties are selected, at a ratio the host sets.

### Why silly cards come from the AI, not templates

You could build silly prompts from templates (`{monster} + {job}`), but most combinations come out flat ("Zombie accountant", "Zombie lawyer", "Zombie plumber"…). An LLM is much better at making *funny* and *drawable* combinations. We still keep a template fallback for when a deck has no silly pool. See [open-questions.md](../planning/open-questions.md).

### Guessing silly cards

"Vampire on a unicycle" is hard to type exactly. Silly cards are matched by **keywords**: if the guess contains all the key concepts (`vampire`, `unicycle`) in any order, it counts as correct. If it contains some of them, it's a close guess. Details in [guess-matching.md](../technical/guess-matching.md).

## Library and search

- **All generated decks are public** in the library (this is what drives growth). Users can make a deck *unlisted* only with a paid generation (open question).
- Search uses title, tags, and card text. Ranking = text relevance × quality score (thumbs up/down, play count, report rate).
- Results card: title, tags, flag/language, card counts per level, 🤪 if a silly pool exists, 👍 %, plays, creator name.
- "Similar decks" are shown before generation so people don't generate 40 Halloween decks: *"There are 12 Halloween decks already. Generate anyway?"*
- Featured / staff-picked decks appear on the deck picker's empty state, along with seasonal suggestions (e.g. Halloween in October).

## Quality and lifecycle

| Mechanism | How |
|---|---|
| Automatic validation | Schema check, duplicate removal, length limits, profanity/safety filter (see pipeline doc) |
| Creator review | After generation, the creator can remove cards before publishing |
| Player feedback | 👍/👎 per deck after a match. Each card can be flagged as "unfair/undrawable" from the reveal screen |
| Card stats | Track how often each card is guessed correctly. Cards with ~0% success get demoted or moved up a difficulty |
| Reports | Inappropriate content → hidden pending review once N reports arrive |
| Forking | Later: "Remix this deck" lets someone generate more cards on top of an existing deck |

## Language

v1 is English only, but the data model has a `language` field from day one. Guess matching (accent stripping, articles) depends on language, so a deck's language decides the matching rules.
