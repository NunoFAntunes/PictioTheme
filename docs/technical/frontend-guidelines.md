# Frontend Guidelines

Rules for `apps/web` (Astro + React). Rules are numbered (W1…) so reviews can cite them. 🔒 marks rules enforced in CI.

## Shape: a static Astro site plus one React app

Astro builds to **static files** (`output: 'static'`). Caddy serves them. There is no Node process for the frontend.

| Part | Built with | Examples |
|---|---|---|
| **Static pages** | `.astro` files, zero JS by default, SEO-friendly | Landing, about, how to play, privacy, terms, featured-decks showcase |
| **The app** | One React SPA, mounted as `<App client:only="react" />` on a single shell page (`src/pages/app.astro`) | Lobby, room `/r/ABC-DEF`, deck library, generation, account, purchase |

Caddy rewrites app routes (`/r/*`, `/decks*`, `/generate*`, `/account*`) to the shell page and redirects the old lobby (`/play`) to `/`, and **React Router** handles routing inside it. The list lives in `src/app-routes.ts`. In dev, `src/middleware.ts` performs the same rewrite and redirect, and Astro proxies `/api` and `/ws` to the server, so dev is same-origin like production. Static pages may have small islands. Each island stays small and doesn't import the app, with one exception: the home page (`/`) is the lobby (user-flows.md §2), so it mounts the **home lobby island** (`src/components/home/`), which reuses app features through their `index.ts`. Entering a room from it is a full page load of `/r/CODE` in the shell page.

Deck library pages are client-rendered in v1. If search engines need to index decks later, add the Astro Node adapter for those routes only, or rebuild static deck pages on a schedule.

## Layout

What exists today (folders marked *planned* come with later phases):

```
apps/web/
  astro.config.mjs          static output, React, Tailwind, dev proxy, optimizeDeps list
  playwright.config.ts      browser tests (e2e/), starts both dev servers
  e2e/                      Playwright specs: real browsers against the real dev stack
  src/
    app-routes.ts           paths served by the app shell (keep in sync with Caddy)
    middleware.ts           dev-only rewrite of app routes to /app
    pages/                  index.astro (landing), app.astro (the React shell)
    layouts/                BaseLayout.astro
  public/sounds/            the game's sound clips (MP3, CC0; see docs/design/sounds.md)
    styles/global.css       Tailwind + design tokens (@theme)
    app/                    ── the React SPA ──
      main.tsx              <App/>: QueryClient + React Router routes
      routes/
        lobby/              identity → create room / join by code / public rooms
        room/               RoomPage (identity gate, connect, 3-column layout), GameBoard
      realtime/             THE socket layer (rule W5)
        connection.ts       connectRoom(), sendToRoom(), drawAndSend(), reconnect, clock sync
        room-view.ts        pure reducer: ServerMessage → RoomView (unit-tested)
        room-store.ts       Zustand store: view, connection state, clockOffset
        stroke-model.ts     the current drawing, outside React (rule W9)
        selectors.ts        read helpers + useSecondsLeft / useNow hooks
        index.ts            public API for features and routes
      features/             one folder per product piece, each with components/ and index.ts
        avatar/  identity/ (incl. useEnsureIdentity)  join-room/  lobby/ (create, quick play, RoomNotes)  server-status/
        deck-picker/ (DeckChooser, DeckPicker)  phone-gate/  generate-deck/ (incl. RedrawCoverPanel)  deck-cover/ (DeckCover with the default cover, CoverPad, PNG export)
        report-deck/        ReportDeckButton (🚩 report a deck's cover or content)
        canvas/             engine/ (flood-fill, paint, renderer, input, adjust, brush-cursor),
                            shortcuts.ts + DrawingBoard, Toolbar (both also drive the cover pad), SketchPad (avatar pad)
        player-list/  guess-feed/  room-header/  turn-overlays/  waiting-room/  results/
        sound/              Web Audio engine, sound catalog + groups, saved volume settings,
                            RoomSounds (message → sound, turn clock),
                            drawing-sounds (stroke model → pencil loop + fill glug), SoundSettingsButton
      lib/                  api.ts (typed fetch), identity.ts (name + avatar in localStorage)
      ui/                   (planned) shadcn/ui components
```

### How a room screen works

1. `RoomPage` makes sure the player has a name and avatar (`lib/identity`), then calls `connectRoom(code, identity)`.
2. `connectRoom` creates or reuses the guest session, asks `POST /api/rooms/:code/join` for a 60-second join token, and opens `/ws?token=…`. **Every reconnect fetches a fresh token.** Close codes decide whether to retry: [realtime-protocol.md](realtime-protocol.md#close-codes).
3. Incoming messages are validated with `ServerMessage`. `draw:*` goes to the stroke model. Everything else goes through `applyServerMessage` into the room store. A new turn (`phase:choosing`, or `phase:drawing` when the previous phase wasn't drawing) clears the stroke model. `phase:drawing` re-sent after a pause does not clear it.
4. Components select from `useRoomStore` and send intents with `sendToRoom(msg)`. The drawer's canvas input calls `drawAndSend(op)`, which applies the operation locally first (input-to-ink < 16 ms), because the server doesn't echo drawing back to the drawer.
5. Countdowns use `useSecondsLeft(endsAt)`, which reads the server clock (`Date.now() + clockOffset`, measured with ping/pong every 10s).

### Canvas engine

- `renderer.ts`: finished operations are painted once onto an offscreen **base** canvas. The stroke still in progress is repainted on top each frame. An undo or reset bumps the model's `epoch`, which repaints the base from scratch. There are no checkpoints yet (see [status.md](../planning/status.md)).
- `paint.ts`: strokes are perfect-freehand outlines filled once, with `globalAlpha` (so opacity is even) and `destination-out` for the eraser. Fill is `flood-fill.ts` on the base canvas pixels.
- `input.ts`: Pointer Events (with coalesced events) → `draw:begin`, then `draw:pts` batches every 33 ms (points under 1.5 px apart are dropped), then `draw:end`. A right-button or Ctrl/Cmd press starts the **adjust drag** instead; the maths (axis lock, exponential size) is in `adjust.ts`.
- `brush-cursor.ts`: the ring that previews the brush at its real on-screen size. Plain DOM in an empty layer over the canvas, moved on pointer events without React.
- `shortcuts.ts` (outside `engine/`): key → action. Size and opacity keys use `KeyboardEvent.code` so they work on any layout.
- Everything runs at the logical 1200×900. The `<canvas>` element is that size and CSS scales it.

## Rules

### Structure

- **W1 🔒** `routes/*` may import `features/*`, `realtime/`, `lib/`, `ui/`. `features/*` may import `realtime/`, `lib/`, `ui/`, and other features **only through their `index.ts`**. `ui/` and `lib/` import nothing from `features`, `routes` or `realtime`.
- **W2** Static `.astro` pages never import from `src/app/` except the shell page. Islands live in `src/components/` and stay tiny. Exception: the home lobby island (`src/components/home/`) may import app features (through their `index.ts`) and `src/app/lib/`, never routes or the router.
- **W3** Shared types come from `@pictiotheme/protocol`. Never redeclare a DTO or message type in the web app.

### Data and state

- **W4** **REST data goes through TanStack Query**, with hooks in each feature's `api.ts`. Components never call `fetch` directly.
- **W5** **Realtime data goes through one place**: `realtime/` owns the socket, validates incoming messages with the protocol schemas, and dispatches them into the room store (Zustand). Components read from the store (`useRoomStore`) and send intents through `sendToRoom(...)` / `drawAndSend(...)`. **No component touches the WebSocket.**
- **W6** Server state stays in TanStack Query, live room state in the room store, and pure UI state (open dialogs, selected tool) in local component state. Nothing is duplicated between them.
- **W7** The client never decides game outcomes. It renders what the server sends: scores, phases, `endsAt`. Countdowns are `endsAt − (Date.now() + clockOffset)`.

### Canvas

- **W8** The drawing engine in `features/canvas/engine/` is **plain TypeScript with no React**: renderer, painting, flood fill, input. The stroke model lives in `realtime/` because the connection feeds it. React wraps the engine through a ref and passes settings in.
- **W9** **Strokes never go into React state.** Pointer events feed the engine directly. Rendering runs on `requestAnimationFrame`. Only toolbar settings (tool, colour, size, opacity) are React state.
- **W10** The engine draws at the fixed logical resolution (1200×900) and scales to the element. Flood fill runs offscreen at logical resolution so it is deterministic ([realtime-protocol.md](realtime-protocol.md#drawing-sync)).
- **W11** Pure logic has Vitest unit tests: flood fill, the stroke model, the room-view reducer. Anything that needs a real browser (canvas rendering, sockets, the full flow) is covered by Playwright in `e2e/`.

### Style

- **W12 🔒** TypeScript strict, named exports, no `any`. Components are `PascalCase.tsx`, everything else `kebab-case.ts`.
- **W13** Tailwind utility classes. Extract a component, not a CSS class, when a pattern repeats. Design tokens (colours, radii) live in the Tailwind theme.
- **W14** Accessibility: all controls are keyboard-reachable and labelled. Toolbar shortcuts follow [drawing-tools.md](../product/drawing-tools.md). Colour is never the only signal (close guesses are red **and** redacted).
- **W15** Desktop and tablets (phones get the phone gate). Below 1024 px wide (tablets in portrait) the room stacks the board over Players/Guesses tabs (`RoomPage.tsx`, `useMediaQuery` in `lib/`). Controls used while drawing get finger-sized targets on touch screens with Tailwind's `pointer-coarse:` variant (44 px buttons, 36 px swatches), as in `Toolbar.tsx`.

## Testing

| Kind | Where | Run | Notes |
|---|---|---|---|
| Unit | `src/**/*.test.ts` | `pnpm --filter @pictiotheme/web test` | Pure modules only (Node environment): reducers, stroke model, flood fill |
| Browser (e2e) | `e2e/*.spec.ts` | `pnpm --filter @pictiotheme/web test:e2e` | Every spec runs in the installed **Google Chrome** (`channel: 'chrome'`). Input specs (`brush-controls`) also run in Playwright's **Firefox and WebKit**: install them once with `pnpm --filter @pictiotheme/web exec playwright install firefox webkit`, or pick a browser with `--project=chrome`. Starts the server and Astro (or reuses running ones locally). Needs Postgres (`pnpm db:up`) and `apps/server/.env` |

Shared steps (identity, `startTurn`, `newPlayerPage`) live in `e2e/support.ts`. Open players with `newPlayerPage(browser)`: it hides the Astro dev toolbar, which otherwise sits over the bottom centre of the page and intercepts clicks there ("Start game" in a 720 px window). `brush-controls.spec.ts` checks the adjust drag, the ring's on-screen size, Escape, keyboard steps and that the context menu stays closed. The turn spec drives two browser contexts through a full turn: create, join by invite link, start, choose, draw (it checks pixels on the guest's canvas), a wrong guess, the right guess, reveal. Use `data-testid` only where no accessible role or label exists (`room-code`, `current-word`).

## Dev gotchas

- **Astro 7 auto-backgrounds `astro dev` when it detects an AI agent.** The command returns immediately and the server keeps running. Use `pnpm --filter @pictiotheme/web dev:foreground` (adds `--ignore-lock`) to keep it attached, and `npx astro dev stop` / `status` to manage a background one. Playwright uses `dev:foreground`.
- **New runtime dependency in `src/app`? Add it to `optimizeDeps.include`** in `astro.config.mjs`. Otherwise the first cold page load can fail with "504 Outdated Optimize Dep" while Vite re-bundles.
- Don't delete `node_modules/.vite` while a dev server is running.
- Playwright's bundled Firefox doesn't start on macOS 27 ("Could not find profile folder"). Run `--project=chrome --project=webkit` locally; CI (Ubuntu) runs Firefox.
