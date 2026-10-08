import { CHAT_MAX_LENGTH, DECK_LANGUAGES, GUESS_MAX_LENGTH } from '@pictiotheme/protocol';
import { useRef, useState, type SubmitEvent } from 'react';
import { drawerIdOf, playerById, sendToRoom, useRoomStore } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { GUESS_STRIP } from '../../../ui/room-frame';
import { MicIcon, ReturnArrowIcon } from '../../../ui/ScribbleIcons';
import { recognitionConstructor, speechLang } from '../speech';
import { useVoice, type VoiceState } from '../use-voice';

type Mode = 'guess' | 'solved-chat' | 'chat' | 'drawing';

const TAB: Record<Mode, string> = {
  guess: 'Your guess',
  'solved-chat': 'Solvers’ chat',
  chat: 'Chat',
  drawing: 'You’re drawing!',
};

const PLACEHOLDER: Record<Mode, string> = {
  guess: 'Type your guess…',
  'solved-chat': 'Chat with players who got it…',
  chat: 'Say something…',
  drawing: 'You’re drawing!',
};

/** A press on the mic at least this long is push-to-talk: letting go sends. Shorter is a tap. */
const HOLD_MS = 300;

/**
 * Where you write your guess, on its own strip of paper under the feed. While someone draws it
 * sends guesses; players who already solved talk only to the drawer and other solvers; otherwise
 * it is plain chat. Where the browser can listen, the mic says it instead of typing it: hold it
 * while you talk, or tap it to leave it open. Spoken guesses go out the moment the words settle,
 * one after another, like shouting at the screen; spoken chat lands in the field to check first.
 * Sending is mostly Enter, so the send key is small.
 */
export function GuessBar() {
  const view = useRoomStore((s) => s.view);
  const open = useRoomStore((s) => s.connection.kind === 'open');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * True while an IME composes (Japanese, Chinese, Korean): the Enter that confirms the text isn't
   * a send. Cleared a tick after compositionend, because Safari sends that Enter right after it.
   */
  const composing = useRef(false);

  const mode: Mode = !view
    ? 'chat'
    : view.phase.kind === 'drawing' && !view.paused
      ? drawerIdOf(view.phase) === view.you
        ? 'drawing'
        : playerById(view, view.you)?.guessedThisTurn
          ? 'solved-chat'
          : 'guess'
      : 'chat';
  const language = DECK_LANGUAGES.find((l) => l.code === view?.settings.language);
  const maxLength = mode === 'guess' || mode === 'solved-chat' ? GUESS_MAX_LENGTH : CHAT_MAX_LENGTH;
  const disabled = mode === 'drawing' || !open;

  const voice = useVoice({
    lang: language ? speechLang(language.code) : 'en-GB',
    scope: mode,
    use: mode === 'guess' ? 'send' : 'fill',
    onHeard: (heard) => {
      if (mode === 'guess') {
        sendToRoom({ t: 'guess', text: heard.slice(0, maxLength) });
        return;
      }
      setText((typed) => `${typed.trim()} ${heard}`.trim().slice(0, maxLength));
      inputRef.current?.focus();
    },
  });

  if (!view) return null;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value || mode === 'drawing') return;
    sendToRoom(mode === 'chat' ? { t: 'chat', text: value } : { t: 'guess', text: value });
    setText('');
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && voice.state.kind === 'listening') voice.cancel();
      }}
      data-paper
      className={`${GUESS_STRIP} flex items-center gap-2 px-3 pt-4 pb-2.5`}
    >
      <span
        aria-hidden="true"
        className={`absolute -top-3 left-3 -rotate-3 border-2 border-ink px-2 font-logo text-sm leading-5 text-ink shadow-[2px_2px_0_var(--color-ink)] ${WOBBLE[0]} ${
          mode === 'guess' ? 'bg-pop-sun' : mode === 'drawing' ? 'bg-zinc-200' : 'bg-pop-teal'
        }`}
      >
        {TAB[mode]}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-1.5 right-8 h-3.5 w-10 rotate-6 bg-pop-teal/45 shadow-sm"
      />
      {voice.state.kind !== 'idle' && <VoiceBubble state={voice.state} />}

      <label className="sr-only" htmlFor="guess-input">
        {PLACEHOLDER[mode]}
      </label>
      <input
        ref={inputRef}
        id="guess-input"
        value={text}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => setTimeout(() => (composing.current = false))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (composing.current || e.nativeEvent.isComposing)) {
            e.preventDefault();
          }
        }}
        placeholder={PLACEHOLDER[mode]}
        autoComplete="off"
        // Handwriting where the font has the letters (Gochi Hand is Latin only).
        className={`min-w-0 flex-1 border-0 border-b-2 border-dashed border-paper-line bg-transparent px-1 py-1 text-ink placeholder:text-zinc-400 focus:border-solid focus:border-brand-500 focus:outline-none disabled:opacity-50 ${
          language?.script === 'latin' ? 'font-hand text-xl' : 'text-base'
        }`}
      />
      {!disabled && <MicButton voice={voice} />}
      <button
        type="submit"
        disabled={disabled}
        title="Send (Enter)"
        className="grid h-7 w-8 shrink-0 place-items-center rounded-md border-2 border-ink bg-white text-ink shadow-[0_2px_0_var(--color-ink)] transition hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-none disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none pointer-coarse:size-11"
      >
        <ReturnArrowIcon className="size-4" />
        <span className="sr-only">Send</span>
      </button>
    </form>
  );
}

/**
 * The mic: hold it while you talk, or tap it to open it (guesses: until you tap again; chat: until
 * you pause). Hidden where there's no recogniser.
 */
function MicButton({ voice }: { voice: ReturnType<typeof useVoice> }) {
  const press = useRef<number | null>(null);
  if (!recognitionConstructor()) return null;
  const listening = voice.state.kind === 'listening';

  function release(timeStamp: number) {
    const downAt = press.current;
    press.current = null;
    if (downAt !== null && timeStamp - downAt >= HOLD_MS) voice.stop();
  }

  return (
    <button
      type="button"
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : 'Say it out loud'}
      title="Tap and say it, or hold while you talk"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // Keep the text field focused, so typing carries on after speaking.
        e.preventDefault();
        if (listening) {
          press.current = null;
          voice.stop();
        } else {
          press.current = e.timeStamp;
          voice.start();
        }
      }}
      onPointerUp={(e) => release(e.timeStamp)}
      onPointerCancel={(e) => release(e.timeStamp)}
      onClick={(e) => {
        // Pointer presses are handled above; this is Enter or Space on the focused button.
        if (e.detail !== 0) return;
        if (listening) voice.stop();
        else voice.start();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative grid size-10 shrink-0 touch-none place-items-center border-2 border-ink text-ink shadow-[2px_3px_0_var(--color-ink)] transition select-none [-webkit-touch-callout:none] hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-ink pointer-coarse:size-11 ${WOBBLE[1]} ${
        listening ? 'translate-y-0.5 -rotate-6 bg-pop-pink/50 shadow-none' : 'rotate-3 bg-white'
      }`}
    >
      {listening && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 animate-ping border-2 border-pop-tomato ${WOBBLE[1]}`}
        />
      )}
      <MicIcon className="size-7" />
    </button>
  );
}

/** A speech bubble above the strip: what the mic hears as you say it, or why it couldn't. */
function VoiceBubble({ state }: { state: Exclude<VoiceState, { kind: 'idle' }> }) {
  const problem = state.kind === 'problem';
  return (
    <div
      role="status"
      className={`absolute right-2 bottom-full left-2 mb-3 animate-note-drop border-2 bg-white px-3 py-1.5 text-ink shadow-[3px_3px_0_var(--color-ink)] ${WOBBLE[2]} ${
        problem ? 'border-pop-tomato text-sm' : 'border-ink'
      }`}
    >
      {state.kind === 'problem' ? (
        state.message
      ) : state.heard ? (
        <span className="font-hand text-xl">“{state.heard}”</span>
      ) : state.sent ? (
        <span className="font-hand text-lg text-zinc-500">
          <span className="text-solved">✓</span> “{state.sent}” sent
        </span>
      ) : (
        <span className="font-hand text-lg text-zinc-500">
          Listening<span className="animate-pulse">…</span>
        </span>
      )}
      {/* The bubble's tail, pointing down at the mic. */}
      <span
        aria-hidden="true"
        className={`absolute right-16 -bottom-2 size-3.5 rotate-45 border-r-2 border-b-2 bg-white ${
          problem ? 'border-pop-tomato' : 'border-ink'
        }`}
      />
    </div>
  );
}
