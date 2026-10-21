# Data Model

Same database as DoodleWhirl ([data-model.md](../../technical/data-model.md)). The `tower` module owns the new tables, in `apps/server/src/db/schema/tower.ts`, all prefixed `tower_`. It reads other modules' data only through their services.

## Reused, unchanged

| Table | Owner | Used for |
|---|---|---|
| `decks`, `cards` | decks | Words (easy cards of allowed decks) |
| `avatars` | avatars | Player avatars |
| `product_events` | metrics | Tower events (names prefixed `tower_`) |

There's no `users` table yet: DoodleWhirl only has guests (`g_<uuid>` player ids). Tower uses the same player-id format. When DoodleWhirl adds accounts (Better Auth, its Phase 3), Tower uses the same `users` table.

## New tables

```sql
tower_decks (                      -- the allowlist (word-pool.md)
  deck_id        uuid pk fk decks on delete cascade,
  enabled        bool not null default true,
  show_category  bool not null default false,   -- later: "🎬 a movie"
  category_label text null,
  sort           smallint not null default 0
)

tower_matches (
  id            uuid pk,
  room_code     text not null,
  deck_id       uuid null fk decks,             -- null = Tower Mix
  settings      jsonb not null,                 -- height, round time, daze, steals
  winner        text null,                      -- 'orange' | 'teal'
  end_reason    text null,                      -- 'topped_out' | 'time' | 'abandoned'
  started_at    timestamptz, ended_at timestamptz
)

tower_match_players (
  match_id      uuid fk tower_matches on delete cascade,
  player_id     text not null,                  -- 'g_<players.id>'
  team          text not null,
  display_name  text not null,
  drawings      int, solves int, steals int, sends int (pieces cursed), placements int, fumbles int,
  pk(match_id, player_id)
)

-- Built (migration 0012): tower_decks, tower_matches (with height_orange / height_teal),
-- tower_match_players. Not yet: tower_pieces, tower_card_stats.

tower_pieces (                     -- later: the share image and galleries
  id            uuid pk,
  match_id      uuid fk tower_matches on delete cascade,
  card_id       uuid null fk cards on delete set null,
  drawn_by      text, solved_by text,
  stolen        bool, sent bool,
  tower         text not null,                  -- where it ended up
  outline       jsonb not null,                 -- world-unit polygon
  fumbled       bool not null default false,
  created_at    timestamptz
)

tower_card_stats (                 -- separate from cards.times_*: a good DoodleWhirl card can be a bad block
  card_id       uuid pk fk cards on delete cascade,
  times_drawn int, times_solved int, times_stolen int, times_sent int, times_fumbled int
)
```

As in DoodleWhirl, writing results is **best-effort**: a failed write is logged and never blocks the game. Live state (rounds, strokes, worlds, queues) stays in memory.

The drawings themselves aren't stored in v1. Add a `drawing_png bytea` to `tower_pieces` if galleries or replays need it.
