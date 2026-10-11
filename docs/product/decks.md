# Decks

Decks are the game's main content. This doc covers the product side. The AI pipeline is in [../technical/ai-deck-pipeline.md](../technical/ai-deck-pipeline.md).

## What a deck is

```
Deck "Spooky Halloween"
 ├─ theme tags: halloween, spooky, october, monsters
 ├─ language: en
 ├─ family-friendly: yes
 ├─ easy (≈50 cards):    Pumpkin, Ghost, Bat, Witch, Broom, …
 ├─ hard (≈40 cards):    Witch on a broom, Werewolf howling, Bobbing for apples, …
 └─ chaos (≈50 cards):   Vampire buying sunscreen, Realtor skeleton, … (optional)
```

Each card has:

| Field | Example | Purpose |
|---|---|---|
| `text` | `Witch hat` | What the drawer sees and what counts as the answer |
| `kind` | `easy` | `easy`, `hard` or `chaos`. Pool filtering and score multiplier |
| `alternates` | `["witches hat", "witch's hat"]` | Other answers that also count as correct |
| `keywords` | `["witch", "hat"]` | Used by close-guess detection and concept matching on hard and Chaos cards |

## Back cover

Every deck has a back cover, like the back of a real deck of cards: a 3:4 drawing shown wherever the deck appears.

- **Drawn by the creator while the deck generates.** Generation takes about a minute, so the progress view asks "Draw the back cover of your deck" with a drawing pad. Drawing is optional (**Skip** is always there) and never races the model: if the deck finishes first, the creator is told it's ready and can finish the cover or skip. If generation fails, the drawing stays on the pad for the retry.
- **Default cover.** A deck without a drawing (curated decks until their covers are drawn, skipped covers) shows its title on a striped background, coloured from a hash of the title.
- **Shown** in the deck pickers, beside the room code in the waiting room, on the results screen, and as the back of the cards on the card-choice screen (the draw pile and the dealt cards, face down, then flipped for the drawer). A deck without a drawing shows its default cover there too, title included. Planned: the library and the preview image of a shared deck link.
- **Redrawing.** The creator can redraw their deck's cover any time from the ✏️ button on their decks in the deck picker (waiting room). The new cover replaces the old one everywhere; rooms already playing the deck pick it up the next time they load it.
- **Drawing tools.** The cover pad has the game's full drawing toolbar (sizes, opacity, fill tolerance, the whole palette, eyedropper, undo/redo and the shortcuts), with bigger buttons and a bigger pad on touch screens.
- **Reporting.** Covers are shown to strangers, so any player can report one with 🚩 on the deck (waiting room, results). Once 3 different players report the cover shown right now, it's hidden and the default cover shows instead; the deck stays playable. A redrawn cover starts with no reports. See [Quality control](#quality-control) for reporting a deck's cards.

## Card kinds

Every card is one of three kinds. Easy and hard are the normal game; Chaos cards are a separate mode (game-rules.md#card-pool). The AI and reviewers need a shared definition of each:

| Kind | Definition | Examples |
|---|---|---|
| **Easy** | "Name it": one iconic thing, 1–3 words. For a franchise theme, its most famous characters, items and places, not deep cuts. Never a name with a label stuck on ("Cassiopeia snake queen", "Muddy pig") | Farm: Cow, Tractor, Scarecrow. Wizard of Oz: Dorothy, Tin Man, Ruby slippers |
| **Hard** | "Show it": a small scene, 2–5 words. A subject doing something, or two things in a meaningful relationship, that comes from what the subject is known for. It passes the swap test: swapping in another subject from the theme shouldn't make equal sense | Farm: Milking a cow, Fox sneaking into a henhouse. Wizard of Oz: Dorothy clicking her heels, Tin Man getting oiled |
| **Chaos** | An absurd card: one subject from the deck in a situation that plays on what it *is* (its shape, body, job, home, famous trait or weakness), bent the wrong way (wrong place, wrong scale, reversed, taken too far). Should make people laugh and still be drawable | Snowman in a sauna, Mouse chasing a cat, Vampire buying sunscreen, Realtor skeleton, Spatula flipping the chef |

A deck has about 50 easy and 40 hard cards. There is no medium any more: it was removed on 2026-10-11 and the old medium cards became easy.

## Chaos cards

Chaos cards have no difficulty. Chaos mode deals only them; normal mode never does.

- **Not every deck has them.** The generate form has a "🌀 Chaos cards too" box, on by default, and makes about 50. If that part fails, the deck is saved without them.
- **Added later by any host.** In Chaos mode, a deck without them shows "🌀 Make Chaos cards" in the host's deck library. The cards are saved on the deck for everyone who plays it, and every room playing the deck reloads it. Adding them doesn't make the deck yours. Two hosts asking at the same time wait on the same job. Limits: 5 per player and 15 per IP a day, within the shared daily budget.
- **A Chaos match needs at least 10** (`CHAOS_MIN_CARDS`).
- **Per language.** A translation is its own deck, so it gets its own Chaos cards, written natively in that language rather than translated.
- **What makes a good one.** The twist comes from the subject: "Giraffe cleaning windows", "Kangaroo mail carrier", "Paper shredder making spaghetti". A generic activity bolted on ("Laminator painting a fence", "Whiteboard flying a kite") is bad, because any subject could do it; so is the subject just doing its normal job. Cleanup enforces it (ai-deck-pipeline.md): each twist at most once per deck (near repeats count), at most 3 cards per subject, at most 3 stock activities per deck (walking a dog, painting a fence, yoga, a kite…), and every card names the trait its joke plays on.

The old "silly cards" (a pool mixed into the normal game at a ratio) were replaced by Chaos mode on 2026-10-11. They were weak, so they were all deleted.

### Guessing hard and Chaos cards

"Vampire buying sunscreen" is hard to type exactly. Hard and Chaos cards are matched by **concepts**: if the guess contains all the key words (`vampire`, `sunscreen`) in any order, it counts as correct ("cow milking" for "Milking a cow"). If it contains at least half of them, it's a close guess. Easy cards still need the words in order. Details in [guess-matching.md](../technical/guess-matching.md).

## Library and search

- **All generated decks are public** in the library (this is what drives growth). Users can make a deck *unlisted* only with a paid generation (open question).
- Search uses title, tags, and card text. Ranking = text relevance × quality score (thumbs up/down, play count, report rate).
- Results card: title, tags, flag/language, card counts per kind, 🌀 if the deck has Chaos cards, 👍 %, plays, creator name.
- "Similar decks" are shown before generation so people don't generate 40 Halloween decks: *"There are 12 Halloween decks already. Generate anyway?"*
- Featured / staff-picked decks appear on the deck picker's empty state, along with seasonal suggestions (e.g. Halloween in October).
- **Built so far:** the deck picker (host, waiting room) searches titles and tags (typo-tolerant), and shows featured curated decks first. No card-text search, quality ranking or library page yet.

## Curated decks

Hand-checked decks that ship with the game, so a new player always has good decks to pick from. They live in the repo as JSON files, one per deck (`apps/server/src/modules/decks/curated/<slug>.json`), and `db:migrate` seeds them into the database: a new file adds a deck, an edited file updates it in place (same id, same cover). `featuredRank` puts a deck in the featured row (lowest first; seasonal ones lead). The first featured deck is what a new room starts with.

The current 14 (2026-10-11) replaced the first 20 (generated, never hand-checked) and were written by hand, without the generation pipeline: Halloween (featured first in October), Animals, Everyday objects, Food & drink, Pokémon, Games & gaming, Movies & TV, Actions & expressions, Places & geography (spread around the globe, ~10% North America), Nostalgia trip, Jobs & professions, Idioms & sayings, and two silly decks without Chaos cards because the whole deck is already absurd (Inventions nobody asked for, Absurd situations). Each has 150+ easy and 150+ hard cards and, where it has them, 150+ Chaos cards (up to `CURATED_MAX_CARDS`, 600), so a room rarely sees a card twice. They have no drawn covers: like any deck without one, they show the default title tile, decided on 2026-10-04. Curated decks can be reported, but reports never hide them automatically.

## Quality and lifecycle

| Mechanism | How |
|---|---|
| Automatic validation | Schema check, duplicate removal, length limits, profanity/safety filter (see pipeline doc) |
| Creator review | After generation, the creator can remove cards before publishing |
| Player feedback | **Built:** while choosing, the drawer can rate each of the three face-up cards 👍/👎 (it doesn't pick the card; pressing again takes the vote back). Planned: 👍/👎 per deck after a match, and flagging a card as "unfair/undrawable" from the reveal screen |
| Card stats | **Built:** per card, how often it was offered, picked by the drawer (a card nobody picks is weak; ~1 in 3 is fair), drawn, and guessed by at least one player. `metrics:report` lists the least picked, most 👎 and hardest-to-guess cards. Planned: demote or move cards automatically; for now someone reads the report and edits or removes them |
| Reports | 🚩 on the deck in the waiting room and on results: "the cover drawing is offensive" or "the cards or title are offensive". 3 reports from different players hide the cover (the default one shows) or the whole deck (it can't be picked or loaded any more) until a moderator reviews them. Curated decks are never hidden automatically: their reports wait for a moderator |
| Forking | Later: "Remix this deck" lets someone generate more cards on top of an existing deck |

## Languages

Built 2026-10-07. Every room plays in one language, and every deck is written in one.

- **The room's language** is a house rule the host sets on the room card ("Cards in: 🇩🇪 Deutsch"): they open the flag, type a language ("deutsch", "portug…", "日本") and pick it. Players see the flag. It's remembered in the host's browser, so their next room (and Quick play, which only matches public rooms in that language) starts in it. Public room notes on the home page show the flag of rooms not in English.
- **Which languages**: 27, in `DECK_LANGUAGES` (`protocol/src/language.ts`), with regional variants where decks really differ (Spain / Latin American Spanish, Portugal / Brazilian Portuguese, Simplified / Traditional Chinese). Only languages the model writes well and whose script the game handles: guessing, hints and the word mask work per letter and split words on spaces, so right-to-left scripts (Arabic, Hebrew) and scripts built from combining marks (Hindi, Bengali, Thai) are left out until they're tested.
- **Curated decks are in English.** A deck that isn't in the room's language is marked "needs translating" in the library. Picking one, or keeping the room's deck after changing the language, shows a note to everyone and asks the host to translate it; the match can't start until the deck is in the room's language.
- **Translations** are made by the AI from the original, never from another translation (ai-deck-pipeline.md#translation). Names stay ("Mario"), franchises use their local official names (Pokémon in German: "Glumanda", not "Charmander"), cards that only work in English (puns, things unknown there) are dropped, and every card keeps its kind. A translation is saved once and shared: the next room in that language gets it straight away, and two hosts asking at the same time wait on the same one. It keeps the original's cover. If fewer than 60% of the cards survive, the translation fails ("doesn't translate well into that language").
- **Generated decks** are written in the room's language, as a rule for the model. The theme and notes must be in that language too: a theme in another language, or one too unclear for a good deck (gibberish, "stuff", "my cousin's birthday"), is refused before anything is generated, and doesn't use up the daily deck (ai-deck-pipeline.md#theme-check).
- **Limits**: translating counts apart from generating: 5 new translations per player and 15 per IP a day, within the same daily budget. Picking a deck someone already translated is free.
- **Guess matching** runs the same normalization for every language: lowercase, accents and other marks stripped, punctuation removed. Plural folding and dropping a leading "a/the" are English rules; other languages rely on the model's alternates for plurals and articles. Japanese kana with dakuten match their plain kana (が = か), which only makes guessing a little more forgiving.
