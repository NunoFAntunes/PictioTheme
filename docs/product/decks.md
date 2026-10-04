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

## Back cover

Every deck has a back cover, like the back of a real deck of cards: a 3:4 drawing shown wherever the deck appears.

- **Drawn by the creator while the deck generates.** Generation takes about a minute, so the progress view asks "Draw the back cover of your deck" with a drawing pad. Drawing is optional (**Skip** is always there) and never races the model: if the deck finishes first, the creator is told it's ready and can finish the cover or skip. If generation fails, the drawing stays on the pad for the retry.
- **Default cover.** A deck without a drawing (curated decks until their covers are drawn, skipped covers) shows its title on a striped background, coloured from a hash of the title.
- **Shown** in the deck pickers, beside the room code in the waiting room, on the results screen, and as the back of the cards on the card-choice screen (the draw pile and the dealt cards, face down, then flipped for the drawer). A deck without a drawing shows its default cover there too, title included. Planned: the library and the preview image of a shared deck link.
- **Redrawing.** The creator can redraw their deck's cover any time from the ✏️ button on their decks in the create-room picker. The new cover replaces the old one everywhere; rooms already playing the deck pick it up the next time they load it.
- **Drawing tools.** The cover pad has the game's full drawing toolbar (sizes, opacity, fill tolerance, the whole palette, eyedropper, undo/redo and the shortcuts), with bigger buttons and a bigger pad on touch screens.
- **Reporting.** Covers are shown to strangers, so any player can report one with 🚩 on the deck (waiting room, results). Once 3 different players report the cover shown right now, it's hidden and the default cover shows instead; the deck stays playable. A redrawn cover starts with no reports. See [Quality control](#quality-control) for reporting a deck's cards.

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
- **Built so far:** the create-room picker searches titles and tags (typo-tolerant), and shows featured curated decks first. No card-text search, quality ranking or library page yet.

## Curated decks

Hand-checked decks that ship with the game, so a new player always has good decks to pick from. They live in the repo as JSON files, one per deck (`apps/server/src/modules/decks/curated/<slug>.json`), and `db:migrate` seeds them into the database: a new file adds a deck, an edited file updates it in place (same id, same cover). `featuredRank` puts a deck in the featured row (lowest first; seasonal ones lead). The first featured deck is what a new room starts with.

The first 20 (2026-10-04) are the two original hand-written decks plus 18 generated with the production model (~$0.07 in all) and checked by the same tests as any curated deck: no duplicates, every alternate guessable, enough cards per pool. They still need a human pass. They have no drawn covers: like any deck without one, they show the default title tile, decided on 2026-10-04. Curated decks can be reported, but reports never hide them automatically.

## Quality and lifecycle

| Mechanism | How |
|---|---|
| Automatic validation | Schema check, duplicate removal, length limits, profanity/safety filter (see pipeline doc) |
| Creator review | After generation, the creator can remove cards before publishing |
| Player feedback | **Built:** while choosing, the drawer can rate each of the three face-up cards 👍/👎 (it doesn't pick the card; pressing again takes the vote back). Planned: 👍/👎 per deck after a match, and flagging a card as "unfair/undrawable" from the reveal screen |
| Card stats | **Built:** per card, how often it was offered, picked by the drawer (a card nobody picks is weak; ~1 in 3 is fair), drawn, and guessed by at least one player. `metrics:report` lists the least picked, most 👎 and hardest-to-guess cards. Planned: demote or move cards automatically; for now someone reads the report and edits or removes them |
| Reports | 🚩 on the deck in the waiting room and on results: "the cover drawing is offensive" or "the cards or title are offensive". 3 reports from different players hide the cover (the default one shows) or the whole deck (it can't be picked or loaded any more) until a moderator reviews them. Curated decks are never hidden automatically: their reports wait for a moderator |
| Forking | Later: "Remix this deck" lets someone generate more cards on top of an existing deck |

## Language

v1 is English only, but the data model has a `language` field from day one. Guess matching (accent stripping, articles) depends on language, so a deck's language decides the matching rules.
