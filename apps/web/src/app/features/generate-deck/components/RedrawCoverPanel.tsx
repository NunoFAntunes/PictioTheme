import type { DeckSummary } from '@pictiotheme/protocol';
import { useRef, useState } from 'react';
import { PaperDialog } from '../../../ui/PaperDialog';
import { isBlank } from '../../canvas';
import { CoverPad, DeckCover, drawingToCover } from '../../deck-cover';
import { useRedrawCover } from '../api';

/** Redraw the back cover of a deck you generated (decks.md, "Back cover"), in a popup. */
export function RedrawCoverPanel({ deck, onClose }: { deck: DeckSummary; onClose: () => void }) {
  const redraw = useRedrawCover();
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
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
    <PaperDialog
      open
      guarded
      onClose={onClose}
      className="w-[50rem]"
      title={`Redraw the cover of “${deck.title}”`}
      subtitle={
        <span className="flex items-center gap-3">
          <DeckCover deck={deck} size="sm" />
          The current cover. Saving replaces it everywhere the deck appears.
        </span>
      }
    >
      <CoverPad canvasRef={padRef}>
        {message && (
          <p className="text-sm text-close" role="alert">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onClose}
            disabled={redraw.isPending}
            className="rounded-lg px-4 py-2 hover:bg-ink/5"
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
      </CoverPad>
    </PaperDialog>
  );
}
