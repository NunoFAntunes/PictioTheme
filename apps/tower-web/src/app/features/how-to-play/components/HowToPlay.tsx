import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../ui/Button';
import { LoopsPaused, useReducedMotion } from './LoopCanvas';
import { PAGES, SECTIONS } from './pages';

/** Set once the guide has opened in this browser, so it only opens by itself the first time. */
const SEEN_KEY = 'doodletower.seen-how-to-play';

function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    // Private window: better not to open it on every visit.
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private window: it just won't be remembered.
  }
}

const firstPageOf = (section: (typeof SECTIONS)[number]) =>
  PAGES.findIndex((p) => p.section === section);

/**
 * How to play (docs/tower/design/screens.md#how-to-play): the rules a page at a time, each with a
 * picture, in three sections (the basics, the tricks, the powers) you can jump between. On the
 * home page and in the waiting room it's a "How to play?" pill; during a match, a round "?" by the
 * sound control, and the match carries on while it's open. The home page's is a big "hero" button,
 * and with `openOnFirstVisit` the guide opens by itself the first time this browser comes by.
 */
export function HowToPlay({
  variant = 'pill',
  openOnFirstVisit = false,
}: {
  variant?: 'pill' | 'hero' | 'round';
  openOnFirstVisit?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // On a first visit it starts open, and shows itself once it's on the page (below).
  const [open, setOpen] = useState(() => openOnFirstVisit && !seenBefore());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = useReducedMotion();
  const page = PAGES[index] ?? PAGES[0];
  const last = index === PAGES.length - 1;
  const go = (to: number) => setIndex(Math.max(0, Math.min(PAGES.length - 1, to)));

  useEffect(() => {
    if (!open) return;
    // The match listens for keys on the window (K/C, 1/2, the arrows, Space), and focus can be on
    // the page behind (our buttons let go of it on click): catch every key first, while reading.
    // The dialog's own keys still work (Escape, Tab, Enter on a button); key-ups go through, so a
    // key held down before opening isn't stuck.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(PAGES.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const show = () => {
    markSeen();
    setIndex(0);
    setOpen(true);
    dialog.current?.showModal();
  };

  useEffect(() => {
    if (!open || dialog.current?.open) return;
    markSeen();
    dialog.current?.showModal();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!page) return null;
  const close = () => dialog.current?.close();

  return (
    <>
      {variant === 'pill' ? (
        <button
          ref={trigger}
          type="button"
          onClick={show}
          className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-dusk-800 shadow-[0_3px_0_var(--color-card-edge)] hover:bg-white"
        >
          How to play?
        </button>
      ) : variant === 'hero' ? (
        <button
          ref={trigger}
          type="button"
          onClick={show}
          className="inline-flex items-center gap-2 rounded-2xl bg-sun px-5 py-2.5 font-display text-xl tracking-wide text-sun-ink shadow-[0_5px_0_var(--color-sun-dark)] transition hover:brightness-105 active:translate-y-[5px] active:shadow-none motion-safe:animate-[nudge_6s_ease-in-out_infinite]"
        >
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-sun-ink text-base text-sun"
          >
            ?
          </span>
          How to play
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={show}
          aria-label="How to play"
          title="How to play"
          className="fixed top-2 right-16 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-dusk-900 font-display text-xl text-cloud shadow-[0_3px_0_var(--color-dusk-950)] transition hover:bg-dusk-800"
        >
          ?
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="how-to-play-title"
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-3xl bg-transparent backdrop:bg-dusk-950/50"
        onClose={() => {
          setOpen(false);
          // The dialog gives focus back to its button: let go of it, or Space (drop the piece)
          // would open it again.
          trigger.current?.blur();
        }}
        onClick={(e) => {
          // A click on the backdrop closes it.
          if (e.target === e.currentTarget) close();
        }}
      >
        {open && (
          <div className="card-panel flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="how-to-play-title"
                className="font-display text-2xl tracking-wide text-ink sm:text-3xl"
              >
                How to play
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xl text-ink/70 hover:bg-card-dark"
              >
                ✕
              </button>
            </div>

            <nav aria-label="Sections" className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  aria-current={page.section === section ? 'step' : undefined}
                  onClick={() => go(firstPageOf(section))}
                  className={`rounded-full px-3.5 py-1 font-display text-sm tracking-wide transition ${
                    page.section === section
                      ? 'bg-ink text-sun'
                      : 'bg-card-dark text-dusk-800 hover:bg-card-edge/60'
                  }`}
                >
                  {section}
                </button>
              ))}
            </nav>

            <section
              aria-labelledby="how-to-play-page"
              className="grid items-center gap-5 sm:grid-cols-2 [&>*]:min-w-0"
            >
              <div className="relative">
                <LoopsPaused.Provider value={paused}>{page.art}</LoopsPaused.Provider>
                {page.animated && !still && (
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? 'Play the picture' : 'Pause the picture'}
                    title={paused ? 'Play' : 'Pause'}
                    className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-white/85 text-xs text-ink shadow-[0_2px_0_var(--color-card-edge)] hover:bg-white"
                  >
                    {paused ? '▶' : '❚❚'}
                  </button>
                )}
              </div>
              <div className="space-y-2 text-[0.9375rem] leading-snug font-medium text-ink/85">
                <h3 id="how-to-play-page" className="font-display text-2xl tracking-wide text-ink">
                  {page.title}
                </h3>
                {page.text}
              </div>
            </section>

            {variant === 'round' && (
              <p className="text-center text-xs font-semibold text-ink/60">
                The match carries on while you read.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button
                className="h-11 px-5 whitespace-nowrap"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                ← Back
              </Button>
              <ol
                className="hidden gap-1.5 sm:flex"
                aria-label={`Page ${index + 1} of ${PAGES.length}`}
              >
                {PAGES.map((p, i) => (
                  <li key={p.title}>
                    <button
                      type="button"
                      aria-label={p.title}
                      aria-current={i === index ? 'step' : undefined}
                      onClick={() => go(i)}
                      className={`block size-2.5 rounded-full transition ${
                        i === index ? 'scale-125 bg-coral' : 'bg-card-edge hover:bg-dusk-700'
                      }`}
                    />
                  </li>
                ))}
              </ol>
              {last ? (
                <Button variant="primary" className="h-11 px-5 whitespace-nowrap" onClick={close}>
                  Let’s play!
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="h-11 px-5 whitespace-nowrap"
                  onClick={() => go(index + 1)}
                >
                  Next →
                </Button>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
