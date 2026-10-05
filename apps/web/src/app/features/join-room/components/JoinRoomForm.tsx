import { normalizeRoomCode } from '@pictiotheme/game-core';
import { useId, useState, type SubmitEvent } from 'react';

const MESSAGES = {
  ambiguous_letters: 'Codes never contain I or O, so check the letters.',
  wrong_length: 'Room codes have 6 letters, like ABC-DEF.',
} as const;

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
 * The "join with a code" field. `onJoin` gets a normalized code. `onPaper` is the home page's
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

  function onChange(raw: string) {
    // Digits are dropped from the field, so warn about 0/1 now instead of on submit.
    const pastedLink = /\/r\//.test(raw);
    setError(!pastedLink && /[01]/.test(raw) ? MESSAGES.ambiguous_letters : null);
    setValue(formatCodeInput(raw));
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeRoomCode(value);
    if (!result.ok) {
      setError(MESSAGES[result.reason]);
      return;
    }
    onJoin(result.code);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-2 ${onPaper ? 'w-72' : 'w-full max-w-sm'}`}
      noValidate
    >
      <label htmlFor={inputId} className={onPaper ? 'sr-only' : 'text-sm font-medium'}>
        Join with a code
      </label>
      <div className="flex gap-2">
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
              ? 'min-w-0 flex-1 rounded-full border-[3px] border-ink bg-white px-4 py-2 font-mono text-lg tracking-widest text-ink uppercase placeholder:text-ink/35'
              : 'min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-lg tracking-widest uppercase dark:border-zinc-700'
          }
        />
        <button
          type="submit"
          className={
            onPaper
              ? 'rounded-full border-[3px] border-ink bg-pop-teal px-5 py-2 font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)]'
              : 'rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700'
          }
        >
          Join
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-close" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
