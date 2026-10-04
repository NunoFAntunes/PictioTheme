import { DisplayName } from '@pictiotheme/protocol';
import { useId, useRef, useState, type SubmitEvent } from 'react';
import { useIdentity } from '../../../lib/identity';
import { Avatar, AvatarPad, drawingToAvatar, initialAvatar } from '../../avatar';
import { isBlank } from '../../canvas';

/**
 * "Pick a name and draw your avatar" (user-flows.md §2). Guests need nothing else to play.
 * Leaving the pad blank keeps the current avatar, or makes one from your initial.
 */
export function IdentityForm({
  submitLabel = 'Continue',
  onDone,
}: {
  submitLabel?: string;
  onDone?: () => void;
}) {
  const { identity, setIdentity } = useIdentity();
  const [name, setName] = useState(identity?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const nameId = useId();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = DisplayName.safeParse(name);
    if (!parsed.success) {
      setError('Names are 2–20 characters.');
      return;
    }
    const pad = padRef.current;
    const drawn = pad && !isBlank(pad);
    const avatar = drawn ? drawingToAvatar(pad) : (identity?.avatar ?? initialAvatar(parsed.data));
    if (!avatar) {
      setError('That drawing is too detailed to save. Try fewer colours or fills.');
      return;
    }
    setIdentity({ displayName: parsed.data, avatar });
    onDone?.();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
      noValidate
    >
      <div className="flex flex-col gap-1">
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
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        {error && (
          <p className="text-sm text-close" role="alert">
            {error}
          </p>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Draw your avatar</legend>
        <AvatarPad canvasRef={padRef} />
        <p className="flex items-center justify-center gap-2 text-xs text-zinc-500">
          {identity ? (
            <>
              <Avatar src={identity.avatar} size="sm" alt="Your current avatar" />
              Leave it blank to keep your current one.
            </>
          ) : (
            'Leave it blank to use your initial.'
          )}
        </p>
      </fieldset>
      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
