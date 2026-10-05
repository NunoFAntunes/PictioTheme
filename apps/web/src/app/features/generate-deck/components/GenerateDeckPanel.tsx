import {
  DECK_NOTES_MAX,
  DECK_THEME_MAX,
  DECK_THEME_MIN,
  type DeckCoverImage,
  type DeckSummary,
  type Difficulty,
  type GenerationStatus,
} from '@pictiotheme/protocol';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { isBlank } from '../../canvas';
import { CoverPad, DeckCover, drawingToCover } from '../../deck-cover';
import { useGenerationConfig, useGenerationJob, useSetCover, useStartGeneration } from '../api';

/**
 * "Generate a deck" (user-flows.md §8, without the review step for now): a short form, then,
 * while the server makes the deck (~1 minute), the creator draws the deck's back cover. The new
 * deck is handed back once it's published and the cover is saved or skipped.
 */

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

/** "about 5 h" / "about 40 min" until `iso`. */
function waitText(iso: string): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 60_000));
  return minutes >= 60 ? `about ${Math.ceil(minutes / 60)} h` : `about ${minutes} min`;
}

function useElapsedSeconds(running: boolean): number {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [running]);
  return Math.floor((now - startedAt) / 1_000);
}

/** The cover the creator draws while the deck generates (next-features.md, "Deck back covers"). */
type CoverState =
  | { step: 'drawing' }
  | { step: 'saving'; image: DeckCoverImage }
  | { step: 'saved'; image: DeckCoverImage; jobId: string }
  | { step: 'skipped' };

function StatusLine({
  theme,
  status,
  deck,
  failure,
}: {
  theme: string;
  status: GenerationStatus;
  deck: DeckSummary | null;
  failure: string | null;
}) {
  const seconds = useElapsedSeconds(status === 'running' && failure === null);
  if (failure !== null) {
    return (
      <p className="text-sm text-close" role="alert">
        {failure}
      </p>
    );
  }
  if (status === 'published') {
    return (
      <p role="status" className="rounded-lg bg-solved/10 p-3 text-sm font-medium">
        ✓ Your deck “{deck?.title ?? theme}” is ready! Finish your cover, or skip it.
      </p>
    );
  }
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg bg-brand-600/5 p-3 text-sm">
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
      />
      <span className="flex-1">
        <span className="block font-medium">
          Making your “{theme}” deck… {seconds}s
        </span>
        <span className="block text-zinc-500">
          This usually takes about a minute. If you leave, it will show up in your decks when it’s
          ready.
        </span>
      </span>
    </div>
  );
}

export function GenerateDeckPanel({
  onGenerated,
  onCancel,
}: {
  onGenerated: (deck: DeckSummary) => void;
  onCancel: () => void;
}) {
  const start = useStartGeneration();
  const daily = useGenerationConfig().data?.daily ?? null;
  const usedUp = daily !== null && daily.remaining === 0;
  const saveCover = useSetCover();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [difficulties, setDifficulties] = useState<Difficulty[]>(['easy', 'medium', 'hard']);
  const [silly, setSilly] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [cover, setCover] = useState<CoverState>({ step: 'drawing' });
  const [coverError, setCoverError] = useState<string | null>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const handedBack = useRef(false);
  const job = useGenerationJob(jobId);
  const themeId = useId();
  const notesId = useId();
  const headingId = useId();

  const status = job.data?.status ?? 'running';
  const deck = job.data?.deck ?? null;
  const failure =
    job.data?.status === 'failed' ? job.data.error : job.isError ? job.error.message : null;
  const valid = theme.trim().length >= DECK_THEME_MIN && difficulties.length > 0 && !usedUp;

  function upload(id: string, image: DeckCoverImage) {
    setCoverError(null);
    setCover({ step: 'saving', image });
    saveCover.mutate(
      { jobId: id, image },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(['decks', 'generations', updated.id], updated);
          setCover({ step: 'saved', image, jobId: updated.id });
        },
        onError: (err) => {
          setCover({ step: 'drawing' });
          setCoverError(err.message);
        },
      },
    );
  }

  function finishCover() {
    const pad = padRef.current;
    if (!jobId || !pad) return;
    if (isBlank(pad)) {
      setCoverError('Draw something first, or skip the cover.');
      return;
    }
    const image = drawingToCover(pad);
    if (!image) {
      setCoverError('That drawing is too detailed to save. Simplify it a little, or skip.');
      return;
    }
    upload(jobId, image);
  }

  function skipCover() {
    const pad = padRef.current;
    if (pad && !isBlank(pad) && !window.confirm('Skip the cover? Your drawing will be lost.'))
      return;
    setCoverError(null);
    setCover({ step: 'skipped' });
  }

  // Hand the deck back once it exists and the cover is dealt with.
  useEffect(() => {
    if (handedBack.current || status !== 'published' || !deck) return;
    if (cover.step !== 'saved' && cover.step !== 'skipped') return;
    handedBack.current = true;
    void queryClient.invalidateQueries({ queryKey: ['decks', 'mine'] });
    onGenerated(deck);
  }, [status, deck, cover.step, queryClient, onGenerated]);

  function toggle(d: Difficulty) {
    setDifficulties((current) =>
      current.includes(d) ? current.filter((x) => x !== d) : [...current, d],
    );
  }

  function generate() {
    if (!valid || start.isPending) return;
    start.mutate(
      { theme: theme.trim(), notes: notes.trim(), difficulties, silly },
      {
        onSuccess: (started) => {
          setJobId(started.id);
          // A retry after a failure: the cover already drawn goes to the new job.
          if (cover.step === 'saved') upload(started.id, cover.image);
        },
      },
    );
  }

  // The panel sits inside the create-room form, so it's not a form itself: Enter generates here
  // instead of submitting "Create room".
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' || event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    generate();
  }

  if (jobId !== null) {
    const drawing = cover.step === 'drawing' || cover.step === 'saving';
    return (
      <div
        role="group"
        aria-labelledby={headingId}
        className="flex flex-col gap-3 rounded-lg border border-brand-600/40 p-4"
      >
        <h3 id={headingId} className="font-semibold">
          ✨ Generate a deck
        </h3>
        <StatusLine
          theme={theme.trim()}
          status={status}
          deck={deck}
          failure={start.isError ? start.error.message : failure}
        />
        {failure !== null && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={start.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {start.isPending ? 'Starting…' : 'Try again'}
            </button>
          </div>
        )}
        {cover.step !== 'skipped' && (
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="text-sm">
              <h4 className="font-medium">
                🎨 Draw the back cover of your deck{status === 'running' && ' while you wait'}
              </h4>
              <p className="text-zinc-500">
                Everyone sees it when they pick your deck. Skip it and your deck gets a plain cover.
              </p>
            </div>
            {drawing ? (
              <CoverPad canvasRef={padRef}>
                {coverError && (
                  <p className="text-sm text-close" role="alert">
                    {coverError}
                  </p>
                )}
                <div className="flex justify-end gap-2 text-sm">
                  <button
                    type="button"
                    onClick={skipCover}
                    disabled={cover.step === 'saving'}
                    className="rounded-lg px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={finishCover}
                    disabled={cover.step === 'saving'}
                    className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {cover.step === 'saving' ? 'Saving…' : 'Save cover ✓'}
                  </button>
                </div>
              </CoverPad>
            ) : (
              <div className="flex items-center gap-4 text-sm">
                <DeckCover
                  deck={{ title: theme.trim(), coverId: null }}
                  src={cover.image}
                  size="lg"
                />
                <p className="font-medium">
                  Cover saved ✓{status === 'running' && ' Waiting for your deck…'}
                </p>
              </div>
            )}
          </div>
        )}
        {cover.step === 'skipped' && status === 'running' && (
          <p className="text-sm text-zinc-500">No cover: your deck gets a plain one.</p>
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 rounded-lg border border-brand-600/40 p-4"
    >
      <h3 id={headingId} className="font-semibold">
        ✨ Generate a deck
      </h3>
      <label htmlFor={themeId} className="flex flex-col gap-1 text-sm font-medium">
        Theme
        <input
          id={themeId}
          value={theme}
          maxLength={DECK_THEME_MAX}
          placeholder="e.g. pirates, the 1990s, camping trip"
          onChange={(e) => setTheme(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-700"
        />
      </label>
      <label htmlFor={notesId} className="flex flex-col gap-1 text-sm font-medium">
        <span>
          Notes <span className="font-normal text-zinc-500">(optional)</span>
        </span>
        <textarea
          id={notesId}
          value={notes}
          rows={2}
          maxLength={DECK_NOTES_MAX}
          placeholder="e.g. for a family party with kids aged 6+"
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-700"
        />
      </label>
      <fieldset className="flex flex-wrap items-center gap-2 text-sm">
        <legend className="mb-1 font-medium">Difficulties</legend>
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            aria-pressed={difficulties.includes(d.value)}
            onClick={() => toggle(d.value)}
            className={`rounded-md border px-3 py-1 ${
              difficulties.includes(d.value)
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
          >
            {d.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2">
          <input
            type="checkbox"
            checked={silly}
            onChange={(e) => setSilly(e.target.checked)}
            className="accent-brand-600"
          />
          🤪 Silly cards
        </label>
      </fieldset>
      {difficulties.length === 0 && (
        <p className="text-sm text-close">Pick at least one difficulty.</p>
      )}
      {start.isError && (
        <p className="text-sm text-close" role="alert">
          {start.error.message}
        </p>
      )}
      {daily && (
        <p className="text-sm text-zinc-500" data-testid="generation-allowance">
          {usedUp
            ? `You've used today's free deck${daily.limit === 1 ? '' : 's'}.${daily.nextAt ? ` You can make another in ${waitText(daily.nextAt)}.` : ''}`
            : `You can make ${daily.limit === 1 ? 'one deck' : `${daily.limit} decks`} a day${daily.remaining < daily.limit ? ` (${daily.remaining} left today)` : ''}.`}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={generate}
          disabled={!valid || start.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {start.isPending ? 'Starting…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
