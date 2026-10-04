import { CHAT_MAX_LENGTH, GUESS_MAX_LENGTH } from '@pictiotheme/protocol';
import { useState, type SubmitEvent } from 'react';
import { drawerIdOf, playerById, sendToRoom, useRoomStore } from '../../../realtime';

type Mode = 'guess' | 'solved-chat' | 'chat' | 'drawing';

/**
 * One input for guessing and chatting. While someone draws it sends guesses; players who
 * already solved talk only to the drawer and other solvers; otherwise it is plain chat.
 */
export function GuessInput() {
  const view = useRoomStore((s) => s.view);
  const open = useRoomStore((s) => s.connection.kind === 'open');
  const [text, setText] = useState('');
  if (!view) return null;

  const drawing = view.phase.kind === 'drawing' && !view.paused;
  const mode: Mode = drawing
    ? drawerIdOf(view.phase) === view.you
      ? 'drawing'
      : playerById(view, view.you)?.guessedThisTurn
        ? 'solved-chat'
        : 'guess'
    : 'chat';
  const placeholder = {
    guess: 'Type your guess…',
    'solved-chat': 'Chat with players who got it…',
    chat: 'Say something…',
    drawing: 'You’re drawing!',
  }[mode];
  const maxLength = mode === 'guess' || mode === 'solved-chat' ? GUESS_MAX_LENGTH : CHAT_MAX_LENGTH;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value || mode === 'drawing') return;
    sendToRoom(mode === 'chat' ? { t: 'chat', text: value } : { t: 'guess', text: value });
    setText('');
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <label className="sr-only" htmlFor="guess-input">
        {placeholder}
      </label>
      <input
        id="guess-input"
        value={text}
        maxLength={maxLength}
        disabled={mode === 'drawing' || !open}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-zinc-700"
      />
      <button
        type="submit"
        disabled={mode === 'drawing' || !open}
        className="rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
      >
        ⏎<span className="sr-only">Send</span>
      </button>
    </form>
  );
}
