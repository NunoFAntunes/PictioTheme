import { DeckSummary, type DeckLanguage } from '@pictiotheme/protocol';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet } from '../../lib/api';

/**
 * The room's deck in another language, when it's been translated into it (null otherwise). Asked
 * when the host changes the room's language, so the room switches to the translation right away.
 */
export function useFindDeckInLanguage() {
  const queryClient = useQueryClient();
  return (deckId: string, language: DeckLanguage): Promise<DeckSummary | null> =>
    queryClient.query({
      queryKey: ['decks', 'in-language', deckId, language],
      queryFn: async () => {
        try {
          return await apiGet(`/api/decks/${deckId}/translations/${language}`, DeckSummary);
        } catch (err) {
          // Not translated yet, or a deck id that isn't a saved deck.
          if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null;
          throw err;
        }
      },
      staleTime: 30_000,
    });
}
