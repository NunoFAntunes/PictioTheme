import { eq } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client';
import { avatars, players } from '../../db/schema';

export type PlayerRow = {
  displayName: string | null;
  nameChosen: boolean;
  drawingId: string | null;
  /** The drawing's PNG (a read-only join into `avatars`, rule B5). */
  drawingPng: Buffer | null;
};

export async function findPlayer(db: DbExecutor, id: string): Promise<PlayerRow | null> {
  const [row] = await db
    .select({
      displayName: players.displayName,
      nameChosen: players.nameChosen,
      drawingId: players.drawingId,
      drawingPng: avatars.png,
    })
    .from(players)
    .leftJoin(avatars, eq(avatars.id, players.drawingId))
    .where(eq(players.id, id))
    .limit(1);
  return row ?? null;
}

/** Locks the row for the update that follows in the same transaction. */
export async function findPlayerForUpdate(
  db: DbExecutor,
  id: string,
): Promise<Omit<PlayerRow, 'drawingPng'> | null> {
  const [row] = await db
    .select({
      displayName: players.displayName,
      nameChosen: players.nameChosen,
      drawingId: players.drawingId,
    })
    .from(players)
    .where(eq(players.id, id))
    .for('update')
    .limit(1);
  return row ?? null;
}

export async function savePlayer(
  db: DbExecutor,
  id: string,
  values: { displayName: string | null; nameChosen: boolean; drawingId: string | null },
): Promise<void> {
  const now = new Date();
  await db
    .insert(players)
    .values({ id, ...values, updatedAt: now })
    .onConflictDoUpdate({ target: players.id, set: { ...values, updatedAt: now } });
}
