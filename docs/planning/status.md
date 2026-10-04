# Project Status and Handoff

**Last updated:** 2026-10-04. Update this file whenever you finish a chunk of work. It's the starting point for anyone (person or agent) picking up the project.

## Where we are

| Phase ([roadmap.md](roadmap.md)) | Status |
|---|---|
| 0: Foundations | ✅ Done, **except deploying to the VM** (see task 3 below) |
| 1: Playable core with friends | ✅ Built and tested end to end. A quick playtest (2026-10-03) went well. A full one (~6 people, laptops and tablets, 3 rounds) is planned on the deployed build |
| 2: Public play and deck library | Mostly done: public rooms and the lobby list, 20 curated decks seeded into the DB, a deck picker with search, deck/cover reports, and profanity filtering. Not started: a library page and the moderator page |
| 3: Accounts and AI generation | Started: AI deck generation is open to everyone, guests included, within daily limits (1 per player, 3 per IP, a $5 daily budget): form → job → progress → deck saved and playable. No accounts, credits, review step, queue or streaming yet |
| 4: Payments and launch | Not started |

### What works today

- **Lobby** (`/play`): pick a name and draw an avatar on a small pad (both remembered in localStorage; blank pad → a tile with your initial), create a room (name, public/private, deck), join by code, live public room list.
- **Room** (`/r/ABC-DEF`): invite links ask for a name first. The waiting room has the code, copy-invite button, and host-editable settings. Matches have choosing/drawing/reveal phases, hints, timer, scoring, early end when everyone has guessed, and results with awards and play again.
- **Drawing**: brush, eraser, fill, sizes, opacity, 24-colour palette plus a custom colour, undo/redo/clear, keyboard shortcuts. Live sync to every guesser, including late joiners and reconnects.
- **Brush controls**: right-drag or Ctrl/⌘-drag on the canvas changes size (↔) and opacity (↕), or tolerance on Fill. A ring previews the real on-screen brush size and flashes filled with the real ink and a "24 px · 60%" label on every change. Shortcuts are layout-independent (`[` `]` `-` `=`, Shift for ×2, digits for opacity). See [drawing-tools.md](../product/drawing-tools.md#adjusting-size-and-opacity).
- **Colours**: eyedropper (hold `Alt` to preview the colour under the pointer, `Alt`+click or a quick right-click to pick it up), `X` swaps to the previous colour, `C` opens the swatches, recent colours and full picker at the pointer. See [drawing-tools.md](../product/drawing-tools.md#picking-and-sampling-colours).
- **Guessing**: correct / close (red, redacted for others) / wrong, guess visibility on/off, a solvers-only chat channel, guess bubbles in the player list.
- **Sounds** ([sounds.md](../design/sounds.md)): shuffle, deal and flip in time with the card animation, your turn, correct/close/someone-solved, hints, a quiet clock tick for the last 10 seconds, a very faint pencil scribble that follows the line's speed (the drawer and guessers both hear it), a glug for the paint bucket, turn over, results jingle, chat and join/leave pops. All CC0 (Kenney, Freesound). The 🔊 button (room and lobby headers) has mute all, main volume and five groups (Cards & turns, Guesses, Drawing, Clock ticking, Chat & players), saved in localStorage. Rooms use `onRoomMessage` from `realtime/` to hear applied messages, and `watchDrawing` follows the stroke model.
- **Leaderboard**: during a match the player list is sorted by score with ranks, and rows slide (overtakers pop) when the order changes (`features/player-list/leaderboard.ts`, `use-leaderboard-motion.ts`). Turn order is unaffected.
- **Host controls**: pause/resume, skip, end match, kick, make host. Others can vote-kick.
- **Resilience**: reconnect with backoff (fresh join token each time), the drawer's 15s grace period, host handover, auto-pause when one player is left, graceful server shutdown.
- **AI deck generation** (on for everyone; `DECK_GENERATION=off` is the kill switch): "✨ Generate a deck" in the create-room deck picker takes a theme, notes, difficulties and silly on/off, shows progress while the server makes the deck (~1 min), then saves it to the `decks`/`cards` tables and selects it. Generated decks are listed as "yours" in both deck pickers. One running job per player; a restart fails running jobs. **Limits** (rolling 24 h, failed jobs don't count): 1 deck per player, 3 per IP (stored only as an HMAC of the IP), and a global $5 budget, then "busy, try later". All set in config (`GENERATION_*`); `GENERATION_LIMITS=off` turns them off for development. The panel shows "You can make one deck a day" or when the next one is available. Themes, notes, cards, alternates, titles and tags go through the blocklist (`generation/content-check.ts`). Under the hood, `modules/generation` turns a theme, the chosen difficulties and a silly on/off flag into a validated deck via OpenRouter: prompt → model (structured output) → deterministic cleanup → one top-up call if a pool is short. Try it with `pnpm --filter @pictiotheme/server deck:generate --theme "pirates" --difficulties easy,medium --silly` (needs `OPENROUTER_API_KEY` in `apps/server/.env`). It uses `openai/gpt-6-luna` (fallback `gpt-6-luna-pro`) with the examples prompt, picked by a blind-graded eval of 11 models and 3 prompts ($0.52): see [model-eval-2026-10.md](../technical/model-eval-2026-10.md) and decisions.md D6. A deck costs ~$0.004 and takes ~1 minute. The free `stealth/space-bunny-alpha` still works for experiments (commented out in `.env`).
- **Deck back covers** ([decks.md](../product/decks.md#back-cover)): while a deck generates, the creator draws its 3:4 back cover on a pad (or skips). The deck is handed back once it's published and the cover is saved or skipped; if generation fails, the drawing is kept and re-sent with the retry. Covers are stored content-addressed in `deck_covers` (`PUT /api/decks/generations/:id/cover`, `GET /api/decks/covers/:id`) and shown in the create-room picker, beside the room code in the waiting room, on results, and as the card backs while choosing (the room's `deck` carries `coverId`). Creators can redraw a cover later with ✏️ on their decks in the create-room picker (`PUT /api/decks/:id/cover`, owner = whoever's generation job made the deck). The cover pad has the game's full drawing toolbar, with touch-sized targets on tablets. Decks without one (curated decks, skipped ones) show a default cover made from the title (`features/deck-cover`).
- **Deck reports**: 🚩 on a saved deck in the waiting room and on results reports its cover or its cards/title (`POST /api/decks/:id/reports`, `deck_reports` table). 3 reports from different players hide the cover (the default cover shows) or the deck (it can't be picked or loaded). No moderator page yet to review or restore them.
- **Content**: 20 **curated decks** as JSON in `apps/server/src/modules/decks/curated/` (the 2 former built-ins plus 18 generated on 2026-10-04 for $0.07, not yet edited by hand; they keep the default title tile as their cover), seeded into `decks`/`cards` by `db:migrate` (upsert by slug: same id and cover on re-seed). 5 are featured (Halloween-season first). Plus players' generated decks. Every deck lives in the database now.
- **Deck picker** (create room): a grid of covers in sections (your decks, featured, more decks; 4 each until "Show all"), and a search box over titles and tags of all public decks, typo-tolerant (`GET /api/decks?q=`, `pg_trgm`).
- **Profanity filter** (`game-core/src/moderation/profanity.ts`, on the `obscenity` list with leetspeak handling and a list of allowed phrases like "Moby Dick" or "Cockpit"): chat and guesses are masked for other players, and offensive player or room names are refused at create/join.
- **Metrics** ([data-model.md](../technical/data-model.md#metrics)): product events in our own `product_events` table (rooms created, matches started/ended with the reason, turn results, time from landing to the first turn, phone gate, device per player), card stats on `cards` (offered, picked by the drawer, drawn, guessed) and the drawer's 👍/👎 on the face-up options (`card_votes`, via `turn:vote`). `pnpm --filter @pictiotheme/server metrics:report [--days N]` prints the launch metrics against their targets and the weakest cards. Best-effort: a failed write never affects a game.
- **Tablets** ([drawing-tools.md](../product/drawing-tools.md#touch-and-stylus), [screens.md](../design/screens.md) §4): below 1024 px wide (tablets in portrait) the room stacks the board over Guesses/Players tabs with the guess input pinned, and nothing but the panels scrolls. The toolbar has touch-sized targets and a 💧 eyedropper button. Pen pressure is recorded, only one pointer draws at a time, and touches stop drawing once a pen has been seen (palm rejection, `canvas/engine/pointer-gate.ts`). No double-tap zoom or long-press callout. The lobby stacks below 1024 px. Tested with Chrome's iPad emulation (`e2e/tablet.spec.ts`); not yet on a real iPad or Android tablet.
- **Phone gate**: phones (touch screen whose shorter side is under 600 px) get "PictioTheme needs a bigger screen" with the link to copy, and a "Try anyway". Tablets and desktops go straight in (`features/phone-gate`).

## Map of the code

| Area | Where | Notes |
|---|---|---|
| Shared contract | `packages/protocol/src/` | Every WebSocket message, REST DTO, error code, close code and avatar id. Change this first |
| Game rules | `packages/game-core/src/room/` | `step(state, event, ctx) → effects`. Pure, simulated in `room.test.ts`. `test-harness.ts` drives it with a fake clock |
| Guess matching | `packages/game-core/src/guess/classify.ts` | The test table follows [guess-matching.md](../technical/guess-matching.md) |
| Server | `apps/server/src/modules/` | `system`, `auth` (guests + join tokens), `decks` (curated + generated decks, seeding, search, covers, reports), `generation` (AI decks: pipeline, jobs, routes), `rooms` (`RoomRuntime` per room), `realtime` (WebSocket transport). Wiring is in `app.ts` |
| Web socket layer | `apps/web/src/app/realtime/` | `connection.ts`, `room-view.ts` (reducer), `stroke-model.ts` |
| Web UI | `apps/web/src/app/features/`, `routes/` (`deck-cover` for covers, `report-deck` for 🚩; the cover pad reuses `canvas/DrawingBoard` + `Toolbar`, and `canvas/SketchPad` is the avatar pad) | See the layout in [frontend-guidelines.md](../technical/frontend-guidelines.md#layout) |
| Canvas | `apps/web/src/app/features/canvas/engine/` | renderer, paint (perfect-freehand), flood fill, pointer input |

## How to run and verify

```sh
pnpm install
pnpm db:up                                            # Postgres 18 on :5433
cp apps/server/.env.example apps/server/.env          # once
pnpm --filter @pictiotheme/server db:migrate          # also seeds the curated decks; re-run after pulling
pnpm dev                                              # server :3000, web :4321 → http://localhost:4321/play
```

Before calling any change done:

```sh
pnpm check                                  # typecheck, lint, import boundaries, all unit tests
pnpm format:check
pnpm --filter @pictiotheme/web test:e2e     # two real Chrome browsers play a turn (UI changes)
```

Current counts: 349 unit tests (protocol 5, game-core 120, server 160, web 64) and 8 browser spec files (play-a-turn, brush-controls, color-shortcuts, avatars, generate-deck with 5 tests, deck-picker, phone-gate with 2, tablet with 2: iPad emulation in Chrome, pens and touches through the DevTools protocol). The browser specs need the curated decks in the dev database (`db:migrate`). All pass when run one at a time (`--workers=1`). Against a reused dev server the room-creation rate limit (5/min) still applies, so running specs in parallel, or re-running them back to back, can trip it: wait a minute between runs. Specs open players with `newPlayerPage` (`e2e/support.ts`), which hides the Astro dev toolbar so it can't intercept clicks.

## Next tasks, in priority order

> A reordered plan aimed at a pre-Halloween public launch is in [next-features.md](next-features.md). Done from M1: 1.1 deck covers (curated decks keep the default title tile; decided 2026-10-04), 1.3 phone gate, 1.5 seed decks (hand editing left to the owner), 1.6 guest generation with limits, 1.7 generation moderation (blocklist + reports; no LLM theme check), 1.8 chat/name masking, 1.9 deck picker, 1.11 product events (plus per-card 👍/👎 and pick rates), 1.2 tablet layout (real-device check left). Left: 1.4 landing page, 1.10 deploy (hosting is being set up), 1.12 playtest, and the should-haves. It includes decisions taken on 2026-10-03: desktop + tablets only, guests generate 1 deck per day, and drawn deck back covers. Once it's agreed, update this list to match.

1. **Full playtest (Phase 1 exit criterion).** A quick playtest went well. Run the full one (~6 people, laptops and tablets, 3 rounds) once the app is deployed, and fix what's found.
2. **Phase 1 polish backlog** (known gaps, roughly by value):
   - Fill leaves a thin unfilled ring at a stroke's anti-aliased edge. Grow the filled region by 1 px in `flood-fill.ts` (keep it deterministic, and add a test).
   - Check the tablet layout and pen/palm handling on a real iPad (Safari) and an Android tablet; Chrome's emulation can't show Safari quirks.
   - Undo repaints every operation. Add bitmap checkpoints every ~20 operations in `renderer.ts` if it gets slow on long drawings.
   - Score "+180" animation at turn end, the "🚩 unfair card" link on the reveal overlay, sounds.
   - The landing page per [screens.md](../design/screens.md) §1 (name card + join box on `/`).
   - Persist match history: the `matchEnded` effect is only logged (`rooms.service.ts`). Add `matches`/`match_players` tables.
   - Avatars: a cleanup job for guest avatars unused for ~30 days (`avatars.last_used_at`), and moderation (report/hide an avatar, like drawings and deck covers).
   - Deck reports: per-IP limits on reports (throwaway guest sessions could hide a deck), and the moderator page to review, restore or confirm hidden decks and covers. Cover cleanup must keep covers referenced by `deck_reports`.
   - Drawing tools v1.1: shapes, pressure brushes, long-press eyedropper on touch ([drawing-tools.md](../product/drawing-tools.md)).
3. **Deploy to the VM (Phase 0 leftover).** The pipeline is built and rehearsed locally (2026-10-04): push to `production` → CI → images on GHCR → `deploy.sh` over SSH, plus Caddy, nightly backups and a VM bootstrap script. See [deployment.md](../technical/deployment.md). Left: bootstrap the Oracle VM (152.70.12.114), add the GitHub `production` environment secrets, open ports 80/443 in the Oracle security list, run the first deploy. Later: the domain behind Cloudflare with an Origin certificate, R2 credentials for off-site backups, and a practised restore.
4. **Phase 2:** a library page and deck preview page with full-text search (`tsvector` over card text; title/tag search with `pg_trgm` is built), a moderation admin page.
5. **Phase 3:** saved avatars for registered users (a `user_avatars` gallery to pick from, see [data-model.md](../technical/data-model.md)); accounts with Better Auth (it slots in as a second `Actor` kind; see `apps/server/src/lib/actor.ts`), the credit ledger, and the rest of AI deck generation ([ai-deck-pipeline.md](../technical/ai-deck-pipeline.md)). Generation is open to guests with daily limits; still to do: accounts (more decks per day, see next-features.md 3.4), the review step (remove cards, one free regenerate), an optional LLM theme check for subtler cases, and moving the in-process jobs to pg-boss. Nice to have: streaming progress (SSE) instead of polling, and showing generated decks in the library once search exists. The eval script exists (`deck:eval`); next prompt work is in the "What still goes wrong" section of the eval report.

## Rules of the road

- Read [backend-guidelines.md](../technical/backend-guidelines.md) and [frontend-guidelines.md](../technical/frontend-guidelines.md) before writing code. Rules marked 🔒 fail CI.
- **Protocol change checklist:** `packages/protocol` schema → game-core / server → web reducer (`room-view.ts`) → [realtime-protocol.md](../technical/realtime-protocol.md) → tests on both sides.
- **Never mock the database.** Server tests use the real `pictiotheme_test` DB from `pnpm db:up`.
- **Supply-chain policy:** pnpm refuses packages younger than its minimum release age. Don't add `minimumReleaseAgeExclude` entries. Pin an older version instead (see `@fastify/websocket` in `apps/server/package.json`).
- **TypeScript is pinned to 6.0** until typescript-eslint supports 7.
- **Agents running `astro dev`:** it auto-backgrounds. See [frontend-guidelines.md](../technical/frontend-guidelines.md#dev-gotchas).
- Keep the docs true: when the implementation departs from a doc, update the doc in the same change, and update this file.

## Implementation decisions not covered elsewhere

- Avatars are drawn by players (`features/avatar/AvatarPad`, which reuses the canvas stroke model and renderer). Create/join send a 128×128 PNG data URL; the `avatars` server module validates it, stores it content-addressed in Postgres, and the join token, `PublicPlayer.avatar` and `<img src=/api/avatars/:id>` use only the id. The player list shows the avatar large and the name small.
- Hidden decks and covers only affect rooms that load the deck afterwards: a room already playing it keeps its cards and cover. The same goes for a redrawn cover.
- HTTP rate limits are on everywhere except automated tests (`RATE_LIMITS=off` in the test config). The same goes for the generation limits (`GENERATION_LIMITS=off`); their tests turn them on with random client IPs, since the test database keeps jobs between runs.
- Curated decks are never hidden by reports automatically (griefing); their reports wait for the moderator page. Re-seeding replaces their cards (card ids change), which card stats will need to handle.
- One hosted room per player: creating a new room closes your previous one if nobody else is in it.
- The client clears the canvas on a new turn by itself, because the server doesn't send `draw:clear` between turns ([frontend-guidelines.md](../technical/frontend-guidelines.md#how-a-room-screen-works)).
