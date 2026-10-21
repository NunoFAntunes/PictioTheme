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
3. **Solved**: the first correct guess ends the round. The next drawer starts (in a crew of two, that's the solver), and the drawer, free now, chooses Keep or Curse.
4. **Expired**: if nobody guesses within 60s, the drawing is thrown away. There's no piece, and the next round starts.

A new round starts as soon as the previous one ends. The drawer changes **every round**, even when the drawing expired.

## Guessing

- Each guesser sees **their crew's** drawing big in the middle, and the **other crew's** small, up in the sky of that crew's tower. Spying means taking your eyes off your own crew's drawing.
- There's **one guess line** for both. A guess is checked against your crew's drawing first; if it isn't right there (and steals are on), against the other crew's.
- Guesses are **private**. There's no guess log or chat on screen, only the guess line (2026-10-20): the other crew must never see them, or they'd learn the answer.
- Guess matching reuses DoodleWhirl's classifier ([guess-matching.md](../../technical/guess-matching.md)): correct, close or wrong. "So close!" is shown only to the guesser, and only for their own crew's drawing.
- **Home advantage**: nothing at first, so the drawer gets a head start. After 20s (a third of the round), your crew sees the word's letter mask with one letter revealed (`_ _ _ _ E`), and a second letter at 40s. Stealers see no hints.
- The drawer can't guess or chat. Players who are placing a piece can't guess while they place.
- Rate limit: about 3 guesses per second, 60 characters max (as in DoodleWhirl).

## Stealing

- A guess that's right for the other crew's drawing (and not your own) is a **steal**, typed in the same guess line. The piece is the thief's: **the thief** makes the Keep or Curse choice (the drawer is on the other crew), and places it if they keep it. The robbed crew's round ends with no piece for them.
- There's no steal cooldown: since every guess is also a steal attempt, a cooldown would slow down guessing your own crew's drawing.
- Both crews get a banner: "🦝 Teal stole your *bridge*!" / "🦝 You stole Orange's *bridge*!".
- The robbed drawer gets no penalty. The next round starts as normal.

## Keep or Curse

Send became Curse on 2026-10-21 ([power-ups.md](../planning/power-ups.md)).

- **The drawer decides** (2026-10-20): the person who'll place it chooses where it goes. When their drawing is guessed, the solver starts drawing the next one, and the drawer, free now, gets **5s** to choose (K or C). A stolen piece is chosen by the thief. Everyone in the decider's crew sees the piece's actual shape (its filled silhouette) while they decide.
- 🧱 **Keep** ("Keep & place"): the piece joins the end of **their crew's** queue, and the decider places it.
- 🌀 **Curse**: the piece joins the end of the **other crew's** queue with a curse on it. **The receiving crew places it.** The curse is rolled when the piece is made and shown on the Curse button, so the decider knows what it does:

  | Curse | What it does |
  |---|---|
  | 🧊 **Slippery** | Almost no friction (0.05): it slides off anything, and anything slides off it |
  | ❄️ **Big ice** | 1.4 times the area, and slippery. Never just bigger: a bigger piece alone would help the tower it lands on |
  | 🫠 **Melt** | It droops in the middle like a melting candle, doodle and all: its top dips, its bottom bulges (it rocks), and its corners round off |
  | 🏀 **Bouncy** | It bounces (restitution 0.6) until 3s after it lands, then it's an ordinary piece |
  | 🍮 **Blob** | Bigger (1.4 times the area), and melted |

  A **golden word's** piece rolls two curses, never two of the same kind: one change of shape at most (big ice, melt, blob), one of friction (slippery, big ice).

- If the timer runs out, it's **Keep**.
- With **Curses & spells off** (a host setting), Curse sends the piece with no curse: the old Send.

## Spells

Added 2026-10-21 ([power-ups.md](../planning/power-ups.md)). A crew holds up to **2** spells and casts them at the other crew's tower.

- **Earning**: ✨ a **golden word** (about one round in six, never twice in a row for a crew, shown in gold to both crews) gives the crew that solves it a spell as well as the piece, so stealing one is worth double. 🆘 A **comeback** spell comes when a piece falls off your tower, or when your tower stays 2 m or more behind for 20s. At most one comeback every 90s. ⭐ A **sky star** appears a minute in and every 90s after: one just past the edge of each tower's platform (3.4–4 m from its centre, on the same side for both), 1–3 m above its top. A settled piece of the tower that touches it for 3s catches it, for a spell. It's gone after 45s. A crew that already holds 2 gets nothing.
- Each spell is rolled when it's earned. Both crews see both crews' spells, in their towers' headers.
- **Casting**: anyone in the crew except the drawer (a placer can too), with the spell's button or `1` / `2`. A **2s warning** shows over the target tower first. A tower can only be under one spell at a time.

| Spell | What it does |
|---|---|
| 🌫️ **Fog** | For 10s, a cloud covers the top of their tower: their placer sees only the piece and its guide line. Everyone else sees it thinly |
| 🐦‍⬛ **Magpie** | Takes the next piece queued for their tower (not one already being placed) into your queue, for the caster to place. It circles for up to 30s waiting for one, then gives up. A cursed piece keeps its curse |
| 〰️ **Shaky hand** | For 10s, every line their drawer starts wobbles, for everyone and for the piece it makes |
| 🐦 **Pigeon** | A pigeon lands on the outer edge of their tower's top piece: a small weight (a third of a piece) that tips it. The next piece that touches it scares it away; otherwise it leaves after 25s. It never counts for the height |

## Placing

- Each tower places **one piece at a time**, first-in first-out from its queue.
- Who places:
  - A built piece is placed by whoever chose to build it (its drawer, or the thief), if they're free.
  - A sent piece is placed by the receiving crew's free guesser who has placed the fewest pieces this match.
  - Otherwise, any free guesser in that crew. The drawer is never the placer.
  - "Free" means not drawing and not already placing. If nobody is free, the piece waits.
- The piece appears at the top of the view, floating under its balloons. The placer has **15s**:
  - `←` / `→` (or drag): move sideways
  - `↑` or `W`: rotate 15° clockwise; `Q` / `E` (or the rotate buttons): either way
  - `↓` (hold): lower faster
  - `Space`: drop now
- The piece lowers slowly on its own while it's being placed. It becomes a normal physics body when the placer drops it, when it touches the tower, or when the 15s run out.
- A guide line shows where the piece would land if dropped straight down.

## Fumbles

A **fumble** is a piece falling below the platform. It doesn't matter whether it was the piece being placed or part of the tower collapsing.

- The piece is gone for good.
- The crew is **dazed for 5s**: it can't start placing pieces, and its queue waits. A piece already being placed carries on. Guessing and drawing carry on.
- If more pieces fall during a daze, each one adds 2s, up to 10s in total.
- A cursed piece that falls off still dazes the **receiving** crew. Sending awkward shapes is a real attack.

This is the timeout you suggested. Whether it should also pause guessing is open ([open-questions.md](../planning/open-questions.md)).

## Winning: topping out

- Each tower has the same platform width and the same height line (set by the host: short, medium or tall).
- A tower's height is the top of its **settled** pieces that stand on the platform. The piece being placed doesn't count.
- When a tower goes above the line, a **3s topping-out countdown** starts, shown to both crews. If the tower stays above the line until the countdown ends, that crew wins. If it drops below (a collapse or a fumble), the countdown resets.
- While a crew is topping out, the other crew can still Curse pieces at it. A last-second cactus is part of the game.
- Safety valve: after 15 minutes, the taller tower wins.

## Timers and defaults

| Setting | Default | Host can change |
|---|---|---|
| Round (drawing) time | 60s | 45 / 60 / 90s |
| Letter mask and hint letters | mask with the first at 20s, the second at 40s | no |
| Keep-or-Curse choice | 5s, defaults to Keep | no |
| Curses & spells | on | on / off |
| Placement time | 15s | no |
| Fumble daze | 5s (+2s per extra piece, max 10s) | off / 5s / 8s |
| Topping out | 3s above the line | no |
| Height line | medium | short / medium / tall |
| Match time limit | 15 min, then the taller tower wins | no |
| Steals | on | on / off |
| Word pool | Tower Mix (all enabled decks) | one deck from the allowlist |

## What players see after the match

The results screen shows both towers side by side, with each piece labelled with its word and its drawer. It gives out a few awards: Best steal, Meanest curse, Most pieces placed, Fastest guess. The host can start a rematch with the same crews, or with shuffled crews.

## Details settled while building (Phase 1)

These follow from the rules above, and `packages/tower-core` tests each of them.

- **Newcomers** join the smaller crew (orange on a tie) and can switch in the waiting room. Someone joining mid-match joins the smaller crew too, and can be its next drawer or placer straight away.
- **The drawer rotation skips whoever is placing.** Otherwise a crew of two would stall: its only guesser can't draw and place at once. The rotation picks them up again next time.
- **The decider is never the next drawer**: the rotation moves on from the drawer, so they're free to choose and place.
- **Close guesses** show only to the guesser, for a moment, over the guess line.
- **A blank drawing** (nothing solid to build) still ends the round when guessed, but makes no piece.
- **Leaving:** a drawer who disconnects ends their drawing (no piece); a placer who disconnects drops the piece where it is; a decider who disconnects keeps the piece. A player is removed after 2 minutes away. Host rights pass on after 30 seconds away.
- **The match clock** is 15 minutes. Then the taller tower wins, or it's a draw if they're equal.
