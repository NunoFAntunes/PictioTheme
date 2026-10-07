# Data Model

Two kinds of state:

1. **Durable** (PostgreSQL): users, decks, cards, credits, purchases, match history.
2. **Ephemeral** (memory of the single server process): live rooms, players, strokes, timers, rate limits.

The schema is defined with Drizzle in `apps/server/src/db/schema/`, one file per owning module ([backend-guidelines.md](backend-guidelines.md#database)). All `uuid` primary keys default to `uuidv7()` (PostgreSQL 18), and all timestamps are `timestamptz`.

## PostgreSQL

```sql
-- Identity ------------------------------------------------------------------
users (
  id              uuid pk,
  email           citext unique null,
  display_name    text not null,
  avatar_id       text null fk avatars,     -- the avatar they last played with
  email_verified  bool default false,
  role            text default 'user',      -- 'user' | 'moderator' | 'admin'
  created_at      timestamptz,
  banned_at       timestamptz null
)
auth_accounts (user_id fk, provider text, provider_account_id text, pk(provider, provider_account_id))

-- Avatars (drawn by players; built) -------------------------------------------
avatars (
  id              text pk,                  -- first 32 hex chars of sha256(png): content-addressed
  png             bytea not null,           -- 128×128 PNG, ≤ 40 KB, checked by signature + IHDR
  created_at      timestamptz,
  last_used_at    timestamptz               -- bumped on every create/join; for cleaning up guests' avatars
)
-- Planned (Phase 3): registered users keep a gallery of their own drawn avatars.
user_avatars (user_id fk, avatar_id fk avatars, created_at, pk(user_id, avatar_id))

-- Decks ---------------------------------------------------------------------
deck_covers (                               -- built (migration 0003)
  id              text pk,                  -- first 32 hex chars of sha256(png): content-addressed
  png             bytea not null,           -- 300×400 PNG, ≤ 150 KB, checked by signature + IHDR
  created_at      timestamptz
)

decks (
  id              uuid pk,
  slug            text unique,              -- 'spooky-halloween-x7f2'
  title           text not null,
  description     text,
  theme_query     text not null,            -- what the user asked for
  tags            text[] not null,
  language        text not null default 'en',   -- a DeckLanguage code (protocol language.ts)
  source_deck_id  uuid null fk decks on delete cascade,   -- a translation's original (migration 0009); never a translation
  family_friendly bool not null default true,
  visibility      text not null default 'public',   -- 'public' | 'unlisted' | 'hidden' (moderation)
  created_by      uuid fk users null,
  source          text not null,            -- 'ai' | 'curated' | 'remix' | 'translation'
  model           text null,                -- OpenRouter model slug that generated it
  cover_id        text null fk deck_covers on delete set null,   -- null → default cover from the title
  cover_hidden    bool not null default false,   -- hidden by reports (migration 0004): shown as no cover; a new cover clears it
  featured_rank   smallint null,            -- curated decks in the featured row, lowest first (migration 0006)
  play_count      int default 0,
  upvotes         int default 0,
  downvotes       int default 0,
  report_count    int default 0,
  search_vector   tsvector,                 -- title + tags + card texts (planned)
  created_at      timestamptz
)
-- index: GIN(tags), GIN(title gin_trgm_ops) (built, migration 0007); GIN(search_vector) planned
-- unique(source_deck_id, language) where source_deck_id is not null: one translation per original and language
-- a deck's "family" is its original plus the original's translations; lists show each family in the room's language when it has it
-- curated decks are seeded from JSON by db:migrate (source 'curated', upsert by slug)

cards (
  id            uuid pk,
  deck_id       uuid fk decks on delete cascade,
  text          text not null,              -- 'Vampire on a unicycle'
  difficulty    text not null,              -- 'easy' | 'medium' | 'hard'
  is_silly      bool not null default false,
  alternates    text[] not null default '{}',
  keywords      text[] not null default '{}',
  times_offered int default 0,              -- shown as one of the drawer's options (only when there's a choice; migration 0008)
  times_picked  int default 0,              -- chosen by the drawer (not picked at random when time ran out)
  times_drawn   int default 0,              -- drawn in a turn (picked or not)
  times_guessed int default 0,              -- turns where ≥1 guesser got it
  flags         int default 0,              -- "unfair card" reports
  unique(deck_id, lower(text))
)

deck_votes (user_id, deck_id, value smallint, pk(user_id, deck_id))   -- planned: 👍/👎 per deck
card_votes (                                -- built (migration 0008): the drawer's 👍/👎 on the options
  card_id    uuid fk cards on delete cascade,
  player_id  text not null,                 -- 'g_<guestId>' / 'u_<userId>'
  vote       smallint not null,             -- 1 = 👍, -1 = 👎; taking it back deletes the row
  voted_at   timestamptz,
  pk(card_id, player_id)
)
deck_reports (                              -- built (migration 0004); card reports ("unfair card") come later
  id           uuid pk,
  deck_id      uuid fk decks on delete cascade,
  reporter_id  text not null,               -- player id: 'g_<guestId>' / 'u_<userId>'
  reason       text not null,               -- 'cover' | 'content'
  cover_id     text null fk deck_covers,    -- the cover a 'cover' report is about (kept for review)
  created_at   timestamptz,
  resolved_at  timestamptz null,            -- set by the moderator queue (later)
  unique(deck_id, reporter_id, reason, coalesce(cover_id, ''))   -- one report per player, reason and cover
)

-- Generation & credits ------------------------------------------------------
generation_jobs (                           -- built (migration 0002); not yet: queued/review states, credits
  id           uuid pk,
  created_by   text,                        -- player id: 'g_<guestId>' now, 'u_<userId>' with accounts
  client_ip_hash text null,                 -- HMAC of the requester's IP, for the per-IP daily limit (migration 0005)
  kind         text not null default 'generate',   -- 'generate' | 'translate' (migration 0009)
  theme        text, notes text, difficulties text[], include_silly bool, language text,
                                            -- a translation: theme = the original's title, language = the target
  source_deck_id uuid null fk decks on delete set null,   -- a translation's original
                                            -- unique(source_deck_id, language) where running and kind = 'translate'
  status       text,                        -- built: 'running' | 'published' | 'failed'; later 'queued' | 'review'
                                            -- unique(created_by) where status = 'running': one job at a time
  deck_id      uuid null,
  error        text null,
  cover_id     text null fk deck_covers,    -- the drawn cover; may arrive before deck_id, copied onto the deck
  model        text, provider text,         -- OpenRouter slug + the provider it routed to
  input_tokens int, output_tokens int, cost_usd numeric(10,4),   -- cost as reported by OpenRouter
  created_at, finished_at
)

theme_checks (                              -- built (migration 0010): the theme check before each generation
  id             uuid pk,
  created_by     text,                      -- player id
  client_ip_hash text null,
  theme          text, language text,
  verdict        text,                      -- 'accepted' | 'wrong_language' | 'unclear' | 'refused' | 'unreadable'
  model          text, cost_usd numeric(10,6),   -- counted in the daily budget with generation_jobs
  created_at     timestamptz
)
-- refused verdicts are capped per player and per IP in 24 h (they never become jobs)

credit_ledger (                             -- append-only; balance = SUM(delta)
  id          bigserial pk,
  user_id     uuid fk,
  delta       int not null,                 -- +3 signup grant, +15 purchase, -1 generation, +1 refund
  reason      text not null,                -- 'signup_grant' | 'purchase' | 'generation' | 'refund' | 'admin'
  ref_id      text null,                    -- stripe event id / job id
  created_at  timestamptz,
  unique(reason, ref_id)                    -- idempotency
)

purchases (id, user_id, stripe_session_id unique, pack, amount_cents, currency, status, created_at)

-- History (optional for v1) -------------------------------------------------
matches (id, room_code, deck_id, settings jsonb, started_at, ended_at)
match_players (match_id, user_id null, guest_id null, display_name, score, rank)

-- Metrics --------------------------------------------------------------------
product_events (                            -- built (migration 0008), owned by the metrics module
  id         uuid pk,
  name       text not null,                 -- see "Metrics" below
  at         timestamptz,
  player_id  text null,                     -- random guest/user id, never a name or IP
  room_code  text null,
  deck_id    uuid null,
  props      jsonb not null default '{}'
)
-- index: (name, at)
```

Notes:
- **Credit reservation**: on job start, insert `-1 'generation' ref=jobId`. On failure, insert `+1 'refund' ref=jobId`. The balance check and insert happen in one transaction (`SELECT … FOR UPDATE` on the user row) so concurrent requests can't double-spend.
- Free generations are simply a `+3 signup_grant` ledger row, so "free" and "paid" credits work the same way. To show "2 free left" separately, add a `kind` column.

## Metrics

The launch metrics ([next-features.md](../planning/next-features.md#what-to-measure-at-launch)) come from three places, all in our own database. `pnpm --filter @pictiotheme/server metrics:report [--days N]` prints them, with the card quality lists.

| Event (`product_events.name`) | From | `props` |
|---|---|---|
| `room_created` | server | `isPublic` |
| `match_started` | game-core effect | `players` |
| `match_ended` | game-core effect | `reason` (`completed`, `host_ended`, `abandoned`), `turns`, `durationMs`, `players` (ids) |
| `turn_ended` | game-core effect | `reason`, `guessers`, `solved` |
| `first_turn` | browser | `msSinceLanding`, `viaLink` (arrived on an invite link) |
| `phone_gate` | browser | `action`: `shown` or `bypassed` |
| `room_joined` | browser | `device`: `desktop`, `tablet` or `phone` |

- **Card stats** are counters on `cards`, updated from game-core's `cardsDealt` and `turnEnded` effects: every option counts as offered (when there's a choice), the drawer's choice as picked, the drawn card as drawn, and a turn with ≥ 1 correct guess as guessed. A fair pick rate is about 1 in 3; a card nobody picks, or that's rarely guessed, is a candidate to fix or remove.
- **Card votes**: while choosing, the drawer can rate each face-up option 👍/👎 (`turn:vote`), stored in `card_votes`. Writes per player and card run in order, so a changed mind is stored correctly.
- **Generations** (per day, cost, covers drawn) come from `generation_jobs`.
- All of it is best-effort: a failed write is logged and the game goes on. Curated decks keep their card ids, stats and votes when re-seeded (cards are matched by text).

## Ephemeral room state (realtime server)

The implemented type is `RoomState` in [`packages/game-core/src/room/types.ts`](../../packages/game-core/src/room/types.ts), which is the source of truth. The sketch below shows the shape.

```ts
type Room = {
  code: string;                 // 'ABC-DEF'
  name: string;
  isPublic: boolean;
  hostId: PlayerId;
  createdAt: number;
  settings: {
    deckId: string;
    difficulties: ('easy' | 'medium' | 'hard')[];
    silly: { enabled: boolean; ratio: number };   // 0..1
    rounds: number;
    drawSeconds: number;
    maxPlayers: number;
    guessVisibility: 'show' | 'hide';
    hints: boolean;
    wordChoice: 3 | 1;
  };
  players: Map<PlayerId, {
    id: PlayerId; userId?: string; name: string; avatar: string;
    score: number; connected: boolean; joinedAt: number;
    guessedThisTurn: boolean; lastGuessAt: number;
  }>;
  phase:
    | { kind: 'waiting' }
    | { kind: 'choosing'; drawerId: PlayerId; options: Card[]; endsAt: number }
    | { kind: 'drawing';  drawerId: PlayerId; card: Card; endsAt: number;
        revealedHintIdx: number[]; correctOrder: PlayerId[] }
    | { kind: 'reveal';   card: Card; deltas: Record<PlayerId, number>; endsAt: number }
    | { kind: 'results';  ranking: PlayerId[] };
  round: number;
  turnOrder: PlayerId[];
  pool: Card[];                 // shuffled remaining cards
  strokes: Stroke[];            // current drawing (for late joiners / reconnects)
  redoStack: Stroke[];
};
```

`Card` objects with the answer **only exist on the server**. Clients get `wordMask` (e.g. `[7, 9]` + revealed letters) unless they are the drawer or have already guessed correctly.

### In-memory registries (single process)

There is no Redis in v1 ([decisions.md](decisions.md#d2--fastify-typescript-modular-monolith-one-process)). Each structure below lives in the server process behind an interface, so it can move to Redis when the app runs more than one instance.

| Structure | Interface | Holds | Redis equivalent later |
|---|---|---|---|
| Room map (`rooms` module) | `RoomRegistry` (when scaling out) | `Map<code, RoomRuntime>`: code uniqueness, lobby summaries (name, isPublic, deckTitle, players, max, status) | `room:{code}` hash + `rooms:public` sorted set |
| Rate limiter | `RateLimiter` | Token buckets per player (guesses, messages) and per IP (joins, room creation) | `rl:*` counters with TTL |
| Event bus | `EventBus` | Generation job progress → SSE subscribers | pub/sub `job:{id}:events` |

Background jobs are **pg-boss** tables in Postgres (its own `pgboss` schema, managed by the library).
