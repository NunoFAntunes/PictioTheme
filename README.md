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
packages/protocol zod schemas shared by server and web (messages, DTOs, deck schema, error codes)
packages/game-core Pure game logic: guess matching, scoring, card pool, room codes, word masks
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

## Commands

| Command                                         | What it does                                                  |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                                      | Run server and web in watch mode                              |
| `pnpm check`                                    | Everything CI runs: typecheck, lint, import boundaries, tests |
| `pnpm test`                                     | Unit and integration tests (server tests need `pnpm db:up`)   |
| `pnpm deps:check`                               | Enforce the module boundaries from the guidelines             |
| `pnpm format`                                   | Format with Prettier                                          |
| `pnpm build`                                    | Build the server bundle and the static site                   |
| `pnpm --filter @pictiotheme/web test:e2e`       | Browser test: two Chrome windows play a turn (needs `db:up`)  |
| `pnpm --filter @pictiotheme/server db:generate` | Generate a migration after changing `src/db/schema/`          |
| `pnpm --filter @pictiotheme/server db:migrate`  | Apply migrations                                              |
