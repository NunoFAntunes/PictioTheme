import { normalizeRoomCode } from '@pictiotheme/game-core';
import { useId, useState, type SubmitEvent } from 'react';
import { ApiError } from '../../../lib/api';
import { DOODLE_BUTTON, MARKER_BORDER, WOBBLE } from '../../../ui/hand-drawn';
import { useRoomLookup } from '../api';

const MESSAGES = {
  ambiguous_letters: 'Codes never contain I or O, so check the letters.',
  wrong_length: 'Room codes have 6 letters, like ABC-DEF.',
  not_found: 'No room with that code. Check it with whoever invited you.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  failed: "Couldn't check that code. Try again.",
} as const;

function lookupMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.failed;
  if (error.code === 'ROOM_NOT_FOUND') return MESSAGES.not_found;
  if (error.code === 'RATE_LIMITED') return MESSAGES.rate_limited;
  return MESSAGES.failed;
}

/**
 * Formats as the user types: uppercase, letters only, dash after the third letter. A pasted invite
 * link (`…/r/ABC-DEF`) becomes its code.
 */
export function formatCodeInput(raw: string): string {
  const link = /\/r\/([A-Za-z-]+)/.exec(raw);
  const letters = (link?.[1] ?? raw)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  return letters.length > 3 ? `${letters.slice(0, 3)}-${letters.slice(3)}` : letters;
}

/**
 * The "join with a code" field. `onJoin` gets the normalized code of a room that exists; a code
 * with no room is reported here instead, so the player stays on the page. `onPaper` is the home page's
 * look: the label is visually hidden and the button is a sticker.
 */
export function JoinRoomForm({
  onJoin,
  onPaper = false,
}: {
  onJoin: (code: string) => void;
  onPaper?: boolean;
}) {
  const inputId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The field shakes on a rejected submit; the message floats under it so nothing around it moves.
  const [shaking, setShaking] = useState(false);
  const lookup = useRoomLookup();
  // Stays busy after success: the page is navigating away.
  const checking = lookup.isPending || lookup.isSuccess;

  function onChange(raw: string) {
    // Digits are dropped from the field, so warn about 0/1 now instead of on submit.
    const pastedLink = /\/r\//.test(raw);
    setError(!pastedLink && /[01]/.test(raw) ? MESSAGES.ambiguous_letters : null);
    setValue(formatCodeInput(raw));
  }

  function reject(message: string) {
    setError(message);
    setShaking(true);
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeRoomCode(value);
    if (!result.ok) {
      reject(MESSAGES[result.reason]);
      return;
    }
    setError(null);
    lookup.mutate(result.code, {
      onSuccess: (room) => onJoin(room.code),
      onError: (e) => reject(lookupMessage(e)),
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`relative flex flex-col gap-2 ${onPaper ? 'w-72' : 'w-full max-w-sm'}`}
      noValidate
    >
      <label htmlFor={inputId} className={onPaper ? 'sr-only' : 'text-sm font-medium'}>
        Join with a code
      </label>
      <div
        className={`flex gap-2 ${shaking ? 'motion-safe:animate-shake' : ''}`}
        onAnimationEnd={() => setShaking(false)}
      >
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ABC-DEF"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={
            onPaper
              ? `min-w-0 flex-1 ${MARKER_BORDER} ${WOBBLE[2]} ${error ? 'border-close! bg-close/10' : 'bg-white'} px-4 py-2 font-mono text-lg tracking-widest text-ink uppercase placeholder:text-ink/35 focus:outline-none focus-visible:shadow-[3px_4px_0_var(--color-pop-teal)]`
              : `min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 font-mono text-lg tracking-widest uppercase ${error ? 'border-close' : 'border-zinc-300 dark:border-zinc-700'}`
          }
        />
        <button
          type="submit"
          disabled={checking}
          className={
            onPaper
              ? `${DOODLE_BUTTON} ${WOBBLE[0]} -rotate-3 bg-pop-teal px-5 py-2 text-lg text-ink`
              : 'rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60'
          }
        >
          {checking ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="absolute top-full left-0 mt-2 w-full text-sm text-close"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
