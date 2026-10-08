import { DECK_LANGUAGES, type DeckLanguage } from '@pictiotheme/protocol';

/**
 * Saying a guess out loud with the browser's own speech recognition (the Web Speech API): free,
 * nothing to download, in Chrome, Edge and Safari but not Firefox, which gets no mic button.
 * Chrome sends the audio to Google to transcribe it. The words come back as text and go through
 * the same `guess` message as typed ones, so the server can't tell them apart (rule W7).
 */

/**
 * The locale to listen for in a room's language: the language with the country of its flag
 * (en → en-GB, es-419 → es-MX, zh-Hant → zh-TW), the regional codes recognisers know best.
 */
export function speechLang(language: DeckLanguage): string {
  const base = language.split('-')[0] ?? language;
  const info = DECK_LANGUAGES.find((l) => l.code === language);
  return info ? `${base}-${info.flag}` : base;
}

/** The part of SpeechRecognition used here (TypeScript's DOM types have only its events). */
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

/** This browser's recogniser, prefixed in Chrome and Safari; undefined where there's none. */
export function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const VOICE_UNAVAILABLE = 'Voice guessing isn’t working right now. Type instead.';

/** What to tell the player when listening fails; null when there's nothing to say. */
export function speechErrorMessage(error: SpeechRecognitionErrorCode): string | null {
  switch (error) {
    case 'aborted':
      return null;
    case 'no-speech':
      return 'Didn’t catch that. Try again?';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone is blocked. Allow it from the address bar.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'network':
      return 'Voice guessing needs an internet connection.';
    case 'language-not-supported':
      return 'Voice guessing doesn’t work in this language here. Type instead.';
    default:
      return VOICE_UNAVAILABLE;
  }
}

/**
 * Whether two transcripts say the same words, ignoring case and punctuation: the recogniser
 * often settles on "Cactus." for what it first heard as "cactus", which needn't go out twice.
 */
export function sameWords(a: string, b: string): boolean {
  const words = (text: string) =>
    text
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return words(a) === words(b);
}
