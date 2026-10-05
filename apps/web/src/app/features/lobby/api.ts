import {
  GuestSessionResponse,
  type CreateRoomRequest,
  JoinRoomResponse,
  PublicRoomsResponse,
  type QuickPlayRequest,
} from '@pictiotheme/protocol';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';

/** The live lobby list, plus how many players are online. */
export function usePublicRooms() {
  return useQuery({
    queryKey: ['rooms', 'public'],
    queryFn: () => apiGet('/api/rooms/public', PublicRoomsResponse),
    refetchInterval: 5_000,
  });
}

/** The server picks the best public room with space, or makes one (user-flows.md §2). */
export function useQuickPlay() {
  return useMutation({
    mutationFn: async (identity: QuickPlayRequest) => {
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      return apiPost('/api/rooms/quick-play', identity, JoinRoomResponse);
    },
  });
}

/** A new room; Quick play and "New private room" on the home page (user-flows.md §2). */
export function useCreateRoom() {
  return useMutation({
    mutationFn: async (input: CreateRoomRequest) => {
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      return apiPost('/api/rooms', input, JoinRoomResponse);
    },
  });
}
