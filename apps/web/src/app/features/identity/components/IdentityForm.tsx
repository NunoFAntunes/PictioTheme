import { DisplayName } from '@pictiotheme/protocol';
import { useId, useRef, useState, type SubmitEvent } from 'react';
import { useIdentity, type Identity } from '../../../lib/identity';
import { Avatar, AvatarPad, drawingToAvatar, initialAvatar } from '../../avatar';
import { isBlank } from '../../canvas';
import { hasGeneratedAvatar } from '../generated-avatar';

/**
 * "Pick a name and draw your avatar" (user-flows.md §2). Guests need nothing else to play.
 * A drawn avatar starts on the pad to edit, or you start over on a blank one. Leaving it untouched
 * (or blank) keeps the current avatar, or makes one from your initial. `onSaved` gets the saved
 * identity.
 */
export function IdentityForm({
  submitLabel = 'Continue',
  onDone,
  onSaved,
  framed = true,
}: {
  submitLabel?: string;
  /** Its own outlined box; off where something already frames it (the paper popup). */
  framed?: boolean;
  onDone?: () => void;
  onSaved?: (identity: Identity) => void;
}) {
  const { identity, setIdentity } = useIdentity();
  const [name, setName] = useState(identity?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const nameId = useId();
  // A drawn avatar is put on the pad to edit; a generated initial isn't worth drawing over.
  const editable = identity !== null && !hasGeneratedAvatar(identity);
  const [startOver, setStartOver] = useState(false);
  const [edited, setEdited] = useState(false);
  const fromCurrent = editable && !startOver;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = DisplayName.safeParse(name);
    if (!parsed.success) {
      setError('Names are 2–20 characters.');
      return;
    }
    const pad = padRef.current;
    // An untouched copy of the current avatar keeps the original, rather than re-cutting it.
    const drawn = pad && !(fromCurrent && !edited) && !isBlank(pad);
    // A generated initial follows a new name; a drawn avatar is kept.
    const keptInitial = identity && hasGeneratedAvatar(identity);
    const avatar = drawn
      ? drawingToAvatar(pad)
      : identity && !keptInitial
        ? identity.avatar
        : initialAvatar(parsed.data);
    if (!avatar) {
      setError('That drawing is too detailed to save. Try fewer colours or fills.');
      return;
    }
    // A kept avatar keeps its own state; a new one is always a cut-out.
    const cutout = drawn || !identity ? true : identity.cutout;
    const saved: Identity = cutout
      ? { displayName: parsed.data, avatar, cutout }
      : { displayName: parsed.data, avatar };
    setIdentity(saved);
    onSaved?.(saved);
    onDone?.();
  }

  function switchPad(over: boolean) {
    setStartOver(over);
    setEdited(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex w-full max-w-3xl flex-col gap-4 ${framed ? 'rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800' : ''}`}
      noValidate
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={nameId} className="text-sm font-medium">
            Your name
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={20}
            autoComplete="nickname"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Ana"
            className="w-full max-w-xs rounded-lg border border-zinc-300 bg-white/60 px-3 py-2 dark:border-zinc-700 dark:bg-transparent"
          />
        </div>
        {error && (
          <p className="text-sm text-close" role="alert">
            {error}
          </p>
        )}
      </div>
      <fieldset>
        <legend className="sr-only">Draw your avatar</legend>
        {/* The note and Save sit under the tools, so the form is no taller than the pad. */}
        <AvatarPad
          // Starting over (or back) mounts a fresh pad.
          key={fromCurrent ? 'current' : 'blank'}
          canvasRef={padRef}
          startFrom={fromCurrent ? identity.avatar : undefined}
          onDraw={() => setEdited(true)}
        >
          <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {editable ? (
              fromCurrent ? (
                <>
                  Draw over your avatar to change it, or
                  <PadSwitch onClick={() => switchPad(true)}>Start over</PadSwitch>
                </>
              ) : (
                <>
                  <Avatar src={identity.avatar} size="sm" alt="Your current avatar" />
                  Leave the pad blank to keep your current one, or
                  <PadSwitch onClick={() => switchPad(false)}>Edit it instead</PadSwitch>
                </>
              )
            ) : identity ? (
              <>
                <Avatar src={identity.avatar} size="sm" alt="Your current avatar" />
                Leave the pad blank to keep your current one.
              </>
            ) : (
              'Leave the pad blank to use your initial.'
            )}
          </p>
          <button
            type="submit"
            className="self-end rounded-lg bg-brand-600 px-6 py-2 font-semibold text-white hover:bg-brand-700"
          >
            {submitLabel}
          </button>
        </AvatarPad>
      </fieldset>
    </form>
  );
}

function PadSwitch({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-300 px-2.5 py-0.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}
