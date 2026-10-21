# Architecture

Doodle Tower follows the DoodleWhirl [architecture](../../technical/architecture.md) and its [backend](../../technical/backend-guidelines.md) and [frontend](../../technical/frontend-guidelines.md) guidelines. This page covers only what's new or different.

## What's shared and what's new

| Part | Shared with DoodleWhirl | New for Doodle Tower |
|---|---|---|
| Server process | The same Fastify server, Postgres, Caddy, VM and deploy | A `tower` module, a physics worker pool |
| Identity | Guest ids and join-token JWTs (`auth` module), drawn avatars (`avatars` module) | A separate JWT audience (`doodletower:ws`) |
| Words | `decks` and `cards`, read through the `decks` module's service | `tower_decks` allowlist |
| Drawing | Stroke schemas and the 1200×900 logical canvas (`protocol/drawing.ts`), stroke rendering | A new toolbar and skin |
| Guessing | `game-core` guess classifier, word masks, room codes, profanity filter, RNG | — |
| Metrics | `product_events` | New event names |
| Frontend | — | **Its own app**: `apps/tower-web` |

## Repository layout

```
apps/
  server/                 + src/modules/tower/  (rooms, routes, physics worker pool)
  web/                    DoodleWhirl (unchanged, except imports from canvas-engine)
  tower-web/              Doodle Tower: Astro + React, its own Tailwind theme and components
packages/
  protocol/               + src/tower/  (exported as @pictiotheme/protocol/tower)
  game-core/              unchanged. Tower reuses guess/, word-mask, room-code, rng
  canvas-engine/          ✅ stroke model, renderer, painting, flood fill, pointer gate, doodle cut-out (taken out of apps/web).
                          Each app keeps its own pointer input and toolbar
  doodle-shape/           ✅ pure: strokes → filled silhouette → normalized polygon → convex parts
  tower-core/             ✅ pure: the match state machine (crews, rounds, queue, placement, fumbles, win)
  tower-physics/          ✅ a Rapier wrapper: one world per tower, placing, fumbles, height, network frames
```

- `doodle-shape` and `tower-core` follow the `game-core` rules: **no I/O, no `Date.now`, no `Math.random`**. Whole matches can be simulated in unit tests.
- `tower-physics` is deterministic (Rapier's deterministic build), so its tests can assert exact outcomes.
- `doodle-shape` and `tower-physics` run on both sides: on the server (authoritative), and in the browser for the drawer's live piece preview, for the placer's own client moving the piece without lag, and for the [sandbox](../planning/roadmap.md#phase-0-sandbox).
- dependency-cruiser rules: `tower-core` may import `game-core` but not the other way round. `apps/web` and `apps/tower-web` must never import each other.

## Server: the `tower` module

`apps/server/src/modules/tower/`:

- `tower.service.ts`: `Map<roomCode, TowerRoomRuntime>`; create, join, look up, shutdown. Tower Mix words are cached for 10 minutes.
- `tower-room-runtime.ts`: the shell around the pure `tower-core` state machine (functional core, imperative shell), like DoodleWhirl's `RoomRuntime`. It owns the room's timers and its two physics worlds. Physics events go into the state machine; frames go straight to the players, and the runtime keeps the last pose of every body for players who (re)join.
- `tower.routes.ts`: `POST /api/tower/rooms`, `GET /api/tower/rooms/:code`, `POST /api/tower/rooms/:code/join`.
- `tower.repository.ts`: Tower Mix (the easy cards of enabled `tower_decks`, read-only join into the decks module's tables, rule B5) and match results. `tower-decks.ts` seeds the allowlist from `db:migrate`.
- **Physics runs off the main thread** (`physics/`): a pool of `worker_threads` (`TOWER_PHYSICS_WORKERS`, default cores − 1, at least 1). Each world lives on the worker with the fewest. Workers step at 60 Hz and send back frames (20/s, moving bodies; all bodies once a second), releases, fumbles and heights (10/s). In dev and tests the worker runs from TypeScript through `tsx`; the build bundles it as `dist/physics.worker.js` (`scripts/build.mjs`). A busy physics step can never delay DoodleWhirl's rooms or the HTTP API. See [physics.md](physics.md).
- The WebSocket endpoint `/ws/tower` lives in the `realtime` module next to `/ws`, sharing the heartbeat and the socket handling. Tower sockets have a connection registry of their own, and tower join tokens their own audience: a code or a token from one game never opens the other's room.

## Frontend

- `apps/tower-web`: Astro (static) + React SPA, Tailwind with **its own tokens**, its own component set. It doesn't import any DoodleWhirl UI component.
- **Behaviour is reused, skins aren't**: stroke rendering and the pointer gate come from `packages/canvas-engine`; the realtime client follows DoodleWhirl's pattern (one socket module, reconnect with a fresh token, snapshot, a pure view reducer, a zustand store).
- Layout of `src/app`: `realtime/` (connection, view reducer, frame interpolation), `lib/` (API client, identity with the drawn avatar, the generated bobble-hat avatar), `ui/`, and features: `home`, `room` (connects, picks the screen), `waiting`, `game` (screen, drawing stage and spy window, guess box, crew feed, Keep-or-Curse card, tower panels, placement controls, batched stroke sending), `results`, plus `drawing`, `piece`, `tower` and `sandbox` from Phase 0.
- Pages: `/` (home), `/r/CODE` (the room: `src/middleware.ts` in dev, Caddy in production, rewrite it to `/room`), `/sandbox`.
- Tower panels are drawn with **Canvas 2D**. Each piece's doodle is cached once as a bitmap and drawn at the body's position and angle every frame. Switch to PixiJS only if profiling shows Canvas 2D is too slow.

## Domain and deployment

- Its own subdomain, `tower.tierney.one`, beside DoodleWhirl's `doodle.tierney.one` and the games portal's `games.tierney.one`. `infra/Caddyfile` has a second site block, `{$TOWER_SITE_ADDRESS}` (with `TOWER_TLS_DIRECTIVE`), serving the `tower-web` build from `/srv/tower` and proxying `/api` and `/ws/tower` to the same server. Each site stays same-origin, so there's still no CORS. Until `TOWER_SITE_ADDRESS` is set it answers on `tower.localhost` only.
- The server gets `TOWER_PUBLIC_ORIGIN` (set from `TOWER_SITE_ADDRESS` in `compose.prod.yaml`). The `origin-check` plugin accepts every site's origin.
- **One guest and one profile for every game** ([decisions.md](../../technical/decisions.md#d13--one-profile-for-every-game-a-portal-a-shared-guest-and-an-account-widget) D13): the guest cookie is set for the parent domain (`COOKIE_DOMAIN=tierney.one`), and the name and drawing are the shared profile (`/api/me`). `lib/identity.ts` keeps its API (`identity`, `drawn`, `setName`, `setDrawing`) over the profile store from `@pictiotheme/account`, and moves the old `doodle-tower.identity` from browser storage into the profile once. The account widget sits in the top-left corner of every screen (`features/account`, `AccountCorner`: the shared widget in Tower's colours; in the waiting room's header; just the avatar during a match). On the home page it points at the identity card, which saves a typed name to the profile after a short pause. In a room, saving in the widget's editor also sends `PUT /api/tower/rooms/:code/me`, and everyone's crew list updates (tower-core's `identity` event).
- `infra/web.Dockerfile` builds the static sites into the Caddy image.
- Cloudflare: proxied DNS records on the `tierney.one` zone; its Origin certificate covers `*.tierney.one`.
