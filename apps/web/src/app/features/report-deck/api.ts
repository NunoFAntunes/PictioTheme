import { ReportDeckResponse, type DeckReportReason } from '@pictiotheme/protocol';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api';

export function useReportDeck() {
  return useMutation({
    mutationFn: ({ deckId, reason }: { deckId: string; reason: DeckReportReason }) =>
      apiPost(`/api/decks/${deckId}/reports`, { reason }, ReportDeckResponse),
  });
}
