# Status

## Where we are (2026-10-20)

| Phase ([roadmap.md](roadmap.md)) | Status |
|---|---|
| Design and plan | ✅ Core decisions in [../README.md](../README.md#decisions-so-far-2026-10-19) |
| 0: Sandbox | ✅ Built. The exact physics and piece values are to be settled over many games, not up front |
| 1: Playable match with friends | **Built and tested end to end, locally.** Not deployed: it needs its domain (open question 8). A real playtest is next |
| 2–4 | Not started |

Doodle Tower lives in this monorepo (the empty `~/Developer/personal/DoodleTower` folder isn't used), on the `doodle-tower-sandbox` branch.

### What works today

- **A whole match**, in real browsers: create a room, share `/r/CODE`, join (name only, a bobble-hat avatar is generated), pick crews, set the rules (line, drawing time, daze, steals), start. Both crews draw at once. The towers take most of the screen; the middle has your crew's drawing over a play card that flips between the drawing tools and the guess line with the placing controls (no guess log or chat). The other crew's drawing hangs small in their tower's sky. One guess line serves both drawings: your crew's is checked first, then the other crew's (a steal). The letter mask only shows at a third of the round. The drawer has a paint bucket that only colours in closed shapes, and closing a shape with the brush pops a swatch of seven colours over it: one tap colours it in (2026-10-20). The drawer (or the thief, for a steal) chooses 🧱 Keep & place or 💣 Send (B / S): a kept piece is theirs to place, a sent one is placed by the other crew (←/→ move, ↑/W rotate clockwise, Q/E either way, ↓, Space, or the buttons on the play card). Fumbles daze, topping out wins, then the results (awards, everyone's numbers) and a rematch.
- **The "Sunny meadow" look** (2026-10-20, [visual-identity.md](../design/visual-identity.md)): a sky with drifting clouds, hills and a village on every page; each tower on a grassy stone plinth, climbing past the clouds; the piece being placed floats under balloons; bunting for the line. Sprites are Kenney's CC0 packs in `apps/tower-web/public/scenery/`.
- **A living village** (2026-10-20, [visual-identity.md](../design/visual-identity.md#villagers)): villagers busy at jobs (chatting, hammering, watering, sweeping, carrying crates, watching) and passers-by coming and going. On a tower, a piece that falls off lands on the lane with a thump: neighbours jump, the closest one breaks it up with a mallet, and anyone it lands on is squashed flat, waddles about squeaking, then pops back. Each player's own, cosmetic. The first **sounds** go with it (thump, whacks, synthesised yelps, squish, squeaks, pop), heard even when the ground is out of view.
- **Music and game sounds** (2026-10-20, [visual-identity.md](../design/visual-identity.md#sound)): OwlishMedia's CC0 "Happy Clappy Loop" as the main theme on every page, and synthesised jingles for the match: your turn to draw or place, right/close/wrong guesses, steals both ways, a piece sent your way, placing thud, fumble wah-wah, topping out, the last seconds' ticks, win/lose/draw. A sound control top right on every page: on/off, music and effects volumes.
- **`packages/tower-core`**: the pure match state machine, 40 tests covering every rule, including privacy (the word only to the drawer, the mask and the guesses only to the crew).
- **Server `tower` module**: rooms, routes, the `/ws/tower` socket, physics in a pool of worker threads (frames at 20 Hz). Its tests play a round over real sockets, through the worker, against the real database.
- **Data**: `tower_decks` (seeded with six curated decks: Tower Mix is 920 easy cards), `tower_matches`, `tower_match_players` (migration 0012).
- **`apps/tower-web`**: home, waiting room, game screen, results, plus the Phase 0 sandbox. The placer sees their piece move as they press keys (local prediction); everyone else sees it through interpolated frames.
- **Deployment prepared, not done**: a second Caddy site block (`TOWER_SITE_ADDRESS`, `TOWER_TLS_DIRECTIVE`), the tower build in the web image and the deploy workflow, `TOWER_PUBLIC_ORIGIN` for the server. `caddy validate` passes.

## How to run and verify

```sh
pnpm db:up && pnpm --filter @pictiotheme/server db:migrate   # migration 0012 + the tower allowlist
pnpm --filter @pictiotheme/server dev                         # API on :3000
pnpm dev:tower                                                # http://localhost:4322
pnpm check                                                    # everything (server tests need db:up)
pnpm --filter @pictiotheme/tower-web test:e2e                 # sandbox + a 4-player round (needs the API)
```

If port 3000 is taken, run the API elsewhere and point the site at it: `PORT=3100 pnpm --filter @pictiotheme/server dev` and `TOWER_API_PORT=3100 pnpm dev:tower` (the e2e test then too).

To play a match alone, open four browser profiles (or windows in private mode): each one is a different guest.

## Next tasks

1. **Choose the domain** and deploy: set `TOWER_SITE_ADDRESS` (and `TOWER_TLS_DIRECTIVE` behind Cloudflare) in `/opt/pictiotheme/.env`, add the Cloudflare zone, merge to `production`.
2. **Playtest** a full match with 2 crews of 3 on PCs and a tablet (the Phase 1 "done when" in [roadmap.md](roadmap.md#phase-1-playable-match-with-friends)). Watch: match length per line, whether stealing is too easy or too hard, how often the queue backs up, and whether Build-or-Send in 5s is enough.
3. Tune from it: the line heights, the round time, the daze, the piece size.
4. Phase 2 ([roadmap.md](roadmap.md#phase-2-feel-and-polish)): a real cheer for topping out (a sample, maybe Kenney's "Interface Sounds"), maybe a second track for the match, placing and topping-out animations, the share image, a drawn avatar, metrics events.

## Known gaps

- **Reconnecting sends every piece's strokes** in the snapshot (to draw them). Fine for a match, heavy if a tower grows very tall; later the server could send each piece's bitmap once.
- **A physics worker that crashes isn't restarted**: its rooms' towers freeze (it's logged). Restart and rebuild the worlds from the pieces if it ever happens.
- **No moderation yet** for drawings (anyone can draw anything) or for writing the word instead of drawing it ([open-questions.md](open-questions.md)).
- **Phones** get a "bigger screen" notice in the room; the home page works anywhere.
- **The DoodleWhirl Playwright suite** still needs a run where port 3000 is free, to confirm the canvas extraction and the shared socket code end to end (its server tests pass).
