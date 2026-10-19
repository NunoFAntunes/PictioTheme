# Game Rules

## Structure

- A **match** has `R` rounds (default 3).
- In each **round**, every player draws once, in join order (rotated each round so the first drawer changes).
- Each **turn**:
  1. **Choose** (10s): the drawer sees 3 cards drawn from the active pool and picks one, then sees it large on the canvas for a moment as the drawing starts. If the timer runs out, a random one is used, after a 1.5s grace (`chooseGraceMs`) so a last-second pick still counts. The host can turn this off so the drawer always gets a single random card: it's still shuffled and dealt from the deck (a 3.5s phase), and drawing starts when the deal ends or the drawer taps the card.
  2. **Draw** (default 120s): the drawer draws and the others guess.
  3. **Reveal** (5s): the answer is shown with the scores earned this turn.
- A turn ends early when **every guesser has guessed correctly**, or, in [rush mode](#rush), when the rush window after the first correct guess runs out.

## Card pool

A room plays in one of two **modes**, set by the host:

- **Normal** (default): the deck's easy and/or hard cards. The host picks one or both difficulties (default easy only).
- **🌀 Chaos**: only the deck's Chaos cards, the absurd ones ([decks.md](decks.md#chaos-cards)). Difficulties don't apply. The deck needs at least 10 Chaos cards; until it has them the match can't start, and the host can make them from the waiting room.

The active pool is built when the game starts:

```
pool = mode == chaos ? deck.cards where kind = chaos
                     : deck.cards where kind ∈ selectedDifficulties
shuffle; never repeat a card within the same match
```

- If the pool runs out (small deck, many players), the room tells the host and reshuffles the cards already used.
- When both difficulties are on, the 3 choice cards include one easy and one hard card, so the drawer can choose their risk; the third is any card.

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

If hints are on, a few letters are revealed as time goes by. Word lengths are always visible: `_ _ _ _ _   _ _ _ _`. Spaces, hyphens, and digits are shown from the start.

- **How many**: one per 5 letters (rounded up), and never more than a third of any word's letters, so words of 1–2 letters ("on", "a") get none and no word is ever given away.

  | Card | Letters | Hints |
  |---|---|---|
  | Cat, Moon | 3, 4 | 1 |
  | Pumpkin | 7 | 2 |
  | Haunted house | 12 | 3 |
  | Headless horseman | 16 | 4 |
  | Vampire on a unicycle | 18 | 4 |

- **When**: spread evenly from ½ to ⅘ of the draw time (a single hint shows at ½).
- **Which letters**: they go round the words, so a phrase gets a letter in each word before a second one in any. A word's first letter is revealed last because it gives the most away.

## Scoring

Guessers are rewarded for speed and for being first. Drawers are rewarded for drawings that get understood, and for being brave enough to pick hard cards.

**Guesser** who guesses correctly:
```
points = (speed + order bonus) × card multiplier
speed  = 100 + 200 × (timeRemaining / drawTime)            // 100–300
order bonus = 1st +100, 2nd +50, 3rd +25
```
A correct guess at the buzzer is still worth 100.

**Drawer**:
```
points = 50 × guessers × min(1, solvedShare / ½) × drawer multiplier
```
- `guessers` is the number of guessers in the room at the end of the turn: those still connected, plus anyone who solved and left. It counts as at least 2 and at most 8, so a drawing is worth 100–400 points before the multiplier.
- The drawer gets **full points once half the guessers get it**. More guessers don't add more points: a drawing everyone gets straight away isn't better than one half the room gets. Fewer guessers do cost points, and the drawer gets **0 if nobody guesses**.
- Speed doesn't count for the drawer, because it would favour the easiest cards again.
- Why everyone guessing isn't penalised: it would pay the drawer to draw badly on purpose, and the guessers would lose out.

**Card multipliers**:

| | Easy | Hard | Chaos |
|---|---|---|---|
| Guessers | ×1.0 | ×1.5 | ×1.5 |
| Drawer | ×1.0 | ×2.0 | ×2.0 |

The drawer's multiplier is steeper because the drawer chose the risk. A hard card only a quarter of the room gets pays the drawer as much as an easy card everyone gets, and a hard card half the room gets pays twice as much. So picking "Bat" over "Headless horseman" is never the safe bet.

Roughly, drawing makes up a quarter to a third of a player's score in a room of 4–8.

Ties at the end are broken by the number of correct guesses, then by total guess speed.

**Awards** at the end of a match:
- ⚡ **Fastest guesser**: the lowest average time to a correct guess.
- 🎨 **Best drawer**: the most drawer points.
- ❤️ **Crowd favourite**: the drawer of the match's most-liked drawing. A tie goes to the earlier drawing, and a drawing nobody liked doesn't count.

Awards don't score points.

## Game styles

The house rules open on a **simple view** (built 2026-10-19): four ready-made games that set the length, the cards and every rule at once. A room starts as the **Easy game**.

| Style | Length | Cards | Rush | Hints, show guesses, pick from 3 |
|---|---|---|---|---|
| 🐣 Quick and easy | Quick (2 × 60s) | Easy | Off | On |
| 🎈 Easy game | Classic (3 × 120s) | Easy | Off | On |
| 🎯 Standard game | 3 × 120s | Mixed | On | On |
| 🌀 Chaos mode | 3 × 180s | Chaos (needs the deck's [Chaos cards](decks.md#chaos-cards)) | On | On |

The styles are a web shortcut, not a setting: the server only sees the settings they write. Settings changed in **All rules** (the full view, a switch beside the heading) match no style. Each player flips between the two views for themselves.

## Rush

**Rush** is a host setting, off by default. It can be changed during a match and takes effect from the next turn. When the first correct guess comes in:

- **The clock drops** to the rush window: a quarter of the draw time, between 15 and 30 seconds (30s at the default 120s). If less time than that is left, the clock stays as it is.
- **Points drain** over the window. A guess is worth what the first guesser's speed points were at the start of the window, falling to 100 when the window ends. The order bonus and card multiplier apply as usual. The first guesser gets the normal points.
- **Everyone sees a bar** under the word that drains with the time left. Players who haven't guessed also see what a guess is worth right now. The feed says "⚡ Rush! 20 seconds left to guess."
- If nobody has seen a hint yet, **one letter is revealed** as the rush starts, so slower players still have a chance. Later hints still show if their time comes before the window ends.
- The turn still ends early if everyone gets it. Pausing freezes the window.
- The drawer scores the same way as without rush.

## Likes and the room cover

- While a drawing is being made and at its reveal, every player except the drawer can **❤️ like** it (once; pressing again takes it back). The button sits in the board's corner and shows the count; the drawer sees "N people like your drawing".
- Likes don't score points. They pick the **room's cover**: the drawing with the most likes so far, cut out of the white background, shown (gently boiling, like the players) on the room's note on the home page.
- A drawing replaces the cover only with **strictly more** likes: a tie keeps the older one. A drawing nobody liked never becomes the cover.
- The picture comes from the drawer's browser as the reveal ends (the server keeps strokes, not images). If the drawer has left by then, the cover stays as it was.

## Deck votes

The host picks the deck, but everyone else can say what they'd like to play next.

- **Before a match and at its results**, players see **🙋 Vote for the next deck!**. It opens the deck library the host picks from (search, categories, featured, community and their own decks). Tapping a deck **holds it up on a paddle** beside their doodle in the player list, for everyone to see. Tapping another changes it; "Put my paddle down" takes it back.
- Under the button, everyone sees **the votes so far**: each voted deck with how many votes and who voted, most voted first. The host's deck library shows the count on each voted deck's cover (🙋 2).
- **The host decides**: nothing is picked automatically. The host can play a voted deck straight from a player's paddle or with **Play it** in the votes, or ignore them. The host doesn't get the vote button (they pick directly), though a player who becomes host keeps their paddle.
- Votes are **for the next match**: they all go down when it starts. A player who leaves the room takes their paddle with them; a reconnect keeps it.

## Emotes

Just for fun: players taunt each other with animated actions. They never change the game.

- **Click a character** in the margin to open the emote wheel around it. Your own character offers **solo** emotes: 💃 Dance, 😜 Taunt, 💪 Flex, 😭 Cry (your character acts them out). Anyone else's offers **targeted** ones: 🥞 Squish (you leap over and flatten them), 🖐️ Slap (you walk over and slap them; they see stars), 🍅 Tomato (you throw one and it splats on them), 🤗 Hug.
- Everyone sees the animation, and the feed says so ("Ana slapped Bo!", "Bo busted a move!").
- Any phase, the drawer included. Not at players who are away.
- **Against spam**, each player has **3 charges** (⚡, shown on the wheel). An emote uses one; they come back **one every 20 s**, and there are **2.5 s** between two emotes. Leaving and rejoining doesn't refill them. The constants are `EMOTE_*` in `packages/protocol/src/emote.ts`.
- With reduced motion there's no animation, only the sound and the feed line.

## Host controls

| Control | When |
|---|---|
| Change deck, mode (Normal / Chaos), difficulties, rounds, timer, max players, public/private | Waiting room |
| Toggle guess visibility, hints, rush | Any time (takes effect next turn) |
| Kick player | Any time |
| Skip current turn | During a turn (card is revealed, no points) |
| Pause / resume | Any time |
| Transfer host | Any time |
| End match early | Any time (shows results) |
| Close the room | Any time (🚪 in the room header, after a confirm). A running match is ended first; everyone sees "The host closed this room" and the code stops working |

## Player limits and moderation in-room

- 2–16 players. Default max is 10.
- **Vote kick**: if more than half the players vote, the player is removed. This protects public rooms from bad hosts and griefers.
- **Report drawing**: flags the room and the drawer for review (see security doc).
