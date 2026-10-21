import { UpdateIdentityResponse, type PlayerIdentity } from '@pictiotheme/protocol';
import { apiPut } from '../../lib/api';

/** Tells the room about your new name or drawing; everyone's crew list updates. */
export async function updateIdentityInRoom(code: string, identity: PlayerIdentity): Promise<void> {
  await apiPut(`/api/tower/rooms/${encodeURIComponent(code)}/me`, identity, UpdateIdentityResponse);
}
