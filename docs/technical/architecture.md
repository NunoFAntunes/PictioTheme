# Architecture

The stack is **locked**. Why each choice was made, and what was rejected, is recorded in [decisions.md](decisions.md). How to organize the code is in [backend-guidelines.md](backend-guidelines.md) and [frontend-guidelines.md](frontend-guidelines.md).

## Requirements that shape the design

| Requirement | Consequence |
|---|---|
| Real-time drawing to many viewers (< 150 ms) | Persistent WebSocket connections, compact stroke messages |
| The server referees (secret word, scoring, guess checks) | A stateful, **authoritative room process**. Clients only send intents |
| Rooms are short-lived and independent | Room state lives **in memory**. Only results are persisted |
| Accounts, decks, credits, payments | A relational DB plus an HTTP API |
| AI generation takes 20–60s | Async jobs with progress streamed to the client |
| Solo dev, **hosting cost as close to zero as possible** | One language (TypeScript), **one backend process**, everything on the existing VM, no paid managed services |

## Locked stack

| Layer | Choice | Notes |
|---|---|---|
| Language | **TypeScript 6.0** (strict, ESM) everywhere | Shared types for the protocol and deck schema. Not 7.x yet: typescript-eslint supports < 6.1 |
| Runtime | **Node.js 24 LTS** | |
| Monorepo | **pnpm workspaces** | No build orchestrator until it's needed |
| Backend | **Fastify 5** modular monolith: REST API + WebSocket rooms + job worker in **one process** | WebSockets via `@fastify/websocket` (built on `ws`). See [backend-guidelines.md](backend-guidelines.md) |
| Validation | **zod 4** + `fastify-type-provider-zod` | The same schemas validate REST, WebSocket messages, env config and LLM output |
| Database | **PostgreSQL 18**, self-hosted on the VM (Docker) | Native `uuidv7()`, full-text search + `pg_trgm` for deck search |
| ORM / migrations | **Drizzle ORM** + `drizzle-kit` on the `pg` driver | SQL-like, typed, no codegen step |
| Jobs | **pg-boss** (queue in Postgres) | Deck generation with retries. No Redis |
| Auth | **Better Auth** (self-hosted, Drizzle adapter, Fastify handler) | Magic link + Google + Discord. Guests use a signed cookie |
| Frontend | **Astro** (static output) + **React** for the app | Static landing/legal pages, React SPA for everything interactive. See [frontend-guidelines.md](frontend-guidelines.md) |
| UI | Tailwind + shadcn/ui (Radix) | |
| Canvas | Native Canvas 2D + Pointer Events + `perfect-freehand` | |
| AI | **OpenRouter** (OpenAI-compatible API) | Chosen so several models can be tested against each other. See [ai-deck-pipeline.md](ai-deck-pipeline.md) |
| Payments | Stripe Checkout or a Merchant of Record | Undecided, see [open-questions.md](../planning/open-questions.md) |
| Reverse proxy / TLS | **Caddy** on the VM | Serves the static site, proxies `/api` and `/ws` |
| Edge | **Cloudflare free plan** (DNS + proxy) | TLS, caching of static assets, DDoS protection, hides the VM IP. WebSockets work on the free plan |
| Backups | Nightly `pg_dump` → **Cloudflare R2** (free 10 GB) | Restore tested before launch |
| Tooling | Vitest, ESLint (typescript-eslint), Prettier, dependency-cruiser | dependency-cruiser enforces the layering rules in CI |
| Observability | pino logs (Fastify built in), Sentry free tier, a free uptime monitor | |

**Not used, on purpose:** Redis (not needed with one process), Next.js/Vercel (Vercel Hobby forbids commercial use, and SSR adds little to a canvas game), managed databases, serverless functions. Each can be added later without a rewrite. See [Scaling path](#scaling-path).

## Deployment

Everything runs on the existing VM with Docker Compose. Hosting costs nothing beyond the VM and the domain.

```
            Browser
               │  HTTPS / WSS (same origin: https://<domain>)
               ▼
     ┌────────────────────┐
     │ Cloudflare (free)  │  DNS, TLS, static asset cache, DDoS
     └─────────┬──────────┘
               │  Full (strict) TLS with a Cloudflare Origin certificate
┌──────────────▼───────────────────────────── VM (docker compose) ───────────┐
│  ┌──────────────────────┐                                                   │
│  │ Caddy                │  /            → static files (apps/web/dist)      │
│  │                      │  /r/*, /decks… → app shell (SPA fallback)         │
│  │                      │  /api/*, /ws  → server:3000                       │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│  ┌──────────▼────────────────────────────────────────┐   ┌───────────────┐  │
│  │ server (one Node process, Fastify)                │   │ PostgreSQL 18 │  │
│  │  modules: auth, decks, generation, credits,       │◄─►│ (volume)      │  │
│  │           billing, rooms, realtime, moderation    │   └───────┬───────┘  │
│  │  rooms: Map<roomCode, RoomRuntime> + game-core    │           │ nightly  │
│  │  worker:   pg-boss consumers (deck generation)    │           ▼ pg_dump  │
│  └───────┬──────────────────────────┬────────────────┘     Cloudflare R2    │
└──────────┼──────────────────────────┼──────────────────────────────────────┘
           ▼                          ▼
      OpenRouter API         Stripe / MoR webhooks (in)
```

Why **same origin** (site, API and WebSocket all on `https://<domain>`): no CORS, cookies can stay `HttpOnly; SameSite=Lax`, and one TLS certificate covers everything.

Release flow: merging into the `production` branch runs CI, builds two images to GHCR (the server, and Caddy with `apps/web/dist` baked in), then deploys over SSH. Migrations run as a one-off step (`node dist/migrate.js`, using Drizzle's runtime migrator, so production needs no dev tools) before the new server starts. Details, setup and rollbacks: [deployment.md](deployment.md).

A deploy restarts the only server process, which **ends live games**. For v1: deploy at quiet hours and send a "server restarting" notice to rooms on `SIGTERM` (see [graceful shutdown](backend-guidelines.md#lifecycle-and-graceful-shutdown)). Later: snapshot rooms to Postgres on shutdown and restore them on boot.

## Components

All components below are **modules inside the one server process**. Their boundaries are strict (see [backend-guidelines.md](backend-guidelines.md)) so any of them can later move into its own process.

### HTTP API (Fastify)

- Endpoints (examples):
  - `POST /api/session/guest` → guest cookie
  - `/api/auth/*` → Better Auth (magic link, OAuth callbacks, session)
  - `GET /api/rooms/public` → lobby list and the number of players online (from the in-memory room registry)
  - `PUT /api/rooms/:code/me` → a player in the room changes name or avatar; everyone gets the new player list ([realtime-protocol.md](realtime-protocol.md#changing-your-name-or-avatar-in-a-room))
  - `PUT /api/rooms/:code/cover` → the drawer's picture of the room's new most-liked drawing (after `cover:request`); `GET /api/rooms/:code/cover?v=<coverVersion>` serves it (kept in memory with the room)
  - `POST /api/rooms/quick-play` → joins the best public room with space, or creates a public one; returns `{code, joinToken}` (user-flows.md §2)
  - `POST /api/rooms` → creates a room, returns `{code, joinToken}`
  - `GET /api/rooms/:code` → `{code}` if the room exists, 404 `ROOM_NOT_FOUND` otherwise; the home page's "Join with a code" checks it before leaving the page (rate-limited like join)
  - `POST /api/rooms/:code/join` → validates, returns `{joinToken}`. Create and join both carry the drawn avatar as a PNG data URL; the server stores it and puts only its id in the token
  - `GET /api/avatars/:id` → the avatar PNG (`immutable` cache: ids are content hashes)
  - `GET /api/decks` → the curated decks, featured first; `?q=halloween` searches titles and tags of all public decks (`pg_trgm`, typo-tolerant, 30 results)
  - `GET /api/decks/generations/config` → `{enabled, daily}`: whether this server lets players generate decks (`DECK_GENERATION`, the kill switch), and the player's daily allowance (`{limit, remaining, nextAt}`, null without limits or a session)
  - `POST /api/decks/generations` → starts a generation job (202 + the job). Later it also reserves a credit
  - `GET /api/decks/generations/:id` → the job, polled every 2s until `published` or `failed` (SSE progress replaces polling once calls stream)
  - `PUT /api/decks/generations/:id/cover` → the creator's drawn back cover for a running or published job (PNG data URL); returns the job
  - `PUT /api/decks/:id/cover` → redraws the cover of a deck this player generated (404 for anyone else); returns the deck summary
  - `GET /api/decks/covers/:id` → the cover PNG (`immutable` cache: ids are content hashes)
  - `POST /api/events` → a browser-side product event (`first_turn`, `phone_gate`, `room_joined`); a session is optional. See [data-model.md](data-model.md#metrics)
  - `POST /api/decks/:id/reports` → `{reason: 'cover' | 'content'}`; reports a saved deck (needs a session). 3 unique reports hide the cover or the deck
  - `GET /api/decks/mine` → decks this player generated
  - `POST /api/billing/checkout`, `POST /api/billing/webhook`
- The `joinToken` is a short-lived (60s) signed JWT `{roomCode, playerId, displayName, avatar, isRegistered}`. The WebSocket upgrade checks it, so the realtime module never reads sessions itself.

### Rooms and realtime

- One WebSocket endpoint: `wss://<domain>/ws?token=<joinToken>`.
- The `rooms` module holds `Map<roomCode, RoomRuntime>`. Each `RoomRuntime` wraps the **pure** `game-core` state machine (`waiting → choosing → drawing → reveal → (next turn | results) → waiting`) and runs its effects: sending messages, scheduling timers, persisting results. This is the *functional core, imperative shell* pattern described in [backend-guidelines.md](backend-guidelines.md#realtime-rules).
- All timers run on the server. Clients render countdowns from `endsAt` timestamps.
- On game start the room loads the deck's cards from Postgres into memory (a few KB). At the end of a match it writes results to Postgres. These writes are best-effort and never block the game.
- The room map is the source for the public lobby list. It lives in memory.
- The `realtime` module is only the transport: it authenticates the upgrade, validates and rate-limits messages, runs the heartbeat, and maps sockets to players. It implements the `RoomTransport` interface that rooms send through.

### Room code generation

- Format `AAA-AAA`. Alphabet: 24 uppercase letters (A–Z minus **I** and **O**, which are easily misread). 24⁶ ≈ 191M combinations.
- Generated with a crypto RNG, checked against a **blocklist** of offensive 3- and 6-letter strings, and checked for uniqueness against the in-memory registry.
- Input normalization: uppercase, strip anything that isn't a letter, re-insert the dash. If someone types `I`, `O`, `0` or `1`, show "Codes never contain I or O, so check the letters" instead of a plain "not found".

### Deck generation worker

- A pg-boss consumer in the `generation` module. It calls OpenRouter, validates the result, saves the deck, and commits or releases the credit. Progress events go through the in-process event bus to the SSE endpoint. See [ai-deck-pipeline.md](ai-deck-pipeline.md).

## Scaling path

| Stage | Setup | Rough capacity |
|---|---|---|
| **MVP (now)** | 1 VM: Caddy + 1 server process + Postgres | Thousands of concurrent players, limited mostly by VM bandwidth |
| Bigger VM | Same setup, more CPU/RAM. Optionally move the worker to its own process (same code, second entrypoint) | Several thousand more |
| Multi-instance | Add **Redis** for the room registry, rate limits and the event bus (each is behind an interface already). Caddy routes `/ws` by room code to the owning instance | Tens of thousands |
| Global | Regional instances, or move rooms to Cloudflare Durable Objects (`game-core` is runtime-agnostic) | — |

Bandwidth is the main cost to watch: drawing traffic is ~1–5 KB/s from the drawer, multiplied by the number of viewers. Compact encoding matters (see [realtime-protocol.md](realtime-protocol.md)). Check the VM provider's egress allowance.

## Resilience

- **Client reconnect**: exponential backoff. On reconnect the server sends a full `room:snapshot`, including every stroke of the current drawing, so the canvas is rebuilt exactly.
- **Process restart / crash**: in-progress games are lost in v1 (accepted). Docker restarts the container (`restart: unless-stopped`). Later: snapshot room state to Postgres every turn and on shutdown.
- **Database**: nightly dumps to R2, 14 daily + 8 weekly kept. Practise a restore before launch.

## Repository layout

```
apps/
  server/         Fastify modular monolith (API + realtime + worker). Owns the DB schema and migrations
  web/            Astro site + React app
packages/
  game-core/      Pure room state machine, scoring, guess matcher, card pool (no I/O, unit-tested)
  protocol/       zod schemas + types: WebSocket messages, REST DTOs, deck schema, error codes
infra/
  compose.prod.yaml, Caddyfile, Dockerfiles, deploy/ (VM bootstrap, deploy, backup scripts)
docs/
```

Only code that **both** `server` and `web` need goes in `packages/`. The DB schema stays inside `apps/server` because nothing else may touch the database.

`game-core` with no I/O is the most important testing seam: whole matches can be simulated in unit tests.
