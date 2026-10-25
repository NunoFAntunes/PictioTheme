import { DisplayName, type UpdateProfileRequest } from '@pictiotheme/protocol';
import { AvatarPad, drawingToAvatar, isBlank } from '@pictiotheme/drawing-ui';
import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { saveProfile, useAccount } from '../../account-store';

/** A marker outline, heavier where the pen pressed (DoodleWhirl's hand-drawn look). */
export const MARKER_BORDER = 'border-ink border-[3px_4px_4.5px_3px]';

/**
 * "Your name and drawing", the one editor for the profile every game shares (decisions.md D13):
 * DoodleWhirl's sheet of paper taped over the page, with its drawing pad and tools
 * (`@pictiotheme/drawing-ui`). Your drawing starts on the pad to change, or you start over on a
 * blank one; leaving it untouched (or blank) keeps the drawing you have, or your game's stand-in
 * (`fallback`). Mounted while open. Esc and the backdrop leave it open: a stroke can end outside
 * the sheet, and Esc already closes the colour wheel. Always light (`data-paper`).
 */
export function ProfileDialog({
  onClose,
  fallback,
  portalUrl,
}: {
  onClose: () => void;
  /** What you look like without a drawing, for the note under the pad. */
  fallback: string;
  /** The portal, for "See all the games". Left out on the portal itself. */
  portalUrl?: string;
}) {
  const profile = useAccount((s) => s.profile);
  const dialog = useRef<HTMLDialogElement>(null);
  const pad = useRef<HTMLCanvasElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startOver, setStartOver] = useState(false);
  const [edited, setEdited] = useState(false);
  const nameId = useId();
  const titleId = useId();

  // Opening a dialog focuses its first button (the ✕): the name is what you came to change.
  useEffect(() => {
    dialog.current?.showModal();
    nameField.current?.focus();
  }, []);

  const drawing = profile?.drawing ?? null;
  const fromCurrent = drawing !== null && !startOver;
  const close = () => dialog.current?.close();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = DisplayName.safeParse(name);
    if (!parsed.success) {
      setError('Names are 2–20 characters.');
      return;
    }
    const patch: UpdateProfileRequest = { displayName: parsed.data };
    const canvas = pad.current;
    // An untouched copy of your drawing keeps the original, rather than cutting it out again.
    if (canvas && !(fromCurrent && !edited) && !isBlank(canvas)) {
      const avatar = drawingToAvatar(canvas);
      if (!avatar) {
        setError('That drawing is too detailed to save. Try fewer colours or fills.');
        return;
      }
      patch.drawing = avatar;
    }
    setBusy(true);
    const result = await saveProfile(patch);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
  };

  const switchPad = (over: boolean) => {
    setStartOver(over);
    setEdited(false);
  };

  return (
    <dialog
      ref={dialog}
      data-paper
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => e.preventDefault()}
      className="m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1.5rem)] overflow-visible bg-transparent p-0 text-left font-sans text-ink backdrop:bg-ink/40"
    >
      <form
        className={`flex max-h-[calc(100dvh-2rem)] w-[52rem] max-w-full flex-col gap-4 overflow-y-auto rounded-[1.4em_0.7em_1.2em_0.9em/0.8em_1.2em_0.7em_1.1em] bg-paper p-5 shadow-[6px_8px_0_var(--color-ink)] ${MARKER_BORDER}`}
        onSubmit={(e) => void submit(e)}
        noValidate
      >
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-logo text-2xl leading-tight">
              Your name and drawing
            </h2>
            <p className="mt-1 text-sm text-muted">
              They go with you to every game: change them here and they change everywhere.
              {portalUrl && (
                <>
                  {' '}
                  <a href={portalUrl} className="font-semibold text-ink underline">
                    See all the games
                  </a>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={close}
            className="grid size-9 shrink-0 rotate-6 place-items-center rounded-full border-2 border-ink bg-white text-lg font-bold shadow-[1px_2px_0_var(--color-ink)] transition hover:-rotate-6 hover:scale-110"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label htmlFor={nameId} className="font-bold">
              Your name
            </label>
            <input
              ref={nameField}
              id={nameId}
              value={name}
              maxLength={20}
              autoComplete="nickname"
              // A made-up name is offered as a start, not forced: it's selected so typing replaces it.
              onFocus={(e) => {
                if (profile && !profile.nameChosen) e.currentTarget.select();
              }}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Ana"
              className="w-full max-w-xs rounded-xl border-2 border-ink/20 bg-white px-3 py-2 font-bold focus:border-ink focus:outline-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-bold text-pop-dark">
              {error}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="sr-only">Draw yourself</legend>
          {/* The note and Save sit under the tools, so the sheet is no taller than the pad. */}
          <AvatarPad
            // Starting over (or back) mounts a fresh pad.
            key={fromCurrent ? 'current' : 'blank'}
            canvasRef={pad}
            startFrom={fromCurrent ? drawing : undefined}
            onDraw={() => setEdited(true)}
          >
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {drawing === null ? (
                <>
                  <CurrentLook src={fallback} />
                  Draw yourself, or leave the pad blank to keep this one.
                </>
              ) : fromCurrent ? (
                <>
                  Draw over your drawing to change it, or
                  <PadSwitch onClick={() => switchPad(true)}>Start over</PadSwitch>
                </>
              ) : (
                <>
                  <CurrentLook src={drawing} />
                  Leave the pad blank to keep it, or
                  <PadSwitch onClick={() => switchPad(false)}>Edit it instead</PadSwitch>
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-full px-5 py-2.5 font-bold hover:bg-ink/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-pop px-7 py-2.5 font-bold text-white shadow-[0_4px_0_var(--color-pop-dark)] transition hover:brightness-105 active:translate-y-1 active:shadow-none disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </AvatarPad>
        </fieldset>
        <p className="text-xs text-muted">
          {profile?.kind === 'user'
            ? 'Saved to your account.'
            : 'You’re a guest on this browser. Accounts with log-in are coming soon.'}
        </p>
      </form>
      {/* A strip of tape holding the sheet down. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 -rotate-2 bg-pop-sun/60 shadow-sm"
      />
    </dialog>
  );
}

function CurrentLook({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="How you look now"
      className="size-8 rounded-lg border border-ink/15 bg-white object-contain"
    />
  );
}

function PadSwitch({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border-2 border-ink/20 px-3 py-0.5 font-bold text-ink hover:bg-ink/5"
    >
      {children}
    </button>
  );
}
