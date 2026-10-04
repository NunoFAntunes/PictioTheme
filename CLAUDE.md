# PictioTheme

Real-time drawing-and-guessing game with themed, AI-generated decks. TypeScript monorepo: Fastify server, Astro + React web app, shared `protocol` and pure `game-core` packages.

## Start here

1. [docs/planning/status.md](docs/planning/status.md): what's done, what's next, how to verify. **Update it when you finish work.**
2. [docs/technical/architecture.md](docs/technical/architecture.md), then the [backend](docs/technical/backend-guidelines.md) and [frontend](docs/technical/frontend-guidelines.md) guidelines. Rules marked 🔒 are enforced in CI.
3. Product rules: [docs/product/](docs/product/). The protocol: [docs/technical/realtime-protocol.md](docs/technical/realtime-protocol.md).

## Commands

```sh
pnpm db:up                                   # Postgres for dev + tests (needed by server tests)
pnpm dev                                     # server :3000 + web :4321
pnpm check                                   # typecheck + lint + import boundaries + unit tests
pnpm format                                  # prettier
pnpm --filter @pictiotheme/web test:e2e      # Playwright, uses installed Google Chrome
```

## Things that will bite you

- `astro dev` auto-backgrounds when run by an AI agent. Use `pnpm --filter @pictiotheme/web dev:foreground`, or `npx astro dev stop` to clean up.
- Don't bypass pnpm's minimum-release-age policy (`minimumReleaseAgeExclude`). Pin an older version.
- TypeScript stays on 6.0 (typescript-eslint doesn't support 7 yet).
- Protocol changes start in `packages/protocol`, then server/game-core, then the web reducer, then the docs.
- Never mock the database in tests. `game-core` must stay pure (no I/O, no `Date.now`, no `Math.random`).
