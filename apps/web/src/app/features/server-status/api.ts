import { ReadyResponse } from '@pictiotheme/protocol';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export function useServerReady() {
  return useQuery({
    queryKey: ['system', 'ready'],
    queryFn: () => apiGet('/api/ready', ReadyResponse),
    refetchInterval: 30_000,
    retry: false,
  });
}
