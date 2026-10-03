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
  avatar          text not null,            -- preset id, e.g. 'vampire-03'
  email_verified  bool default false,
  role            text default 'user',      -- 'user' | 'moderator' | 'admin'
  created_at      timestamptz,
  banned_at       timestamptz null
)
auth_accounts (user_id fk, provider text, provider_account_id text, pk(provider, provider_account_id))

-- Decks ---------------------------------------------------------------------
decks (
  id              uuid pk,
  slug            text unique,              -- 'spooky-halloween-x7f2'
  title           text not null,
  description     text,
  theme_query     text not null,            -- what the user asked for
  tags            text[] not null,
  language        text not null default 'en',
  family_friendly bool not null default true,
  visibility      text not null default 'public',   -- 'public' | 'unlisted' | 'hidden' (moderation)
  created_by      uuid fk users null,
  source          text not null,            -- 'ai' | 'curated' | 'remix'
  model           text null,                -- OpenRouter model slug that generated it
  play_count      int default 0,
  upvotes         int default 0,
  downvotes       int default 0,
  report_count    int default 0,
  search_vector   tsvector,                 -- title + tags + card texts
  created_at      timestamptz
)
-- index: GIN(search_vector), GIN(tags), GIN(title gin_trgm_ops)

cards (
  id            uuid pk,
  deck_id       uuid fk decks on delete cascade,
  text          text not null,              -- 'Vampire on a unicycle'
  difficulty    text not null,              -- 'easy' | 'medium' | 'hard'
  is_silly      bool not null default false,
  alternates    text[] not null default '{}',
  keywords      text[] not null default '{}',
  times_drawn   int default 0,
  times_guessed int default 0,              -- turns where ≥1 guesser got it
  flags         int default 0,              -- "unfair card" reports
  unique(deck_id, lower(text))
)

deck_votes (user_id, deck_id, value smallint, pk(user_id, deck_id))
deck_reports (id, deck_id, card_id null, reporter_id null, reason, created_at, resolved_at)

-- Generation & credits ------------------------------------------------------
generation_jobs (
  id           uuid pk,
  user_id      uuid fk,
  theme        text, notes text, language text, family_friendly bool, include_silly bool,
  status       text,                        -- 'queued' | 'running' | 'review' | 'published' | 'failed'
  deck_id      uuid null,
  error        text null,
  model        text, provider text,         -- OpenRouter slug + the provider it routed to
  input_tokens int, output_tokens int, cost_usd numeric(10,4),   -- cost as reported by OpenRouter
  created_at, finished_at
)

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
```

Notes:
- **Credit reservation**: on job start, insert `-1 'generation' ref=jobId`. On failure, insert `+1 'refund' ref=jobId`. The balance check and insert happen in one transaction (`SELECT … FOR UPDATE` on the user row) so concurrent requests can't double-spend.
- Free generations are simply a `+3 signup_grant` ledger row, so "free" and "paid" credits work the same way. To show "2 free left" separately, add a `kind` column.

## Ephemeral room state (realtime server)

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
| `RoomManager` | `RoomRegistry` | `Map<code, RoomRuntime>`: code uniqueness, lobby summaries (name, isPublic, deckTitle, players, max, status) | `room:{code}` hash + `rooms:public` sorted set |
| Rate limiter | `RateLimiter` | Token buckets per player (guesses, messages) and per IP (joins, room creation) | `rl:*` counters with TTL |
| Event bus | `EventBus` | Generation job progress → SSE subscribers | pub/sub `job:{id}:events` |

Background jobs are **pg-boss** tables in Postgres (its own `pgboss` schema, managed by the library).
