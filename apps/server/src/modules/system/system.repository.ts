import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client';

export async function pingDatabase(db: DbExecutor): Promise<void> {
  await db.execute(sql`select 1`);
}
