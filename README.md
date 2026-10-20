# DoodleWhirl!

A browser-based, real-time drawing-and-guessing game built around AI-generated themed decks.
Product and technical docs live in [docs/](docs/README.md). Start with
[architecture.md](docs/technical/architecture.md) and the
[backend](docs/technical/backend-guidelines.md) / [frontend](docs/technical/frontend-guidelines.md)
guidelines before writing code. Current state and next tasks: [docs/planning/status.md](docs/planning/status.md).

## Repository

```
apps/server       Fastify modular monolith (REST API, WebSocket rooms, jobs). Owns the DB schema
apps/web          Astro static site + React app
apps/tower-web    Doodle Tower: its own Astro + React site (docs in docs/tower/)
packages/protocol zod schemas shared by server and web (messages, DTOs, deck schema, error codes)
packages/game-core Pure game logic: guess matching, scoring, card pool, room codes, word masks
packages/canvas-engine  The drawing engine both games share: stroke model, renderer, painting, flood fill
packages/doodle-shape   Doodle Tower, pure: a drawing → a normalized, convex-decomposed physics piece
packages/tower-physics  Doodle Tower: one tower's Rapier world (placing, fumbles, height)
infra/            Docker Compose and deployment files
docs/             Product, design and technical documentation
```

## Getting started

Requirements: Node 24 (`.nvmrc`), pnpm 12, Docker.

```sh
pnpm install
pnpm db:up                                   # Postgres 18 on localhost:5433 (dev + test databases)
cp apps/server/.env.example apps/server/.env
pnpm --filter @pictiotheme/server db:migrate
pnpm dev                                     # server on :3000, web on :4321
```

Open http://localhost:4321. In dev, Astro proxies `/api` and `/ws` to the server, so everything is
same-origin like in production.

## Restarting the servers

Doodle Tower runs on the same API server as DoodleWhirl! (`:3000`, which also hosts the tower's `/ws/tower` socket and physics workers), plus its own site on `:4322`. Restart the server after changing `apps/server/.env` or if the tower's physics workers have crashed (a crashed worker freezes its rooms' towers).

**Locally**

```sh
# 1. Stop it: Ctrl+C in the terminal running it. If it's orphaned or the port is busy:
lsof -ti :3000 | xargs kill        # API server (use :4322 for the tower site)
npx astro dev stop                 # AI-agent-started Astro dev servers (run in apps/web or apps/tower-web)

# 2. Start it again
pnpm db:up                         # Postgres must be running
pnpm dev                           # API on :3000 + DoodleWhirl! on :4321
pnpm dev:tower                     # Doodle Tower on :4322 (needs the API above)
```

Only the API server needs restarting for server changes; `tsx watch` already reloads it on code edits. If the API runs on another port: `PORT=3100 pnpm --filter @pictiotheme/server dev` and `TOWER_API_PORT=3100 pnpm dev:tower`.

**Production (the VM)**: restarting **ends live games**.

```sh
ssh ubuntu@<vm-ip>
cd /opt/pictiotheme
docker compose restart server      # after editing .env, or to recover a stuck server
docker compose ps                  # check it's healthy
docker compose logs -f server
```

To ship new code instead, merge `main` into `production` (see [deployment.md](docs/technical/deployment.md)).

## Commands

| Command                                         | What it does                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev`                                      | Run server and web in watch mode                                                         |
| `pnpm dev:tower`                                | Doodle Tower's site on :4322 (with `pnpm dev`'s API; `TOWER_API_PORT` if it's elsewhere) |
| `pnpm check`                                    | Everything CI runs: typecheck, lint, import boundaries, tests                            |
| `pnpm test`                                     | Unit and integration tests (server tests need `pnpm db:up`)                              |
| `pnpm deps:check`                               | Enforce the module boundaries from the guidelines                                        |
| `pnpm format`                                   | Format with Prettier                                                                     |
| `pnpm build`                                    | Build the server bundle and the static site                                              |
| `pnpm --filter @pictiotheme/web test:e2e`       | Browser test: two Chrome windows play a turn (needs `db:up`)                             |
| `pnpm --filter @pictiotheme/server db:generate` | Generate a migration after changing `src/db/schema/`                                     |
| `pnpm --filter @pictiotheme/server db:migrate`  | Apply migrations                                                                         |
