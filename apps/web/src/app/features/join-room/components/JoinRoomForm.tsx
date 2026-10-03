import { normalizeRoomCode } from '@pictiotheme/game-core';
import { useId, useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';

const MESSAGES = {
  ambiguous_letters: 'Codes never contain I or O, so check the letters.',
  wrong_length: 'Room codes have 6 letters, like ABC-DEF.',
} as const;

/** Formats as the user types: uppercase, letters only, dash after the third letter. */
function formatCodeInput(raw: string): string {
  const letters = raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  return letters.length > 3 ? `${letters.slice(0, 3)}-${letters.slice(3)}` : letters;
}

export function JoinRoomForm() {
  const navigate = useNavigate();
  const inputId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onChange(raw: string) {
    // Digits are dropped from the field, so warn about 0/1 now instead of on submit.
    setError(/[01]/.test(raw) ? MESSAGES.ambiguous_letters : null);
    setValue(formatCodeInput(raw));
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeRoomCode(value);
    if (!result.ok) {
      setError(MESSAGES[result.reason]);
      return;
    }
    void navigate(`/r/${result.code}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-2" noValidate>
      <label htmlFor={inputId} className="text-sm font-medium">
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
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-lg tracking-widest uppercase dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
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
