import { GUESS_MAX_LENGTH } from '@pictiotheme/protocol';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendToRoom, useServerNow, type RoomView } from '../../../realtime';
import { CREW_NAME } from '../../../ui/CrewBadge';
import { myTeam } from '../../../realtime';

/**
 * The guess box: it always guesses at the drawing in focus. `Tab` swaps which one that is
 * (your crew's, or the other crew's to steal it).
 */
export function GuessBox({
  view,
  focus,
  onSwap,
  disabledReason,
}: {
  view: RoomView;
  focus: 'own' | 'steal';
  onSwap: () => void;
  /** Why you can't guess right now (drawing, placing…), or null. */
  disabledReason: string | null;
}) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const now = useServerNow();
  const team = myTeam(view);
  const target = focus === 'own' ? team : team === 'orange' ? 'teal' : 'orange';
  const cooling = focus === 'steal' && view.stealCooldownUntil > now;
  const round = target ? view.crews[target].round : null;
  const disabled = disabledReason !== null || !round;

  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled, focus]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const guess = text.trim();
    if (!guess || disabled || cooling) return;
    sendToRoom({ t: 'guess', text: guess.slice(0, GUESS_MAX_LENGTH), target: focus });
    setText('');
  };

  const placeholder =
    disabledReason ??
    (!round
      ? 'Waiting for the next drawing…'
      : cooling
        ? `Steal cooldown… ${((view.stealCooldownUntil - now) / 1000).toFixed(1)}s`
        : focus === 'steal'
          ? `Steal ${target ? CREW_NAME[target] : ''}'s drawing…`
          : 'Guess your crew’s drawing…');

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        ref={input}
        value={text}
        maxLength={GUESS_MAX_LENGTH}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            onSwap();
          }
        }}
        aria-label={focus === 'steal' ? 'Steal guess' : 'Guess'}
        placeholder={placeholder}
        autoComplete="off"
        className={`h-12 min-w-0 flex-1 rounded-md border-2 px-4 text-lg font-medium text-ink outline-none disabled:opacity-60 ${focus === 'steal' ? 'border-hazard bg-hazard/90 placeholder:text-ink/60' : 'border-ink/20 bg-tracing focus:border-safety'}`}
      />
      <button
        type="submit"
        disabled={disabled || cooling}
        className="h-12 rounded-md bg-safety px-5 font-display text-ink disabled:opacity-40"
      >
        {focus === 'steal' ? 'Steal' : 'Guess'}
      </button>
    </form>
  );
}
