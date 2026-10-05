import { UpdateIdentityResponse, type PlayerIdentity } from '@pictiotheme/protocol';
import { useMutation } from '@tanstack/react-query';
import { apiPut } from '../../lib/api';

/** Tells the room about a new name or avatar; everyone's player list updates (user-flows.md §5). */
export function useUpdateIdentityInRoom(code: string) {
  return useMutation({
    mutationFn: (identity: PlayerIdentity) =>
      apiPut(`/api/rooms/${encodeURIComponent(code)}/me`, identity, UpdateIdentityResponse),
  });
}
