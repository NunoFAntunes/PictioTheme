import type { DbExecutor } from '../../db/client';
import { productEvents } from '../../db/schema';

export type NewEvent = {
  name: string;
  playerId?: string | null;
  roomCode?: string | null;
  deckId?: string | null;
  props?: Record<string, unknown>;
};

export async function insertEvent(db: DbExecutor, event: NewEvent): Promise<void> {
  await db.insert(productEvents).values({
    name: event.name,
    playerId: event.playerId ?? null,
    roomCode: event.roomCode ?? null,
    deckId: event.deckId ?? null,
    props: event.props ?? {},
  });
}
