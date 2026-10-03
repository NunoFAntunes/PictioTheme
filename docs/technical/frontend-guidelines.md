# Frontend Guidelines

Rules for `apps/web` (Astro + React). Rules are numbered (W1…) so reviews can cite them. 🔒 marks rules enforced in CI.

## Shape: a static Astro site plus one React app

Astro builds to **static files** (`output: 'static'`). Caddy serves them. There is no Node process for the frontend.

| Part | Built with | Examples |
|---|---|---|
| **Static pages** | `.astro` files, zero JS by default, SEO-friendly | Landing, about, how to play, privacy, terms, featured-decks showcase |
| **The app** | One React SPA, mounted as `<App client:only="react" />` on a single shell page (`src/pages/app.astro`) | Lobby, room `/r/ABC-DEF`, deck library, generation, account, purchase |

Caddy rewrites app routes (`/play`, `/r/*`, `/decks*`, `/generate*`, `/account*`) to the shell page, and **React Router** handles routing inside it. The list lives in `src/app-routes.ts`. In dev, `src/middleware.ts` performs the same rewrite and Astro proxies `/api` and `/ws` to the server, so dev is same-origin like production. Static pages may have small islands (e.g. a "join with code" box on the landing page using `client:visible`). Each island stays small and doesn't import the app.

Deck library pages are client-rendered in v1. If search engines need to index decks later, add the Astro Node adapter for those routes only, or rebuild static deck pages on a schedule.

## Layout

```
apps/web/
  astro.config.mjs          output: 'static', React integration, Tailwind
  src/
    pages/                  Astro routes: index.astro, privacy.astro, terms.astro, app.astro (shell)
    layouts/                Astro layouts (head, meta, fonts)
    components/             Astro-only components for static pages
    app/                    ── the React SPA ──
      main.tsx              <App/>: providers (QueryClient, Router), error boundary
      routes/               One folder per screen: lobby/, room/, decks/, generate/, account/
      features/             Reusable product pieces: canvas/, chat/, player-list/, deck-picker/, avatar/
        <feature>/
          components/       React components
          api.ts            TanStack Query hooks for this feature's REST calls
          store.ts          Zustand store (only if the feature has client state)
          index.ts          Public API of the feature
      realtime/             WebSocket client, reconnect, clock offset, message → store dispatch
      lib/                  api client (typed fetch), formatting, small hooks
      ui/                   shadcn/ui components (generated, lightly edited)
    styles/
```

## Rules

### Structure

- **W1 🔒** `routes/*` may import `features/*`, `realtime/`, `lib/`, `ui/`. `features/*` import other features **only through their `index.ts`**. `ui/` and `lib/` import nothing from `features` or `routes`.
- **W2** Static `.astro` pages never import from `src/app/` except the shell page. Islands live in `src/components/` and stay tiny.
- **W3** Shared types come from `@pictiotheme/protocol`. Never redeclare a DTO or message type in the web app.

### Data and state

- **W4** **REST data goes through TanStack Query**, with hooks in each feature's `api.ts`. Components never call `fetch` directly.
- **W5** **Realtime data goes through one place**: `realtime/` owns the socket, validates incoming messages with the protocol schemas, and dispatches them into the room store (Zustand). Components read from the store and send intents through `realtime.send(...)`. **No component touches the WebSocket.**
- **W6** Server state stays in TanStack Query, live room state in the room store, and pure UI state (open dialogs, selected tool) in local component state. Nothing is duplicated between them.
- **W7** The client never decides game outcomes. It renders what the server sends: scores, phases, `endsAt`. Countdowns are `endsAt − (Date.now() + clockOffset)`.

### Canvas

- **W8** The drawing engine in `features/canvas/engine/` is **plain TypeScript with no React**: stroke model, renderer, flood fill, undo checkpoints, input smoothing. React wraps it through a ref and passes settings in.
- **W9** **Strokes never go into React state.** Pointer events feed the engine directly. Rendering runs on `requestAnimationFrame`. Only toolbar settings (tool, colour, size, opacity) are React state.
- **W10** The engine draws at the fixed logical resolution (1200×900) and scales to the element. Flood fill runs offscreen at logical resolution so it is deterministic ([realtime-protocol.md](realtime-protocol.md#drawing-sync)).
- **W11** The engine has unit tests (stroke encoding, fill, undo) in Vitest, separate from component tests.

### Style

- **W12 🔒** TypeScript strict, named exports, no `any`. Components are `PascalCase.tsx`, everything else `kebab-case.ts`.
- **W13** Tailwind utility classes. Extract a component, not a CSS class, when a pattern repeats. Design tokens (colours, radii) live in the Tailwind theme.
- **W14** Accessibility: all controls are keyboard-reachable and labelled. Toolbar shortcuts follow [drawing-tools.md](../product/drawing-tools.md). Colour is never the only signal (close guesses are red **and** redacted).
- **W15** Mobile first for the guesser view. The drawer's toolbar collapses into a bottom sheet on small screens.
