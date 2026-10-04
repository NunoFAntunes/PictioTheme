/**
 * The launch metrics (docs/planning/next-features.md, "What to measure at launch") and the card
 * quality report, from `product_events`, `generation_jobs` and the card stats. Run by hand:
 *
 *   pnpm --filter @pictiotheme/server metrics:report              # the last 7 days
 *   pnpm --filter @pictiotheme/server metrics:report --days 1
 *
 * Needs DATABASE_URL (apps/server/.env locally; the production URL through a tunnel later).
 */
import { parseArgs } from 'node:util';
import { sql, type SQL } from 'drizzle-orm';
import { loadConfig } from '../src/config';
import { createDb } from '../src/db/client';
import { createDecksService } from '../src/modules/decks';

const { values } = parseArgs({ options: { days: { type: 'string', default: '7' } } });
const days = Math.max(1, Number(values.days) || 7);

const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);
const since = sql`now() - make_interval(days => ${days})`;

async function one<T>(query: SQL): Promise<T> {
  const result = await db.execute(query);
  return result.rows[0] as T;
}

const pct = (part: number, whole: number) =>
  whole === 0 ? 'n/a' : `${Math.round((100 * part) / whole)}% (${part}/${whole})`;
const secs = (ms: number | null) => (ms === null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);

try {
  const firstTurn = await one<{ link: number | null; lobby: number | null; n: number }>(sql`
    select
      percentile_cont(0.5) within group (order by (props->>'msSinceLanding')::int)
        filter (where (props->>'viaLink')::boolean) as link,
      percentile_cont(0.5) within group (order by (props->>'msSinceLanding')::int)
        filter (where not (props->>'viaLink')::boolean) as lobby,
      count(*)::int as n
    from product_events where name = 'first_turn' and at > ${since}`);

  const matches = await one<{
    started: number;
    completed: number;
    host: number;
    abandoned: number;
  }>(sql`
    select
      count(*) filter (where name = 'match_started')::int as started,
      count(*) filter (where name = 'match_ended' and props->>'reason' = 'completed')::int as completed,
      count(*) filter (where name = 'match_ended' and props->>'reason' = 'host_ended')::int as host,
      count(*) filter (where name = 'match_ended' and props->>'reason' = 'abandoned')::int as abandoned
    from product_events where name in ('match_started', 'match_ended') and at > ${since}`);

  const turns = await one<{ turns: number; guessed: number }>(sql`
    select count(*)::int as turns,
      count(*) filter (where (props->>'solved')::int > 0)::int as guessed
    from product_events where name = 'turn_ended' and at > ${since}`);

  const covers = await one<{ published: number; covered: number }>(sql`
    select count(*)::int as published, count(cover_id)::int as covered
    from generation_jobs where status = 'published' and created_at > ${since}`);

  const onGenerated = await one<{ total: number; generated: number }>(sql`
    select count(*)::int as total,
      count(*) filter (where d.source = 'ai')::int as generated
    from product_events e left join decks d on d.id = e.deck_id
    where e.name = 'match_started' and e.at > ${since}`);

  const perDay = await db.execute(sql`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      count(*) filter (where status <> 'failed')::int as decks,
      count(*) filter (where status = 'failed')::int as failed,
      coalesce(sum(cost_usd), 0)::float as cost
    from generation_jobs where created_at > ${since}
    group by 1 order by 1`);

  const gate = await one<{ shown: number; bypassed: number }>(sql`
    select count(*) filter (where props->>'action' = 'shown')::int as shown,
      count(*) filter (where props->>'action' = 'bypassed')::int as bypassed
    from product_events where name = 'phone_gate' and at > ${since}`);

  const devices = await db.execute(sql`
    select props->>'device' as device, count(distinct player_id)::int as players
    from product_events where name = 'room_joined' and at > ${since}
    group by 1 order by 2 desc`);

  const tablet = await one<{ ended: number; completed: number }>(sql`
    with tablet_players as (
      select distinct player_id from product_events
      where name = 'room_joined' and props->>'device' = 'tablet'
    )
    select count(*)::int as ended,
      count(*) filter (where e.props->>'reason' = 'completed')::int as completed
    from product_events e
    where e.name = 'match_ended' and e.at > ${since}
      and exists (
        select 1 from jsonb_array_elements_text(e.props->'players') p(id)
        where p.id in (select player_id from tablet_players)
      )`);

  const budget = config.generationLimits?.dailyBudgetUsd;
  const lines: [string, string, string][] = [
    ['Time from landing to first turn (link joiners, median)', secs(firstTurn.link), '< 30 s'],
    ['Time from landing to first turn (lobby, median)', secs(firstTurn.lobby), ''],
    [
      'Matches completed / started',
      pct(matches.completed, matches.started),
      `> 60% (host ended ${matches.host}, abandoned ${matches.abandoned})`,
    ],
    ['Turns where ≥ 1 player guessed', pct(turns.guessed, turns.turns), '> 70%'],
    ['Generations with a drawn cover', pct(covers.covered, covers.published), '> 50%'],
    [
      'Matches played on a generated deck',
      pct(onGenerated.generated, onGenerated.total),
      'the bet',
    ],
    ['Phone gate shown / bypassed', `${gate.shown} / ${gate.bypassed}`, 'high → phone guess mode'],
    [
      'Matches with a tablet player, completed',
      pct(tablet.completed, tablet.ended),
      'like the rest',
    ],
  ];
  const width = Math.max(...lines.map(([label]) => label.length));
  process.stdout.write(`\nLaunch metrics, last ${days} day(s)\n\n`);
  for (const [label, value, healthy] of lines) {
    process.stdout.write(`  ${label.padEnd(width)}  ${value.padEnd(22)}  ${healthy}\n`);
  }

  process.stdout.write(`\nPlayers by device: `);
  process.stdout.write(
    devices.rows.map((r) => `${String(r.device)} ${String(r.players)}`).join(', ') || 'none',
  );
  process.stdout.write(
    `\n\nGenerations per day (budget ${budget === undefined ? 'off' : `$${budget}`}):\n`,
  );
  for (const r of perDay.rows) {
    process.stdout.write(
      `  ${String(r.day)}  ${String(r.decks)} decks, ${String(r.failed)} failed, $${Number(r.cost).toFixed(3)}\n`,
    );
  }

  // ── Card quality: the cards to fix or remove ──
  const MIN_OFFERS = 5;
  const quality = (await createDecksService({ db }).cardQuality()).filter(
    (c) => c.offered >= MIN_OFFERS || c.up + c.down > 0,
  );
  const rows = quality.map((c) => ({
    ...c,
    pickRate: c.offered > 0 ? c.picked / c.offered : null,
    guessRate: c.drawn > 0 ? c.guessed / c.drawn : null,
  }));
  const show = (title: string, list: typeof rows) => {
    process.stdout.write(`\n${title}\n`);
    if (list.length === 0) process.stdout.write('  (none yet)\n');
    for (const c of list.slice(0, 15)) {
      process.stdout.write(
        `  ${c.text.padEnd(32)} ${c.deckTitle.slice(0, 24).padEnd(24)} picked ${String(c.picked).padStart(3)}/${String(c.offered).padEnd(4)} guessed ${String(c.guessed).padStart(3)}/${String(c.drawn).padEnd(4)} 👍 ${c.up} 👎 ${c.down}\n`,
      );
    }
  };
  process.stdout.write(
    `\nCard quality (cards offered ≥ ${MIN_OFFERS} times, or voted on). A fair pick rate is ~1 in 3.\n`,
  );
  show(
    'Least picked',
    rows
      .filter((c) => c.pickRate !== null && c.offered >= MIN_OFFERS)
      .sort((a, b) => (a.pickRate ?? 0) - (b.pickRate ?? 0)),
  );
  show(
    'Most 👎',
    rows.filter((c) => c.down > 0).sort((a, b) => b.down - b.up - (a.down - a.up)),
  );
  show(
    'Hardest to guess (drawn ≥ 3 times)',
    rows
      .filter((c) => c.drawn >= 3 && c.guessRate !== null)
      .sort((a, b) => (a.guessRate ?? 0) - (b.guessRate ?? 0)),
  );
  process.stdout.write('\n');
} finally {
  await pool.end();
}
