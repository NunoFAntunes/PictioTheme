import { DeckListResponse, type DeckLanguage } from '@pictiotheme/protocol';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

/** The curated decks, featured first, each in `language` when it's been translated into it. */
export function useDecks(language: DeckLanguage) {
  return useQuery({
    queryKey: ['decks', 'curated', language],
    queryFn: async () => (await apiGet(`/api/decks?language=${language}`, DeckListResponse)).decks,
    staleTime: 5 * 60_000,
  });
}

/**
 * Decks whose title or tags match `q` (curated and generated), in `language` when translated
 * into it. Off while `q` is blank.
 */
export function useDeckSearch(q: string, language: DeckLanguage) {
  const query = q.trim();
  return useQuery({
    queryKey: ['decks', 'search', language, query],
    queryFn: async () =>
      (
        await apiGet(
          `/api/decks?q=${encodeURIComponent(query)}&language=${language}`,
          DeckListResponse,
        )
      ).decks,
    enabled: query !== '',
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
