# Game Rules

## Structure

- A **match** has `R` rounds (default 3).
- In each **round**, every player draws once, in join order (rotated each round so the first drawer changes).
- Each **turn**:
  1. **Choose** (10s): the drawer sees 3 cards drawn from the active pool and picks one. If the timer runs out, a random one is used. The host can turn this off so the drawer always gets a single random card.
  2. **Draw** (default 80s): the drawer draws and the others guess.
  3. **Reveal** (5s): the answer is shown with the scores earned this turn.
- A turn ends early when **every guesser has guessed correctly**.

## Card pool

The active pool is built when the game starts:

```
pool = deck.cards where difficulty ∈ selectedDifficulties
if sillyMode: mix in deck.sillyCards at the configured ratio (e.g. 25%)
shuffle; never repeat a card within the same match
```

- If the pool runs out (small deck, many players), the room tells the host and reshuffles the cards already used.
- The 3 choice cards should, when possible, cover a spread of difficulty (e.g. one easy, one medium, one hard if all are enabled), so the drawer can choose their risk.

## Guessing

Guessers type into the guess box. Every guess goes to the server, which classifies it as one of:

| Result | What the guesser sees | What others see (visibility ON) | What others see (visibility OFF) |
|---|---|---|---|
| **Correct** | "✅ You got it!" and the word is revealed to them | "🎉 Ana guessed it!" (the guess text is never shown) | "🎉 Ana guessed it!" |
| **Close** | Their own guess in red with a "So close!" hint | `██████` in **red** next to Ana | Nothing |
| **Wrong** | Their guess, plain | The guess text next to Ana | Nothing (maybe a "…" typing indicator) |

Rules:

- When a player has guessed correctly, their later messages only go to **other players who have also guessed correctly** and the drawer, which stops them from leaking the answer. These show in a green "solved" tint.
- The drawer cannot guess or chat during their turn (chat input is disabled), so they can't type the answer.
- Rate limit: max ~3 guesses per second per player. Guesses are capped at 60 chars.
- See [../technical/guess-matching.md](../technical/guess-matching.md) for how "correct" and "close" are calculated.

### Guess visibility (host setting)

- **Show guesses** (default): wrong guesses appear as speech bubbles above the player's character in the board's margin and in the feed. It's funnier and more social.
- **Hide guesses**: players only see their own guesses and "X guessed it!" events. Use this for competitive play or streams.

The host can change this between turns.

## Hints

If hints are on, letters are revealed over time: at 50% and 75% of draw time, one random letter is shown (never the whole word, and at most ⅓ of the letters). Word lengths are always visible: `_ _ _ _ _   _ _ _ _`. Spaces, hyphens, and digits are shown from the start.

## Scoring

The scoring is simple and rewards speed:

**Guesser** who guesses correctly:
```
points = round(50 + 250 × (timeRemaining / drawTime))     // 50–300
bonus  = first correct guesser +50
```

**Drawer**:
```
points = round(200 × (correctGuessers / totalGuessers))   // 0–200
```
This rewards drawings that many people understand, and the drawer gets 0 if nobody guesses.

**Difficulty multiplier** (applied to both): easy ×1.0, medium ×1.2, hard ×1.5, silly ×1.5.

Ties at the end are broken by the number of correct guesses, then by total guess speed.

## Host controls

| Control | When |
|---|---|
| Change deck, difficulties, Silly Mode, rounds, timer, max players, public/private | Waiting room |
| Toggle guess visibility, hints | Any time (takes effect next turn) |
| Kick player | Any time |
| Skip current turn | During a turn (card is revealed, no points) |
| Pause / resume | Any time |
| Transfer host | Any time |
| End match early | Any time (shows results) |

## Player limits and moderation in-room

- 2–16 players. Default max is 10.
- **Vote kick**: if more than half the players vote, the player is removed. This protects public rooms from bad hosts and griefers.
- **Report drawing**: flags the room and the drawer for review (see security doc).
