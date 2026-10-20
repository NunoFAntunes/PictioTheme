import { GUESS_MAX_LENGTH } from '@pictiotheme/protocol';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { myTeam, sendToRoom, type RoomView } from '../../../realtime';

const CLOSE_MS = 2_500;

/**
 * The one guess line, for both drawings: the server checks a guess against your crew's drawing
 * first, then (steals on) the other crew's, where a right answer steals it. No log of guesses:
 * just a "so close!" for a moment when you nearly had it.
 */
export function GuessBox({
  view,
  disabledReason,
}: {
  view: RoomView;
  /** Why you can't guess right now (drawing, placing…), or null. */
  disabledReason: string | null;
}) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const team = myTeam(view);
  const other = team === 'orange' ? 'teal' : 'orange';
  const steals = view.settings.steals;
  const anything = Boolean((team && view.crews[team].round) || (steals && view.crews[other].round));
  const disabled = disabledReason !== null || !anything;

  // Your latest guess, if the server said it was close.
  const last = view.feed.findLast((f) => f.playerId === view.you);
  const [shownKey, setShownKey] = useState<number | null>(null);
  const closeKey = last?.result === 'close' ? last.key : null;
  const close = closeKey !== null && closeKey !== shownKey ? last?.text : null;
  useEffect(() => {
    if (closeKey === null) return;
    const timer = setTimeout(() => setShownKey(closeKey), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closeKey]);

  useEffect(() => {
    if (disabled) {
      // Let go of the keyboard, so the placement keys reach the tower.
      if (document.activeElement === input.current) input.current?.blur();
    } else {
      input.current?.focus();
    }
  }, [disabled]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const guess = text.trim();
    if (!guess || disabled) return;
    sendToRoom({ t: 'guess', text: guess.slice(0, GUESS_MAX_LENGTH) });
    setText('');
  };

  const placeholder =
    disabledReason ??
    (!anything
      ? 'Waiting for the next drawing…'
      : steals
        ? 'Guess either drawing: yours to build, theirs to steal…'
        : 'Guess your crew’s drawing…');

  return (
    <form onSubmit={submit} className="relative flex gap-2">
      <input
        ref={input}
        value={text}
        maxLength={GUESS_MAX_LENGTH}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        aria-label="Guess"
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 min-w-0 flex-1 rounded-xl border-4 border-white bg-paper px-4 text-lg font-medium text-ink shadow-[0_4px_0_var(--color-card-edge)] outline-none focus:border-coral disabled:bg-card-dark disabled:text-ink/60"
      />
      <button
        type="submit"
        disabled={disabled}
        className="h-12 rounded-xl bg-coral px-5 font-display text-lg text-cloud shadow-[0_4px_0_var(--color-coral-dark)] active:translate-y-1 active:shadow-none disabled:opacity-50"
      >
        Guess
      </button>
      {close && (
        <div
          role="status"
          className="pointer-events-none absolute -top-3 left-3 rounded-lg bg-coral px-2 py-0.5 text-xs font-bold text-cloud shadow"
        >
          “{close}” is so close!
        </div>
      )}
    </form>
  );
}
