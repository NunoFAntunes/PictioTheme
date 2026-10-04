import { and, asc, count, desc, eq, gte, isNotNull, ne, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client';
import { generationJobs } from '../../db/schema';

export type JobRow = typeof generationJobs.$inferSelect;
export type NewJob = Pick<
  typeof generationJobs.$inferInsert,
  'createdBy' | 'clientIpHash' | 'theme' | 'notes' | 'difficulties' | 'includeSilly'
>;
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

/** Postgres unique_violation: the player already has a running job (generation_jobs_one_running_idx). */
export function isOneRunningViolation(err: unknown): boolean {
  const cause = err instanceof Error && 'cause' in err ? err.cause : err;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    cause.constraint === 'generation_jobs_one_running_idx'
  );
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

/** Decks the player generated, newest first. */
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
        eq(generationJobs.status, 'published'),
        isNotNull(generationJobs.deckId),
      ),
    )
    .orderBy(desc(generationJobs.createdAt))
    .limit(limit);
  return rows.flatMap((r) => (r.deckId ? [r.deckId] : []));
}

/**
 * Jobs that count towards the daily limits since `since`, oldest first: running and published
 * ones. Failed generations don't count, so a broken model never eats a player's daily deck.
 */
export async function countedJobsSince(
  db: DbExecutor,
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
        ne(generationJobs.status, 'failed'),
        gte(generationJobs.createdAt, since),
      ),
    )
    .orderBy(asc(generationJobs.createdAt));
  return rows.map((r) => r.createdAt);
}

/** What generations cost since `since` (failed ones included: they cost too), and how many run. */
export async function spendSince(
  db: DbExecutor,
  since: Date,
): Promise<{ costUsd: number; running: number }> {
  const [row] = await db
    .select({
      costUsd: sql<number>`coalesce(sum(${generationJobs.costUsd}), 0)`.mapWith(Number),
      running: count(sql`case when ${generationJobs.status} = 'running' then 1 end`),
    })
    .from(generationJobs)
    .where(gte(generationJobs.createdAt, since));
  return { costUsd: row?.costUsd ?? 0, running: row?.running ?? 0 };
}
