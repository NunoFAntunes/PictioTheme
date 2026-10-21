# Adding a game

This repo hosts several games on one server, one database and one player profile: DoodleWhirl! (`apps/web`), Doodle Tower (`apps/tower-web`), and the **games portal** (`apps/portal`) that lists them. This guide explains what a new game gets for free, the few rules it must follow, and every place it has to be registered. Doodle Tower is the worked example throughout: when in doubt, copy what it does.

The why behind the shared parts is in [decisions.md](decisions.md#d13--one-profile-for-every-game-a-portal-a-shared-guest-and-an-account-widget) D13. The short version is in [architecture.md](architecture.md#one-profile-for-every-game).

## How the games fit together

```
                 games.tierney.one        doodle.tierney.one        tower.tierney.one       <game>.tierney.one
                 apps/portal              apps/web                  apps/tower-web          apps/<game>-web
                      │                        │                          │                       │
                      └──────────── same-origin /api (and /ws/…) through Caddy, one per site ─────┘
                                                        │
                                       apps/server (one Fastify process)
              shared: auth (guest cookie) · players (/api/me) · avatars · decks · moderation
              per game: modules/rooms + /ws (DoodleWhirl) · modules/tower + /ws/tower · modules/<game> + /ws/<game>
                                                        │
                                                    Postgres
```

- **One guest everywhere.** Every site is a subdomain of one parent domain. The guest cookie (`play_guest`) is set for that parent (`COOKIE_DOMAIN`), so the portal and every game see the same guest. A game never makes its own cookie or session.
- **One player id.** The server turns the cookie into an `Actor` whose `playerKey` is the player's `players` row. `playerIdOf(actor)` (`g_<players.id>`) is the id to use in rooms and in every stored record (match results, votes, reports). Never build a player id yourself. When accounts arrive, a guest who signs up stays the same player, so their history in your game follows them.
- **One profile.** The player's name and drawing live on the server (`players`, `GET`/`PUT /api/me`). Your game reads and changes them through `@pictiotheme/account`. It never keeps its own name or avatar in browser storage.
- **Rooms don't depend on the profile.** A room takes `PlayerIdentity` (`displayName`, `avatar`) on join, like before. The profile only decides what the game sends.

## What a new game gets for free

| Need | Use | Where |
|---|---|---|
| Who the player is, on the server | `actorOf(request)`, `playerIdOf(actor)` | `apps/server/src/plugins/actor.ts`, `lib/actor.ts` |
| Their name and drawing, in the browser | `createGameIdentity({ fallbackAvatar, actions })` | `@pictiotheme/account` |
| "Who you are" in the corner, with an editor | `<AccountWidget>` (skinnable with `--acct-*` CSS properties) | `@pictiotheme/account/ui` |
| Room names that follow the profile | `useRoomFollowsIdentity(identity, push)` | `@pictiotheme/account` |
| Where each site lives (links to the portal and other games) | `siteUrl('portal', import.meta.env)` | `@pictiotheme/sites` |
| Profanity checks for names, chat and guesses | `hasProfanity`, `maskProfanity` | `@pictiotheme/moderation` |
| A drawing canvas, fills, cut-out avatars | stroke model, `paintOp`, `drawingToAvatar` | `@pictiotheme/canvas-engine` |
| Stored avatars (content-addressed PNGs) | `AvatarsService.store` | server `avatars` module |
| Themed word decks | `DecksService`; map them with a `<game>_decks` table like `tower_decks` | server `decks` module |
| Join tokens for the socket | `auth.issueJoinToken(claims, <GAME>_AUDIENCE)` | server `auth` module |
| Link previews for invite links | the `invite_previews` Caddy snippet + your `/rooms/:code/embed` | `infra/Caddyfile` |
| CSRF, rate limits, error format, logging | registered globally in `app.ts` | server `plugins/` |

## Rules a game must follow

These keep games independent of each other while sharing everything above. Most are enforced in CI (`pnpm deps:check`, lint).

1. **Pick one short id** (`tower`, say `<game>` here) and use it everywhere: the site id in `packages/sites`, `/api/<game>/`, `/ws/<game>`, the `<game>_` table prefix, `apps/<game>-web`, `packages/<game>-core`, `/srv/<game>` in the web image, and `docs/<game>/`.
2. **Games don't import each other.** Apps share code only through `packages/` (rule `apps-are-separate`). If two games need the same thing, move it into a package that names no game, as was done for `moderation` and `account`. Doodle Tower still borrows word-game helpers (hints, card prep, shuffling) from DoodleWhirl's `game-core`. A third game that needs them should first move them into a shared package.
3. **Routes say whose they are** (backend rule B30). Shared routes are unprefixed (`/api/session`, `/api/me`, `/api/avatars`). Yours go under `/api/<game>/…` and your socket at `/ws/<game>`.
4. **Tables say whose they are.** Your tables are prefixed `<game>_` and owned by your server module (rule B5). Reference shared tables (`decks`, `avatars`) by foreign key and store players as `playerIdOf(actor)`.
5. **The game core is pure** (rule B6): no I/O, no `Date.now`, no `Math.random`, as for `game-core` and `tower-core`.
6. **Identity comes from the profile.** Use `createGameIdentity`, send the identity on join, and keep the room in sync with `useRoomFollowsIdentity`. Don't store names or avatars in `localStorage`.
7. **Never mock the database in tests.** Server tests run against the dev Postgres (`pnpm db:up`).

## Step by step

### 1. Docs and the site's address

- Create `docs/<game>/` with the same sections as [docs/tower/](../tower/README.md): `product/` (vision, rules), `design/`, `technical/` (architecture, data model, realtime protocol) and `planning/status.md`. Link it from [docs/README.md](../README.md).
- Add the site to `packages/sites/src/index.ts`: `devUrl` (the next free localhost port), `url` (`https://<game>.tierney.one`) and `env` (`PUBLIC_<GAME>_URL`, a build-time override).
- List it on the portal: add an entry to `GAMES` in [apps/portal/src/site.ts](../../apps/portal/src/site.ts) with `url: siteUrl('<game>', import.meta.env)`, and put its icon in `apps/portal/public/games/`.

### 2. Shared contract and pure rules

- **Protocol:** put the game's messages and DTOs in `packages/protocol/src/<game>/` and export them as a subpath (`"./<game>"` in `packages/protocol/package.json`, like `./tower`). Reuse `PlayerIdentity`, `JoinRoomResponse` and `UpdateIdentityResponse` from the root for joining and renaming. Protocol changes start here, then the server and core, then the client, then the docs.
- **Core:** create `packages/<game>-core`, a pure state machine (`step(state, event, ctx)` returning effects, as in `tower-core`). Include an `identity` event for renames (tower-core's `onIdentity`). Add it to `.dependency-cruiser.cjs` with an allowed-dependencies rule like `tower-core-allowed-dependencies`, and to the pure-code block in `eslint.config.js` (no `Date.now`/`Math.random`).

### 3. Server

Create `apps/server/src/modules/<game>/` with an `index.ts` that is the only thing other modules import (rule B1). Model it on `modules/tower`:

- `<game>.service.ts`: rooms in memory, `createRoom`/`joinRoom` that check the name (`hasProfanity`), store the avatar (`avatars.store`) and issue a join token, plus `updateIdentity(actor, code, identity)` for renames.
- `<game>.routes.ts`, registered in `app.ts` with `prefix: '/api/<game>'`: at least `POST /rooms`, `POST /rooms/:code/join` and `PUT /rooms/:code/me`. Add `GET /rooms/:code/embed` and `card.png` if invite links should unfurl with a share card.
- `<game>.repository.ts` and `apps/server/src/db/schema/<game>.ts` (exported from `schema/index.ts`) for anything persisted, then `pnpm --filter @pictiotheme/server db:generate` for the migration.
- **Socket:** add `<GAME>_AUDIENCE` next to `TOWER_AUDIENCE` in `modules/auth/auth.service.ts`, so one game's join token never opens another game's room. Add a `/ws/<game>` route to `modules/realtime/realtime.gateway.ts` that verifies the token with that audience (copy the `/ws/tower` route).
- **Config:** add `<GAME>_PUBLIC_ORIGIN` to `config.ts` (default `SITES.<game>.devUrl`), pass it to your service for share links, and add it to the `originCheck` origins in `app.ts`. Without it, every write from your site gets a 403.
- **Tests:** an e2e test like `tower.e2e.test.ts` with `buildApp(testConfig({ <GAME>_PUBLIC_ORIGIN: … }))`.

### 4. The game's site

Create `apps/<game>-web` by copying the shape of `apps/tower-web`: Astro with React islands, `src/app/{features,lib,realtime,ui}` (frontend rules W1–W5), a `package.json` whose `dev` script uses the port from `packages/sites`, and a Vite proxy for `/api` and `/ws` to the server (see `apps/tower-web/astro.config.mjs`).

Identity takes three files:

```ts
// src/app/lib/identity.ts: the game's view of the profile
import { createGameIdentity, saveProfile } from '@pictiotheme/account';
import { makeAvatar } from './avatar'; // your fallback: an avatar drawn from the name

const game = createGameIdentity({
  fallbackAvatar: makeAvatar,
  actions: () => ({
    setName: (displayName: string) => void saveProfile({ displayName }),
    setDrawing: (drawing: string | null) => void saveProfile({ drawing }),
  }),
});
export const useIdentity = game.useIdentity; // { identity, drawn, setName, setDrawing }
```

```ts
// src/app/features/account/use-follow-identity-in-room.ts: rooms follow the profile
export function useFollowIdentityInRoom(code: string): void {
  const identity = useIdentity((s) => s.identity);
  const push = useCallback((next: PlayerIdentity) => updateIdentityInRoom(code, next), [code]);
  useRoomFollowsIdentity(identity, push); // PUT /api/<game>/rooms/:code/me on every change
}
```

```tsx
// the room page: join with the identity as it is at each (re)connect, then follow it
const hasIdentity = useIdentity((s) => s.identity !== null);
useEffect(() => {
  if (!hasIdentity) return;
  return connectRoom(code, () => {
    const current = useIdentity.getState().identity;
    if (!current) throw new Error('no identity');
    return current;
  });
}, [code, hasIdentity]);
useFollowIdentityInRoom(code);
```

- **The corner:** show who the player is in the top-left of every screen, as the other games do. The quickest way is `<AccountWidget fallbackAvatar={…} portalUrl={PORTAL_URL} />` from `@pictiotheme/account/ui` wrapped in your colours (see Tower's `AccountCorner`). Pass `size="avatar"` during a match. A game with its own look can build its own on the store instead, as DoodleWhirl does with its "you" sticker.
- **The portal link:** `src/app/lib/portal.ts` is one line, `export const PORTAL_URL = siteUrl('portal', import.meta.env);`.
- **A first visit:** the profile may have no name yet. Either ask for one before joining (Tower's `NameGate`), or give one with `saveProfile({ displayName, nameChosen: false })`, which never overwrites a name the player picked elsewhere (DoodleWhirl's silly names).

### 5. Tooling

- `eslint.config.js`: add the app to the `apps/{web,tower-web,portal}` globs (browser globals, React hooks rules, default exports in `src/pages/**`).
- `.dependency-cruiser.cjs`: add `<GAME>_APP` and copy the two `tower-feature-boundaries` / `tower-ui-and-lib-are-leaves` rules.
- Root `package.json`: a `dev:<game>` script.
- `pnpm check` must pass: typecheck, lint, import boundaries, unit tests.

### 6. Infra and deploy

- [infra/Caddyfile](../../infra/Caddyfile): a site block. The shared snippets keep it short:

  ```
  {$<GAME>_SITE_ADDRESS:<game>.localhost} {
  	{$<GAME>_TLS_DIRECTIVE}
  	import security_headers
  	import invite_previews /api/<game>/rooms
  	handle /api/* {
  		import to_server
  	}
  	handle /ws/<game> {
  		import to_server
  	}
  	handle {
  		@room path /r/*
  		rewrite @room /room/index.html
  		import static_files /srv/<game>
  	}
  }
  ```

- `infra/web.Dockerfile`: `COPY apps/<game>-web/dist /srv/<game>`. `.dockerignore`: `!apps/<game>-web/dist`.
- `infra/compose.prod.yaml`: `<GAME>_PUBLIC_ORIGIN` for the server, and `<GAME>_SITE_ADDRESS` / `<GAME>_TLS_DIRECTIVE` for Caddy.
- CI builds every app with `pnpm --filter "./apps/*" build`, so the workflow needs no change.
- On the VM and in Cloudflare ([deployment.md](deployment.md)): a proxied DNS record for `<game>` **under the cookie's parent domain** (a game on another domain can't share the guest), and the new variables in `/opt/pictiotheme/.env`.

### 7. Check it end to end

1. `pnpm db:up`, `pnpm dev`, `pnpm dev:portal` and `pnpm dev:<game>`.
2. Name and draw yourself on the portal (`localhost:4323`). Open your game: it shows the same name and drawing.
3. Join a room from two browsers. Rename yourself in your game's widget: the other browser's player list updates without a reconnect.
4. While in the room, rename yourself on the portal in another tab, then switch back: the room follows.
5. An invite link pasted in a chat app unfurls with your share card (or test `/api/<game>/rooms/:code/embed` directly).

## Why some registrations stay manual

Each game still touches about ten files outside its own folders: Caddy, the Dockerfile, compose, `config.ts`, `app.ts`, the gateway, the auth audience, ESLint, dependency-cruiser and the portal list. Each carries something game-specific (its socket path, share links, a domain, boundary rules), so a generic loop would hide more than it saves. The parts that were plain repetition are shared instead: `packages/sites`, the `invite_previews` and `static_files` Caddy snippets, `createGameIdentity`, `useRoomFollowsIdentity`, and the single CI build step. If this list grows for a fourth game, that's the signal to generate it from `packages/sites`.
