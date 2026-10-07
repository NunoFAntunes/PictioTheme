import { deckLanguageInfo } from '@pictiotheme/game-core';
import type { DeckLanguage, DeckSummary, RoomDeck } from '@pictiotheme/protocol';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { DOODLE_BUTTON, WOBBLE } from '../../../ui/hand-drawn';
import { LanguageFlag } from '../../../ui/LanguageFlag';
import { DeckCover } from '../../deck-cover';
import { useGenerationJob, useTranslateDeck } from '../api';

/**
 * A deck the room can't play yet: it isn't in the room's language (decks.md#languages). Kept
 * short: the deck, its flag → the room's flag, and a button that has AI translate it (~1 minute).
 * Translations are saved, so the next room in that language gets it straight away. The
 * translated deck is handed back once it's ready.
 */
export function TranslateDeckPanel({
  deck,
  language,
  onTranslated,
  onCancel,
}: {
  deck: Pick<RoomDeck, 'id' | 'title' | 'coverId' | 'language'>;
  language: DeckLanguage;
  onTranslated: (deck: DeckSummary) => void;
  /** Absent when the panel is about the room's own deck: it stays until the deck is switched. */
  onCancel?: () => void;
}) {
  const translate = useTranslateDeck();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useGenerationJob(jobId);
  const handedBack = useRef(false);
  const target = deckLanguageInfo(language);

  function done(translated: DeckSummary) {
    if (handedBack.current) return;
    handedBack.current = true;
    void queryClient.invalidateQueries({ queryKey: ['decks'] });
    onTranslated(translated);
  }

  function start() {
    handedBack.current = false;
    translate.mutate(
      { deckId: deck.id, language },
      {
        onSuccess: (res) => {
          if (res.status === 'ready') done(res.deck);
          else setJobId(res.job.id);
        },
      },
    );
  }

  const published = job.data?.status === 'published' ? job.data.deck : null;
  useEffect(() => {
    if (published) done(published);
  });

  const running = translate.isPending || (jobId !== null && job.data?.status !== 'failed');
  const failure = translate.isError
    ? translate.error.message
    : job.data?.status === 'failed'
      ? job.data.error
      : job.isError
        ? job.error.message
        : null;

  return (
    <div
      role="group"
      aria-label={`Translate “${deck.title}” into ${target.name}`}
      data-testid="translate-deck"
      className="relative flex flex-col gap-2 rounded-lg border-2 border-dashed border-pop-purple/60 bg-pop-purple/5 p-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="w-12 shrink-0 -rotate-2">
          <DeckCover deck={deck} size="fill" />
        </div>
        <div className="flex min-w-0 shrink-0 grow basis-32 flex-col gap-1.5">
          <h3 className="truncate font-hand text-xl leading-tight">{deck.title}</h3>
          <p className="flex items-center gap-2">
            <LanguageFlag language={deck.language} className="h-5" />
            <span aria-hidden="true" className="font-hand text-xl leading-none text-ink/60">
              ➜
            </span>
            <LanguageFlag language={language} className="h-5" />
          </p>
        </div>
        {running ? (
          <span role="status" className="ml-auto flex items-center gap-2 font-hand text-lg">
            <span
              aria-hidden
              className="size-5 animate-spin rounded-full border-2 border-pop-purple border-t-transparent"
            />
            Translating…
          </span>
        ) : (
          <button
            type="button"
            onClick={start}
            className={`${DOODLE_BUTTON} ${WOBBLE[2]} ml-auto -rotate-2 bg-pop-sun px-4 py-1.5 text-base text-ink`}
          >
            {failure ? 'Try again' : `Translate into ${target.native}`}
          </button>
        )}
      </div>
      {failure && (
        <p className="text-sm text-close" role="alert">
          {failure}
        </p>
      )}
      {onCancel && !running && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Pick another deck"
          title="Pick another deck"
          className="absolute -top-2.5 -right-2.5 grid size-6 place-items-center rounded-full border-2 border-ink bg-paper text-xs leading-none font-bold text-ink shadow-[1px_1px_0_var(--color-ink)] hover:bg-pop-tomato"
        >
          ✕
        </button>
      )}
    </div>
  );
}
