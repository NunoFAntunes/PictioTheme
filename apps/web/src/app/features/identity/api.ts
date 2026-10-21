import { UpdateIdentityResponse, type PlayerIdentity } from '@pictiotheme/protocol';
import { apiPut } from '../../lib/api';

/** Tells the room about a new name or avatar; everyone's player list updates (user-flows.md §5). */
export async function updateIdentityInRoom(code: string, identity: PlayerIdentity): Promise<void> {
  await apiPut(`/api/rooms/${encodeURIComponent(code)}/me`, identity, UpdateIdentityResponse);
}
