import type { RoomDeck } from '@pictiotheme/protocol';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { DOODLE_BUTTON, WOBBLE } from '../../../ui/hand-drawn';
import { DeckCover } from '../../deck-cover';
import { useAddChaos, useGenerationJob } from '../api';

/**
 * The room is in Chaos mode but its deck has no Chaos cards yet (decks.md#chaos-cards). One
 * button has AI make them (~30 s). They're saved on the deck, so every later room gets them, and
 * the room reloads the deck by itself once they are: this panel then goes away.
 */
export function ChaosCardsPanel({ deck }: { deck: Pick<RoomDeck, 'id' | 'title' | 'coverId'> }) {
  const addChaos = useAddChaos();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useGenerationJob(jobId);
  const refreshed = useRef(false);

  function start() {
    refreshed.current = false;
    addChaos.mutate(deck.id, {
      onSuccess: (res) => {
        if (res.status === 'generating') setJobId(res.job.id);
      },
    });
  }

  // The deck library shows 🌀 on decks with Chaos cards: refresh it once they exist.
  const published = job.data?.status === 'published' || addChaos.data?.status === 'ready';
  useEffect(() => {
    if (!published || refreshed.current) return;
    refreshed.current = true;
    void queryClient.invalidateQueries({ queryKey: ['decks'] });
  });

  const running =
    addChaos.isPending || (jobId !== null && job.data?.status !== 'failed') || published;
  const failure = addChaos.isError
    ? addChaos.error.message
    : job.data?.status === 'failed'
      ? job.data.error
      : job.isError
        ? job.error.message
        : null;

  return (
    <div
      role="group"
      aria-label={`Make Chaos cards for “${deck.title}”`}
      data-testid="chaos-cards"
      className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-pop-pink/70 bg-pop-pink/5 p-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="w-12 shrink-0 rotate-2">
          <DeckCover deck={deck} size="fill" />
        </div>
        <div className="flex min-w-0 shrink-0 grow basis-32 flex-col gap-0.5">
          <h3 className="truncate font-hand text-xl leading-tight">{deck.title}</h3>
          <p className="text-sm text-ink/70">No 🌀 Chaos cards yet</p>
        </div>
        {running ? (
          <span role="status" className="ml-auto flex items-center gap-2 font-hand text-lg">
            <span
              aria-hidden
              className="size-5 animate-spin rounded-full border-2 border-pop-pink border-t-transparent"
            />
            Making Chaos cards…
          </span>
        ) : (
          <button
            type="button"
            onClick={start}
            className={`${DOODLE_BUTTON} ${WOBBLE[0]} ml-auto rotate-1 bg-pop-pink px-4 py-1.5 text-base text-ink`}
          >
            {failure ? 'Try again' : '🌀 Make Chaos cards'}
          </button>
        )}
      </div>
      {failure && (
        <p className="text-sm text-close" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
