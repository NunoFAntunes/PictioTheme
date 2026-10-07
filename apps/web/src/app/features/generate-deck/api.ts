import {
  DeckListResponse,
  DeckSummary,
  GenerationConfigResponse,
  GenerationJob,
  GuestSessionResponse,
  TranslateDeckResponse,
  type DeckCoverImage,
  type DeckGenerationRequest,
  type DeckLanguage,
} from '@pictiotheme/protocol';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../../lib/api';

/** How often a running generation is polled. Decks take about a minute. */
const POLL_MS = 2_000;

/** Whether generation is on, and how many decks this player has left today. */
export function useGenerationConfig() {
  return useQuery({
    queryKey: ['decks', 'generation-config'],
    queryFn: () => apiGet('/api/decks/generations/config', GenerationConfigResponse),
    staleTime: 60_000,
  });
}

/** Decks this player generated, newest first, each in `language` when translated into it. */
export function useMyDecks(language: DeckLanguage) {
  return useQuery({
    queryKey: ['decks', 'mine', language],
    queryFn: async () =>
      (await apiGet(`/api/decks/mine?language=${language}`, DeckListResponse)).decks,
    staleTime: 60_000,
  });
}

/**
 * A deck in another language: ready right away when someone translated it already, otherwise a
 * translation job to poll with `useGenerationJob`.
 */
export function useTranslateDeck() {
  return useMutation({
    mutationFn: async ({ deckId, language }: { deckId: string; language: DeckLanguage }) => {
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      return apiPost(`/api/decks/${deckId}/translations`, { language }, TranslateDeckResponse);
    },
  });
}

export function useStartGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeckGenerationRequest) => {
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      return apiPost('/api/decks/generations', input, GenerationJob);
    },
    // The daily count changed (or a limit was hit): refresh what's left.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['decks', 'generation-config'] }),
  });
}

/** A generation, polled until it is published or failed. */
export function useGenerationJob(jobId: string | null) {
  return useQuery({
    queryKey: ['decks', 'generations', jobId],
    queryFn: () => apiGet(`/api/decks/generations/${jobId}`, GenerationJob),
    enabled: jobId !== null,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? POLL_MS : false),
  });
}

/** Saves the back cover drawn while the deck generates (or after). Returns the updated job. */
export function useSetCover() {
  return useMutation({
    mutationFn: ({ jobId, image }: { jobId: string; image: DeckCoverImage }) =>
      apiPut(`/api/decks/generations/${jobId}/cover`, { image }, GenerationJob),
  });
}

/** Redraws the back cover of one of your decks, any time after it's published. */
export function useRedrawCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deckId, image }: { deckId: string; image: DeckCoverImage }) =>
      apiPut(`/api/decks/${deckId}/cover`, { image }, DeckSummary),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['decks', 'mine'] }),
  });
}
