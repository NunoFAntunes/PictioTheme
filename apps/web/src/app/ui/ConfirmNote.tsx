import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A button that asks before doing something you can't take back: instead of the browser's
 * confirm(), a slip of paper is taped to the desk under it, in the room's own look. Escape, a
 * click elsewhere or the cancel button puts it away; the cancel button has the focus, so a stray
 * Enter never confirms.
 */
export function ConfirmNote({
  label,
  className,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Keep playing',
  confirmDisabled = false,
  onConfirm,
}: {
  /** The button's contents. */
  label: ReactNode;
  className: string;
  title: string;
  /** What will happen, under the title. */
  children: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          data-paper
          className="absolute top-full right-0 z-30 mt-4 w-80 max-w-[calc(100vw-2rem)] origin-top rotate-1 rounded-sm bg-paper px-5 pt-6 pb-4 text-left text-ink shadow-[0_2px_0_rgb(0_0_0/0.06),0_18px_36px_-14px_rgb(0_0_0/0.5)] scheme-light motion-safe:animate-note-drop"
        >
          <div
            aria-hidden="true"
            className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-3 bg-pop-sun/60 shadow-sm"
          />
          <h2 id={titleId} className="font-logo text-2xl leading-tight font-normal">
            {title}
          </h2>
          <p id={bodyId} className="mt-1 text-sm text-ink/75">
            {children}
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              ref={cancel}
              type="button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
              className="rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap underline decoration-ink/30 decoration-wavy underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink pointer-coarse:min-h-11"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-pop-tomato px-3 py-1.5 text-sm font-bold whitespace-nowrap shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none pointer-coarse:min-h-11"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
