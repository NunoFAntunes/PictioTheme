import { SavedDeckId, type DeckReportReason, type RoomDeck } from '@pictiotheme/protocol';
import { useEffect, useId, useRef, useState } from 'react';
import { useReportDeck } from '../api';

/**
 * 🚩 on a deck shown to other players: report its drawn cover or its cards and title
 * (decks.md#back-cover, security-and-moderation.md). Enough reports from different players hide
 * the cover (the default one shows instead) or the deck. Built-in decks can't be reported.
 */
export function ReportDeckButton({
  deck,
  className = 'relative',
}: {
  deck: RoomDeck;
  /** Positions the button. It must be a positioned element: the menu opens below it. */
  className?: string;
}) {
  const report = useReportDeck();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!SavedDeckId.safeParse(deck.id).success) return null;

  if (report.isSuccess) {
    return (
      <span
        role="status"
        title="Thanks, we'll take a look"
        className={`text-xs text-zinc-500 ${className}`}
      >
        ✓ Reported
      </span>
    );
  }

  const send = (reason: DeckReportReason) =>
    report.mutate({ deckId: deck.id, reason }, { onSuccess: () => setOpen(false) });

  const item =
    'block w-full rounded-md px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800';

  return (
    <div ref={rootRef} className={className}>
      <button
        type="button"
        aria-label={`Report the deck ${deck.title}`}
        title="Report this deck"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-white/90 px-1.5 py-0.5 text-xs shadow-sm ring-1 ring-black/10 hover:bg-white dark:bg-zinc-900/90 dark:ring-white/10"
      >
        🚩
      </button>
      {open && (
        <div
          id={menuId}
          role="group"
          aria-label="Report this deck"
          className="absolute top-full left-0 z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-1 text-left text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="px-3 py-1 text-xs text-zinc-500">What's wrong with this deck?</p>
          {deck.coverId && (
            <button
              type="button"
              disabled={report.isPending}
              onClick={() => send('cover')}
              className={item}
            >
              The cover drawing is offensive
            </button>
          )}
          <button
            type="button"
            disabled={report.isPending}
            onClick={() => send('content')}
            className={item}
          >
            The cards or title are offensive
          </button>
          {report.isError && (
            <p role="alert" className="px-3 py-1 text-xs text-close">
              {report.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
