# Test mode

A room for trying the powers ([power-ups.md](power-ups.md)) alone, without drawing or guessing. Built 2026-10-21.

## Using it

1. Run the API and the site (see [status.md](status.md#how-to-run-and-verify)).
2. On the home page, enter a name and press **🧪 Test the powers** (shown in development only). It makes a private test room and takes you to it.
3. Set the rules if you want (line height, daze, steals, curses & spells on or off), then **Start building**. Nobody else is needed.

In the match:

- **The bots draw.** Each crew has a drawer bot ("Orange doodlebot"), which draws a rectangle of a random size, coloured in with a random colour, at the start of each round. A crew with no people in it also gets a builder bot ("Teal buildbot"): the rival.
- **You never draw.** Instead of the guess line you get **✅ Guess ours** and **🥷 Steal theirs**. Either one makes you the solver *and* the decider: you get the Keep or Curse card, and you place what you keep.
- **The test panel** (left, folds away with ✕) has:
  - **Next piece's curse**: 🎲 Random (rolled as in a match, two on a golden word) or one curse for every piece made from then on, by you or the rival.
  - **The rival**: solve their drawing or steal yours, then keep it or curse it at you, at once; and cast any spell it holds at your tower.
  - **Give a spell** to either crew (refused when it already holds two).
  - **Golden words and stars**: make either crew's current drawing golden, and bring the sky stars now instead of after a minute.
  - **Checklist**: what to try with each power and what to look for. Ticks are kept in this browser.

Bots place pieces by steering them somewhere over the middle of the platform and lowering them fast. Everything after the "guess" is the real match: deciding, curses, the physics, spells, magpies, pigeons, stars, comeback charges, fumbles, the daze and topping out.

## How it works

| Part | What |
|---|---|
| `TowerSettings.testMode` | Set when the room is made (`POST /api/tower/rooms` with `testMode: true`), never by `settings:update`. A test room stays private |
| `TOWER_TEST_MODE` (server env) | `on` / `off`. Unset: on, except with `NODE_ENV=production`. Off: test rooms are refused (403) |
| `tower-core/src/bots.ts` | Seats the bots when the match starts (`bot-<team>-drawer`, `bot-<team>-builder`), and removes them on a rematch. Draws the rectangles (wobbly under Shaky hand). Bots are always connected and have no socket; they don't keep a room open, and never become host |
| `tower-core/src/test-mode.ts` | The `test` message: `solve`, `rival`, `rival-cast`, `grant`, `golden`, `stars` |
| `match.ts` | In test mode only drawer bots draw, drawer bots never place, the solver always decides, a bot placer steers its piece down, and `solveRound` takes the curse to give |
| `apps/tower-web/src/app/features/test-mode/` | The guess buttons, the test panel and the checklist |
| `apps/tower-web/e2e/test-mode.spec.ts` | One player: guess, keep, place; the rival curses a piece at them and casts Fog; a checklist tick |

Test matches aren't saved to the match history.

## Limits

- **Shaky hand** wobbles a drawing when it starts, since the bots draw it all at once. Cast it, then make that crew's drawing change (solve or steal it, or wait for it to expire): the next one wobbles. You can't see the drawer's side of Shaky hand (you never draw).
- The rival only acts when you press a button. Comeback charges for being behind need it to build: press "Solve theirs, keep it" a few times.
- With people in both crews (two windows), there's no builder bot: each crew plays for itself with the guess buttons.
