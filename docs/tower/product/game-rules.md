# Game Rules

All timings and sizes are starting values to tune in the [sandbox](../planning/roadmap.md#phase-0-sandbox). The [summary table](#timers-and-defaults) lists them all.

## Crews

- Two crews, 2–6 players each, 4 players minimum. Crew sizes may differ by at most one.
- In the waiting room, players pick a crew or press **Shuffle crews**. The host can move players between crews.
- Someone who joins mid-match joins the smaller crew. Someone who leaves mid-round as the drawer ends that round with no piece.

## Rounds

Each crew runs its own rounds, back to back, for the whole match:

1. **Deal**: the next drawer (round-robin through the crew, in join order) gets **one word**. There's no choice of cards, so rounds stay fast. The two crews never hold the same word at the same time (see [word-pool.md](word-pool.md#dealing)).
2. **Draw** (max 60s): the drawer draws. Their own crew and the other crew guess.
3. **Solved**: the first correct guess ends the round. The solver chooses Build or Send.
4. **Expired**: if nobody guesses within 60s, the drawing is thrown away. There's no piece, and the next round starts.

A new round starts as soon as the previous one ends. The drawer changes **every round**, even when the drawing expired.

## Guessing

- Each guesser sees two drawings: **their crew's** (large) and the **other crew's** (the small "spy window").
- The guess box always targets the drawing that's **in focus**. `Tab` (or tapping the other drawing) swaps which drawing is large. Spying means taking your eyes off your own crew's drawing.
- Guesses are **private to the crew**. Teammates see each other's guesses in the crew feed. The other crew never sees them, or they'd learn the answer.
- Guess matching reuses DoodleWhirl's classifier ([guess-matching.md](../../technical/guess-matching.md)): correct, close or wrong. "So close!" is shown only to the guesser, and only for their own crew's drawing.
- **Home advantage**: after 20s, your crew sees the word's letter mask with one letter revealed (`_ _ _ _ E`), and a second letter at 40s. Stealers see no hints.
- The drawer can't guess or chat. Players who are placing a piece can't guess while they place.
- Rate limit: about 3 guesses per second, 60 characters max (as in DoodleWhirl).

## Stealing

- A correct guess at the other crew's drawing is a **steal**. The stealer becomes the solver of that piece, with the same Build or Send choice. The robbed crew's round ends with no piece for them.
- A wrong steal guess puts that player's steal guesses on a **2s cooldown**. Guesses at their own crew's drawing stay unaffected.
- Both crews get a banner: "🦝 Teal stole your *bridge*!" / "🦝 You stole Orange's *bridge*!".
- The robbed drawer gets no penalty. The next round starts as normal.

## Build or Send

- The solver gets **5s** to choose. Everyone in the solver's crew sees the piece's actual shape (its filled silhouette) while they decide.
- 🧱 **Build**: the piece joins the end of the **solver's crew's** queue, and the solver places it.
- 💣 **Send**: the piece joins the end of the **other crew's** queue. **The receiving crew places it.** It's marked with a "sent by Orange" tag.
- If the timer runs out, it's **Build**.

## Placing

- Each tower places **one piece at a time**, first-in first-out from its queue.
- Who places:
  - A built piece is placed by its solver, if they're free.
  - A sent piece is placed by the receiving crew's free guesser who has placed the fewest pieces this match.
  - Otherwise, any free guesser in that crew. The drawer is never the placer.
  - "Free" means not drawing and not already placing. If nobody is free, the piece waits.
- The piece appears at the top of the view, hanging from the crane. The placer has **15s**:
  - `←` / `→` (or drag): move sideways
  - `Q` / `E` (or the rotate buttons): rotate in 15° steps
  - `↓` (hold): lower faster
  - `Space`: drop now
- The piece lowers slowly on its own while it's being placed. It becomes a normal physics body when the placer drops it, when it touches the tower, or when the 15s run out.
- A guide line shows where the piece would land if dropped straight down.

## Fumbles

A **fumble** is a piece falling below the platform. It doesn't matter whether it was the piece being placed or part of the tower collapsing.

- The piece is gone for good.
- The crew is **dazed for 5s**: it can't start placing pieces, and its queue waits. A piece already being placed carries on. Guessing and drawing carry on.
- If more pieces fall during a daze, each one adds 2s, up to 10s in total.
- A sent piece that falls off still dazes the **receiving** crew. Sending awkward shapes is a real attack.

This is the timeout you suggested. Whether it should also pause guessing is open ([open-questions.md](../planning/open-questions.md)).

## Winning: topping out

- Each tower has the same platform width and the same height line (set by the host: short, medium or tall).
- A tower's height is the top of its **settled** pieces that stand on the platform. The piece being placed doesn't count.
- When a tower goes above the line, a **3s topping-out countdown** starts, shown to both crews. If the tower stays above the line until the countdown ends, that crew wins. If it drops below (a collapse or a fumble), the countdown resets.
- While a crew is topping out, the other crew can still Send pieces at it. A last-second cactus is part of the game.
- Safety valve: after 15 minutes, the taller tower wins.

## Timers and defaults

| Setting | Default | Host can change |
|---|---|---|
| Round (drawing) time | 60s | 45 / 60 / 90s |
| Hint letters | at 20s and 40s | no |
| Build-or-Send choice | 5s, defaults to Build | no |
| Placement time | 15s | no |
| Steal cooldown after a wrong steal | 2s | no |
| Fumble daze | 5s (+2s per extra piece, max 10s) | off / 5s / 8s |
| Topping out | 3s above the line | no |
| Height line | medium | short / medium / tall |
| Match time limit | 15 min, then the taller tower wins | no |
| Steals | on | on / off |
| Word pool | Tower Mix (all enabled decks) | one deck from the allowlist |

## What players see after the match

The results screen shows both towers side by side, with each piece labelled with its word and its drawer. It gives out a few awards: Best steal, Meanest send, Most pieces placed, Fastest guess. The host can start a rematch with the same crews, or with shuffled crews.
