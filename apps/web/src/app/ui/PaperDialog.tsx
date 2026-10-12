import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MARKER_BORDER } from './hand-drawn';

/**
 * The game's modal: a sheet of paper taped over the page, with a marker outline, a title in the
 * logo's font and a ✕ sticker. Always light (`data-paper`), like the paper it is.
 *
 * `guarded` is for drawing pads: Esc and a click on the backdrop leave it open (Esc already
 * cancels a size drag or closes the colour wheel, and a stroke can end outside the sheet), so
 * only the ✕ and the caller's own buttons close it.
 */
export function PaperDialog({
  open,
  onClose,
  title,
  subtitle,
  guarded = false,
  className = '',
  children,
}: {
  open: boolean;
  /** It closed: the ✕, Esc or the backdrop (unless `guarded`). Set `open` to false. */
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  guarded?: boolean;
  /** The sheet's width. Give one when the contents size themselves with container queries. */
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-paper
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        if (guarded) e.preventDefault();
      }}
      onClick={(e) => {
        // A click on the backdrop is a click on the dialog element itself, outside the sheet.
        if (!guarded && e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-visible bg-transparent p-0 text-ink backdrop:bg-ink/40"
    >
      <div
        className={`max-h-[calc(100dvh-2rem)] max-w-full overflow-y-auto rounded-[1.4em_0.7em_1.2em_0.9em/0.8em_1.2em_0.7em_1.1em] bg-paper p-5 shadow-[6px_8px_0_var(--color-ink)] ${MARKER_BORDER} ${className}`}
      >
        <div className="mb-4 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-logo text-2xl leading-tight">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={() => ref.current?.close()}
            className="grid size-9 shrink-0 rotate-6 place-items-center rounded-full border-2 border-ink bg-white text-lg font-bold shadow-[1px_2px_0_var(--color-ink)] transition hover:-rotate-6 hover:scale-110"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
      {/* A strip of tape holding the sheet down. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 -rotate-2 bg-pop-sun/60 shadow-sm"
      />
    </dialog>
  );
}
