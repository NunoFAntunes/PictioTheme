import { DeckListResponse } from '@pictiotheme/protocol';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

/** The curated decks, featured first. */
export function useDecks() {
  return useQuery({
    queryKey: ['decks', 'curated'],
    queryFn: async () => (await apiGet('/api/decks', DeckListResponse)).decks,
    staleTime: 5 * 60_000,
  });
}

/** Decks whose title or tags match `q` (curated and generated). Off while `q` is blank. */
export function useDeckSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ['decks', 'search', query],
    queryFn: async () =>
      (await apiGet(`/api/decks?q=${encodeURIComponent(query)}`, DeckListResponse)).decks,
    enabled: query !== '',
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
