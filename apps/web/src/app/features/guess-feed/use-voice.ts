import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  recognitionConstructor,
  sameWords,
  speechErrorMessage,
  VOICE_UNAVAILABLE,
  type Recognition,
} from './speech';

export type VoiceState =
  | { kind: 'idle' }
  /**
   * `heard` is what's being said now, growing as the recogniser hears more. `sent` is the last
   * thing already handed on, while the mic stays open for more.
   */
  | { kind: 'listening'; heard: string; sent: string | null }
  | { kind: 'problem'; message: string };

/**
 * How it hands on what was said:
 * - `send`: every phrase as soon as it's heard, a guess at a time, while the mic stays open.
 * - `fill`: everything said, once, when listening ends (chat, to check before sending).
 */
export type VoiceUse = 'send' | 'fill';

/** How long a problem ("Didn't catch that") stays up before the bar goes back to normal. */
const PROBLEM_MS = 3500;

/**
 * Words that haven't changed for this long are taken as said. The recogniser's own end of
 * speech waits about a second of silence and then a network round trip; in a race that's too
 * long. Shorter than this and a pause between two words splits the phrase.
 */
export const SETTLE_MS = 400;

type Session = { rec: Recognition; flush: () => void };

/**
 * Listening for one player. `start` opens the mic: in `send` use it stays open until `stop`
 * (each phrase goes out as it settles), in `fill` use it also ends when the speaker pauses.
 * `stop` hands on what was heard so far at once; `cancel` drops it. Listening is cancelled when
 * `scope` changes (the turn ends, you solve the word) and when the bar unmounts.
 */
export function useVoice({
  lang,
  scope,
  use,
  onHeard,
}: {
  lang: string;
  scope: string;
  use: VoiceUse;
  onHeard: (text: string) => void;
}) {
  const [state, setState] = useState<VoiceState>({ kind: 'idle' });
  const session = useRef<Session | null>(null);
  const onHeardRef = useRef(onHeard);
  useLayoutEffect(() => {
    onHeardRef.current = onHeard;
  });

  useEffect(() => () => session.current?.rec.abort(), [scope]);

  useEffect(() => {
    if (state.kind !== 'problem') return;
    const timer = setTimeout(() => setState({ kind: 'idle' }), PROBLEM_MS);
    return () => clearTimeout(timer);
  }, [state]);

  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor || session.current) return;
    const rec = new Constructor();
    rec.lang = lang;
    rec.continuous = use === 'send';
    rec.interimResults = true;
    // Only the recogniser's best guess: trying its alternatives too would give voice players
    // several guesses for each typed one.
    rec.maxAlternatives = 1;
    let cancelled = false;
    let problem: string | null = null;
    let lastSent: string | null = null;
    /** `send`: what was last handed on for each of the recogniser's results, by index. */
    const sentFor = new Map<number, string>();
    /** `send`: the words still changing, and when they'll be taken as said. */
    let pending: { index: number; text: string } | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    /** `fill`: everything heard, final and not. */
    let everything = '';

    function hand(index: number, text: string) {
      if (!text || sameWords(sentFor.get(index) ?? '', text)) return;
      sentFor.set(index, text);
      lastSent = text;
      onHeardRef.current(text);
    }
    function flush() {
      clearTimeout(settle);
      if (pending) hand(pending.index, pending.text);
      pending = null;
      if (session.current?.rec === rec) setState({ kind: 'listening', heard: '', sent: lastSent });
    }

    rec.onresult = (event) => {
      if (use === 'fill') {
        everything = Array.from(event.results, (r) => r[0]?.transcript ?? '')
          .join('')
          .trim();
        setState({ kind: 'listening', heard: everything, sent: null });
        return;
      }
      let interim: { index: number; text: string } | null = null;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript.trim() ?? '';
        if (!result || !text) continue;
        if (result.isFinal) {
          if (pending?.index === i) pending = null;
          hand(i, text);
        } else if (interim) {
          interim.text = `${interim.text} ${text}`;
        } else {
          interim = { index: i, text };
        }
      }
      clearTimeout(settle);
      pending =
        interim && !sameWords(sentFor.get(interim.index) ?? '', interim.text) ? interim : null;
      if (pending) settle = setTimeout(flush, SETTLE_MS);
      setState({ kind: 'listening', heard: pending?.text ?? '', sent: lastSent });
    };
    rec.onerror = (event) => {
      if (event.error === 'aborted') cancelled = true;
      // An open mic that hears nothing for a while just closes; that's not worth a message.
      if (event.error === 'no-speech' && lastSent) return;
      problem = speechErrorMessage(event.error);
    };
    rec.onend = () => {
      clearTimeout(settle);
      if (!cancelled && !problem) {
        if (use === 'fill' && everything) onHeardRef.current(everything);
        else if (pending) hand(pending.index, pending.text);
      }
      if (session.current?.rec === rec) session.current = null;
      setState(problem ? { kind: 'problem', message: problem } : { kind: 'idle' });
    };

    session.current = { rec, flush };
    setState({ kind: 'listening', heard: '', sent: null });
    try {
      rec.start();
    } catch {
      session.current = null;
      setState({ kind: 'problem', message: VOICE_UNAVAILABLE });
    }
  }

  return {
    state,
    start,
    /**
     * Stop listening. What's already heard goes out at once; the recogniser still finishes the
     * last syllables, and if they change the words those go out too.
     */
    stop: () => {
      const current = session.current;
      if (!current) return;
      if (use === 'send') current.flush();
      current.rec.stop();
    },
    /** Stop listening and throw away what was heard. */
    cancel: () => session.current?.rec.abort(),
  };
}
