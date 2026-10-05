import { HOME_MUSIC, soundUrl } from './sound-catalog';
import { groupGain, useSoundSettings } from './sound-settings';

/**
 * The home page's background tune. A plain looping <audio> element, which streams instead of
 * decoding two minutes of audio up front. Browsers only allow it after the player interacts with
 * the page, so it starts on the first pointer or key press. Follows the sound settings live.
 *
 * It carries on into the waiting room and back: leaving a page while it plays leaves a note in
 * sessionStorage (where it was, and when), and the next page picks it up from there. Browsers
 * may refuse to start it there without a click on that page; then it waits for one, as on home.
 */

/** The tune sits under the effects: this is its loudness at 100% in the settings. */
const LEVEL = 0.35;
const CARRY_KEY = 'doodlewhirl:music';
/** A note older than this is from another visit, not the page just left. */
const CARRY_FRESH_MS = 30_000;
const FADE_OUT_MS = 800;

type Carry = { time: number; at: number };

function readCarry(): Carry | null {
  try {
    const carry = JSON.parse(sessionStorage.getItem(CARRY_KEY) ?? 'null') as Carry | null;
    if (carry && Date.now() - carry.at < CARRY_FRESH_MS) return carry;
  } catch {
    // No storage (private mode, blocked): the tune just starts from the top.
  }
  return null;
}

function writeCarry(carry: Carry | null) {
  try {
    if (carry) sessionStorage.setItem(CARRY_KEY, JSON.stringify(carry));
    else sessionStorage.removeItem(CARRY_KEY);
  } catch {
    // As above.
  }
}

/**
 * Starts the tune. `onlyIfCarried` (the waiting room): only when it was playing on the page just
 * left. Returns a function that fades it out and stops it all.
 */
export function startHomeMusic({ onlyIfCarried = false } = {}): () => void {
  const carry = readCarry();
  if (onlyIfCarried && !carry) return () => undefined;

  const audio = new Audio();
  const source = HOME_MUSIC.find((s) => audio.canPlayType(s.type) !== '') ?? HOME_MUSIC[1];
  audio.src = soundUrl(source.file);
  audio.loop = true;
  audio.preload = 'auto';
  if (carry) audio.currentTime = carry.time + (Date.now() - carry.at) / 1000;

  // The player has interacted, so playing is allowed. A carried tune tries right away.
  let armed = carry !== null;
  let hidden = document.hidden;
  let stopped = false;

  const apply = () => {
    if (stopped) return;
    const gain = groupGain(useSoundSettings.getState(), 'music') * LEVEL;
    audio.volume = Math.min(1, gain);
    if (armed && gain > 0 && !hidden) {
      // Refused (no click on this page yet): wait for one.
      audio.play().catch(() => {
        armed = false;
        listen();
      });
    } else audio.pause();
  };

  const arm = () => {
    armed = true;
    apply();
  };
  const onVisibility = () => {
    hidden = document.hidden;
    apply();
  };
  const onPageHide = () => {
    writeCarry(audio.paused ? null : { time: audio.currentTime, at: Date.now() });
  };

  const events = ['pointerdown', 'keydown'] as const;
  const listen = () => {
    for (const type of events) window.addEventListener(type, arm, { once: true, passive: true });
  };
  if (!armed) listen();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  const unsubscribe = useSoundSettings.subscribe(apply);
  apply();

  return () => {
    stopped = true;
    for (const type of events) window.removeEventListener(type, arm);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    unsubscribe();
    const from = audio.volume;
    const started = performance.now();
    const fade = () => {
      const t = Math.min(1, (performance.now() - started) / FADE_OUT_MS);
      audio.volume = from * (1 - t);
      if (t < 1 && !audio.paused) requestAnimationFrame(fade);
      else {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
    fade();
  };
}
