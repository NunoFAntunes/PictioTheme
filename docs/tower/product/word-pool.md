# Word Pool

Doodle Tower reuses DoodleWhirl's `decks` and `cards` ([decks.md](../../product/decks.md)), but only part of them.

## Rules

- **Easy cards only** (`cards.kind = 'easy'`). Hard and Chaos cards are too slow to draw for a race.
- **Only decks on the tower allowlist** (the `tower_decks` table, see [data-model.md](../technical/data-model.md)). A deck is on the list when its easy cards are **concrete things that draw well as one object**, and when the solid shape of that object makes a sensible block.
- The default pool is **Tower Mix**: the easy cards of every enabled deck. The host can pick a single allowed deck instead.

## Initial allowlist

Based on the 14 curated decks (about 150–175 easy cards each):

| Deck | Allowed | Why |
|---|---|---|
| Animals | ✅ | Concrete, fast, and shapes vary a lot (snake, turtle, giraffe) |
| Everyday objects | ✅ | Ideal: lamp, broom, bucket |
| Food and drink | ✅ | Ideal: banana, watermelon, pizza slice |
| Places and geography | ✅ | Landmarks are towers already (Eiffel Tower, Leaning Tower) |
| Nostalgia trip | ✅ | Objects: cassette tape, floppy disk |
| Halloween | ✅ | Mostly objects and simple monsters |
| Jobs and professions | ⚠️ later | People are slow to draw, and every piece becomes a stick figure |
| Actions and expressions | ❌ | Verbs don't make a shape |
| Idioms and sayings | ❌ | Needs the category shown, and is slow |
| Movies and TV | ❌ | Needs the category, and characters look alike |
| Games and gaming / Pokémon | ❌ | Fan knowledge, and characters look alike |
| Absurd situations / Inventions nobody asked for | ❌ | Scenes, not objects |

Adding a deck is one row in `tower_decks`. There's no code change.

## Showing the category (later)

Some decks could be fun with a category shown to guessers: "🎬 a movie", "💬 a saying". `tower_decks.show_category` is there for that, but stays off for now. Decide after playtesting the object decks ([open-questions.md](../planning/open-questions.md)).

## Dealing

- One shuffled pool per match. Both crews deal from it, and a card never repeats in a match.
- Both crews must never hold the same word, or words that match each other's guesses (one card's `alternates` matching the other's text). If they did, one guess could solve both drawings. When dealing, skip cards that clash with the other crew's current card.
- When the pool runs out, reshuffle the cards already used (same rule as DoodleWhirl).
- Card stats (`times_drawn`, `times_guessed`) are only for DoodleWhirl. Tower stats go in `tower_card_stats`, because a card that's great in DoodleWhirl can be a bad block, and the other way round.
