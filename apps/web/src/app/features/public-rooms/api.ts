import { PublicRoomsResponse } from '@pictiotheme/protocol';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export function usePublicRooms() {
  return useQuery({
    queryKey: ['rooms', 'public'],
    queryFn: async () => (await apiGet('/api/rooms/public', PublicRoomsResponse)).rooms,
    refetchInterval: 5_000,
  });
}
