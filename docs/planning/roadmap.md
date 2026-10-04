# Roadmap

Each phase ends with something playable. Sizes are rough for one developer working part-time.

## Phase 0: Foundations (≈ 1 week) — ✅ done (deployed 2026-10-04)

- pnpm monorepo (`apps/server`, `apps/web`, `packages/game-core`, `packages/protocol`), set up per [architecture.md](../technical/architecture.md#repository-layout).
- Server skeleton following [backend-guidelines.md](../technical/backend-guidelines.md): `config.ts`, `app.ts` composition root, error handler, health endpoints, Drizzle + first migration.
- Astro site + React app shell following [frontend-guidelines.md](../technical/frontend-guidelines.md).
- CI: typecheck, lint, dependency-cruiser layering rules, unit tests.
- Postgres 18 locally via Docker Compose (the same compose file as production, minus Caddy).
- VM: Docker Compose with Caddy + Postgres, Cloudflare DNS/proxy, nightly backups to R2, a first deploy of a "hello" page. ✅ Live at https://pictio.tierney.one on an Oracle Always Free VM, deployed by merging into `production` ([deployment.md](../technical/deployment.md)). Backups run nightly on the VM; the R2 upload waits for credentials.
- OpenRouter account with a spending limit. Start the model eval script early ([ai-deck-pipeline.md](../technical/ai-deck-pipeline.md#evaluation)), because it decides the production model before Phase 3.

## Phase 1: Playable core with friends (≈ 3–4 weeks) — **the first milestone**

Status: ✅ built, server and web, tested end to end including a two-browser Playwright test. **Remaining: the playtest exit criterion below, and the polish backlog in [status.md](status.md).**

Goal: you and friends can play a full match in a private room with a hard-coded deck.

- Guest identity (name + avatar).
- Create private room → `ABC-DEF` code → join by code / link.
- Waiting room, host start.
- Room state machine: choosing → drawing → reveal → results.
- Canvas v1: brush, size, opacity (done right), palette + picker, eraser, undo/redo, clear.
- Live drawing sync + reconnect snapshot.
- Guessing with correct / close (red redacted) / wrong. Guess visibility toggle.
- Player list on the left with avatars, scores, and guess bubbles.
- Scoring, hints, timer.
- 3–5 hand-written seed decks with easy/medium/hard + silly.

**Exit criteria**: 6 people play 3 rounds with no desync or crash, and it's fun.

## Phase 2: Public play and the deck library (≈ 2–3 weeks)

- Public rooms + live lobby list.
- Deck search, preview, multi-difficulty selection, Silly Mode ratio.
- ~30 curated seed decks (AI-generated then hand-edited, using the pipeline script offline).
- Vote kick, report, profanity filters, rate limits.
- Fill bucket, keyboard shortcuts, mobile layout.

## Phase 3: Accounts and AI generation (≈ 2–3 weeks)

- Sign up / sign in (magic link, Google, Discord). Guest → account upgrade.
- Saved avatars: registered users keep the avatars they draw (`user_avatars`, see [data-model.md](../technical/data-model.md)) and pick one instead of redrawing.
- Generation flow: form → job → streamed progress → review → publish, using the model the eval picked.
- Credit ledger with a free grant of 3.
- Deck ratings, card flags, card stats.
- Moderation admin page.

## Phase 4: Payments and launch (≈ 1–2 weeks)

- Stripe Checkout credit packs + webhooks.
- Privacy policy, terms, cookie-free analytics.
- Error monitoring, uptime alerts, load test (e.g. 200 concurrent rooms).
- Launch: Reddit (r/WebGames, r/boardgames), Product Hunt, Discord communities, and seasonal timing (launching before Halloween fits the theme).

## Phase 5: Delight and growth (ongoing)

- Drawing gallery / replay at the end of a match, shareable GIF of a drawing.
- Shapes, pressure, brush types. (Eyedropper done.)
- Deck remix ("add more cards"), favourite decks, profile stats.
- More languages (PT, ES, FR…) with language-aware guess matching.
- Semantic close-guess detection.
- Supporter subscription, cosmetics.
- Team/classroom mode.

## Key metrics to watch

| Metric | Why |
|---|---|
| Time from landing to first turn | "Ten seconds to fun" |
| Matches completed / matches started | Tells us whether games are fun or broken |
| % of turns where ≥ 1 player guessed | Deck and card quality |
| Generations per registered user, free → paid conversion | Monetization health |
| Deck reuse (plays per generated deck) | Library network effect |
| p95 draw latency, disconnect rate | Technical quality |
