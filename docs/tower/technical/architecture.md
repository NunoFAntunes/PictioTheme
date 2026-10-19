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
  canvas-engine/          ✅ stroke model, renderer, painting, flood fill, pointer gate (taken out of apps/web).
                          Each app keeps its own pointer input and toolbar
  doodle-shape/           ✅ pure: strokes → filled silhouette → normalized polygon → convex parts
  tower-core/             Phase 1, pure: the match state machine (crews, rounds, queue, placement, fumbles, win)
  tower-physics/          ✅ a Rapier wrapper: one world per tower, placing, fumbles, height (frames come in Phase 1)
```

- `doodle-shape` and `tower-core` follow the `game-core` rules: **no I/O, no `Date.now`, no `Math.random`**. Whole matches can be simulated in unit tests.
- `tower-physics` is deterministic (Rapier's deterministic build), so its tests can assert exact outcomes.
- `doodle-shape` and `tower-physics` run on both sides: on the server (authoritative), and in the browser for the drawer's live piece preview, for the placer's own client moving the piece without lag, and for the [sandbox](../planning/roadmap.md#phase-0-sandbox).
- dependency-cruiser rules: `tower-core` may import `game-core` but not the other way round. `apps/web` and `apps/tower-web` must never import each other.

## Server: the `tower` module

- It's like `rooms` + `realtime`: `Map<roomCode, TowerRoomRuntime>`. Each runtime wraps the pure `tower-core` state machine and runs its effects (functional core, imperative shell).
- WebSocket endpoint: `/ws/tower?token=<joinToken>`. REST under `/api/tower/*` (create, join, look up a room, list the allowed decks, share card).
- It reads cards **through the `decks` module's public service**, never from the tables directly, and avatars through `avatars`.
- **Physics runs off the main thread.** A pool of `worker_threads` (cores − 1, at least 1) owns the Rapier worlds. Rooms are assigned to workers. The main thread sends placement inputs and new pieces. Workers send back frames and events (`settled`, `fumbled`, `height`). This way a busy physics step can never delay DoodleWhirl's rooms or the HTTP API. See [physics.md](physics.md).
- Room codes come from the same generator but a separate registry. A Doodle Tower code doesn't open a DoodleWhirl room.

## Frontend

- `apps/tower-web`: Astro (static) + React SPA, Tailwind with **its own tokens**, its own component set. It doesn't import any DoodleWhirl UI component.
- **Behaviour is reused, skins aren't**: stroke rendering and pointer input come from `packages/canvas-engine`, the realtime client pattern (reconnect, snapshot) is copied or extracted, `zustand` stores and React Query as in DoodleWhirl.
- Tower panels are drawn with **Canvas 2D**. Each piece's doodle is cached once as a bitmap and drawn at the body's position and angle every frame. Switch to PixiJS only if profiling shows Canvas 2D is too slow.

## Domain and deployment

- Its own domain (to be chosen). Caddy gets a second site block: `{$TOWER_SITE_ADDRESS}` serves the `tower-web` build and proxies `/api` and `/ws/tower` to the same `server:3000`. Each site stays same-origin, so there's still no CORS.
- The `origin-check` plugin accepts both origins. Tower routes only accept the tower origin.
- Cookies are per domain, so a guest in DoodleWhirl and in Doodle Tower are different guests. Shared accounts come with Better Auth later ([open-questions.md](../planning/open-questions.md)).
- `infra/web.Dockerfile` builds both static sites into the Caddy image.
- Cloudflare: a second zone on the free plan.
