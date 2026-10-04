import { eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client';
import { avatars } from '../../db/schema';

/** Inserts the avatar, or marks an existing one as used. */
export async function upsertAvatar(db: DbExecutor, id: string, png: Buffer): Promise<void> {
  await db
    .insert(avatars)
    .values({ id, png })
    .onConflictDoUpdate({ target: avatars.id, set: { lastUsedAt: sql`now()` } });
}

export async function findAvatarPng(db: DbExecutor, id: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ png: avatars.png })
    .from(avatars)
    .where(eq(avatars.id, id))
    .limit(1);
  return row?.png ?? null;
}
