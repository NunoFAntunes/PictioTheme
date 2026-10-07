import { and, asc, count, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client';
import { generationJobs, themeChecks } from '../../db/schema';

export type JobRow = typeof generationJobs.$inferSelect;
export type NewJob = Pick<
  typeof generationJobs.$inferInsert,
  | 'kind'
  | 'createdBy'
  | 'clientIpHash'
  | 'theme'
  | 'notes'
  | 'difficulties'
  | 'includeSilly'
  | 'language'
  | 'sourceDeckId'
>;
export type JobKind = 'generate' | 'translate';
export type JobResult =
  | {
      status: 'published';
      deckId: string;
      model: string | null;
      provider: string | null;
      inputTokens: number;
      outputTokens: number;
      costUsd: number | null;
    }
  | { status: 'failed'; error: string };

function isUniqueViolation(err: unknown, constraint: string): boolean {
  const cause = err instanceof Error && 'cause' in err ? err.cause : err;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    cause.constraint === constraint
  );
}

/** Postgres unique_violation: the player already has a running job (generation_jobs_one_running_idx). */
export function isOneRunningViolation(err: unknown): boolean {
  return isUniqueViolation(err, 'generation_jobs_one_running_idx');
}

/** Someone else started this translation a moment ago (generation_jobs_one_translation_idx). */
export function isOneTranslationViolation(err: unknown): boolean {
  return isUniqueViolation(err, 'generation_jobs_one_translation_idx');
}

/** The running translation of this original into this language, if there is one. */
export async function findRunningTranslation(
  db: DbExecutor,
  sourceDeckId: string,
  language: string,
): Promise<JobRow | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.kind, 'translate'),
        eq(generationJobs.status, 'running'),
        eq(generationJobs.sourceDeckId, sourceDeckId),
        eq(generationJobs.language, language),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertJob(db: DbExecutor, job: NewJob): Promise<JobRow> {
  const [row] = await db.insert(generationJobs).values(job).returning();
  if (!row) throw new Error('insertJob returned no row');
  return row;
}

export async function findJob(db: DbExecutor, id: string): Promise<JobRow | null> {
  const [row] = await db.select().from(generationJobs).where(eq(generationJobs.id, id)).limit(1);
  return row ?? null;
}

/** Only a running job is finished, so a job is never finished twice. */
export async function finishJob(db: DbExecutor, id: string, result: JobResult): Promise<void> {
  const values =
    result.status === 'published'
      ? { ...result, costUsd: result.costUsd === null ? null : String(result.costUsd) }
      : result;
  await db
    .update(generationJobs)
    .set({ ...values, finishedAt: new Date() })
    .where(and(eq(generationJobs.id, id), eq(generationJobs.status, 'running')));
}

/** Records the creator's drawn cover on the job, whatever its status. */
export async function setJobCover(db: DbExecutor, id: string, coverId: string): Promise<void> {
  await db.update(generationJobs).set({ coverId }).where(eq(generationJobs.id, id));
}

/** The published job that made this deck, if `createdBy` made it. That's how deck ownership works for now. */
export async function findOwnJobForDeck(
  db: DbExecutor,
  deckId: string,
  createdBy: string,
): Promise<JobRow | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.deckId, deckId),
        eq(generationJobs.createdBy, createdBy),
        eq(generationJobs.kind, 'generate'),
        eq(generationJobs.status, 'published'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Fails every running job. Jobs run in-process, so at boot any running job was interrupted. */
export async function failRunningJobs(db: DbExecutor, error: string): Promise<number> {
  const rows = await db
    .update(generationJobs)
    .set({ status: 'failed', error, finishedAt: new Date() })
    .where(eq(generationJobs.status, 'running'))
    .returning({ id: generationJobs.id });
  return rows.length;
}

/** Decks the player generated (not translations they asked for), newest first. */
export async function publishedDeckIds(
  db: DbExecutor,
  createdBy: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ deckId: generationJobs.deckId })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.createdBy, createdBy),
        eq(generationJobs.kind, 'generate'),
        eq(generationJobs.status, 'published'),
        isNotNull(generationJobs.deckId),
      ),
    )
    .orderBy(desc(generationJobs.createdAt))
    .limit(limit);
  return rows.flatMap((r) => (r.deckId ? [r.deckId] : []));
}

/**
 * Jobs of `kind` that count towards the daily limits since `since`, oldest first: running and
 * published ones. Failed jobs don't count, so a broken model never eats a player's daily deck.
 */
export async function countedJobsSince(
  db: DbExecutor,
  kind: JobKind,
  who: { createdBy: string } | { clientIpHash: string },
  since: Date,
): Promise<Date[]> {
  const rows = await db
    .select({ createdAt: generationJobs.createdAt })
    .from(generationJobs)
    .where(
      and(
        'createdBy' in who
          ? eq(generationJobs.createdBy, who.createdBy)
          : eq(generationJobs.clientIpHash, who.clientIpHash),
        eq(generationJobs.kind, kind),
        ne(generationJobs.status, 'failed'),
        gte(generationJobs.createdAt, since),
      ),
    )
    .orderBy(asc(generationJobs.createdAt));
  return rows.map((r) => r.createdAt);
}

/**
 * What generations, translations and theme checks cost since `since` (failed and refused ones
 * included: they cost too), and how many jobs run.
 */
export async function spendSince(
  db: DbExecutor,
  since: Date,
): Promise<{ costUsd: number; running: number }> {
  const [jobs] = await db
    .select({
      costUsd: sql<number>`coalesce(sum(${generationJobs.costUsd}), 0)`.mapWith(Number),
      running: count(sql`case when ${generationJobs.status} = 'running' then 1 end`),
    })
    .from(generationJobs)
    .where(gte(generationJobs.createdAt, since));
  const [checks] = await db
    .select({ costUsd: sql<number>`coalesce(sum(${themeChecks.costUsd}), 0)`.mapWith(Number) })
    .from(themeChecks)
    .where(gte(themeChecks.createdAt, since));
  return { costUsd: (jobs?.costUsd ?? 0) + (checks?.costUsd ?? 0), running: jobs?.running ?? 0 };
}

// ── Theme checks ──

export type NewThemeCheck = Pick<
  typeof themeChecks.$inferInsert,
  'createdBy' | 'clientIpHash' | 'theme' | 'language' | 'verdict' | 'model'
> & { costUsd: number | null };

export async function insertThemeCheck(db: DbExecutor, check: NewThemeCheck): Promise<void> {
  await db
    .insert(themeChecks)
    .values({ ...check, costUsd: check.costUsd === null ? null : String(check.costUsd) });
}

/** Verdicts that refused the theme, so no job followed. */
const REFUSED_VERDICTS = ['wrong_language', 'unclear', 'refused'];

/** How many theme checks refused this player's (or this IP's) themes since `since`. */
export async function refusedChecksSince(
  db: DbExecutor,
  who: { createdBy: string } | { clientIpHash: string },
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(themeChecks)
    .where(
      and(
        'createdBy' in who
          ? eq(themeChecks.createdBy, who.createdBy)
          : eq(themeChecks.clientIpHash, who.clientIpHash),
        inArray(themeChecks.verdict, REFUSED_VERDICTS),
        gte(themeChecks.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}
