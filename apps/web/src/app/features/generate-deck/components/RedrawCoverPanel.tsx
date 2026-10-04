import type { DeckSummary } from '@pictiotheme/protocol';
import { useId, useRef, useState } from 'react';
import { isBlank } from '../../canvas';
import { CoverPad, DeckCover, drawingToCover } from '../../deck-cover';
import { useRedrawCover } from '../api';

/** Redraw the back cover of a deck you generated (decks.md, "Back cover"). */
export function RedrawCoverPanel({ deck, onClose }: { deck: DeckSummary; onClose: () => void }) {
  const redraw = useRedrawCover();
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const headingId = useId();
  const message = error ?? (redraw.isError ? redraw.error.message : null);

  function save() {
    const pad = padRef.current;
    if (!pad) return;
    if (isBlank(pad)) {
      setError('Draw something first.');
      return;
    }
    const image = drawingToCover(pad);
    if (!image) {
      setError('That drawing is too detailed to save. Simplify it a little.');
      return;
    }
    setError(null);
    redraw.mutate({ deckId: deck.id, image }, { onSuccess: onClose });
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-wrap items-start gap-4 rounded-lg border border-brand-600/40 p-4"
    >
      <CoverPad canvasRef={padRef} />
      <div className="flex min-w-40 flex-1 flex-col gap-2 text-sm">
        <h3 id={headingId} className="font-semibold">
          Redraw the cover of “{deck.title}”
        </h3>
        <div className="flex items-center gap-2 text-zinc-500">
          <DeckCover deck={deck} size="sm" />
          <span>The current cover. Saving replaces it everywhere the deck appears.</span>
        </div>
        {message && (
          <p className="text-close" role="alert">
            {message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={redraw.isPending}
            className="rounded-lg px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={redraw.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {redraw.isPending ? 'Saving…' : 'Save cover ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
