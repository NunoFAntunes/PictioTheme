import { HOME_MUSIC, soundUrl } from './sound-catalog';
import { groupGain, useSoundSettings } from './sound-settings';

/**
 * The home page's background tune. A plain looping <audio> element, which streams instead of
 * decoding two minutes of audio up front. Browsers only allow it after the player interacts with
 * the page, so it starts on the first pointer or key press. Follows the sound settings live.
 * Returns a function that stops it all.
 */

/** The tune sits under the effects: this is its loudness at 100% in the settings. */
const LEVEL = 0.35;

export function startHomeMusic(): () => void {
  const audio = new Audio();
  const source = HOME_MUSIC.find((s) => audio.canPlayType(s.type) !== '') ?? HOME_MUSIC[1];
  audio.src = soundUrl(source.file);
  audio.loop = true;
  audio.preload = 'auto';

  let armed = false; // the player has interacted, so playing is allowed
  let hidden = document.hidden;

  const apply = () => {
    const gain = groupGain(useSoundSettings.getState(), 'music') * LEVEL;
    audio.volume = Math.min(1, gain);
    if (armed && gain > 0 && !hidden) void audio.play().catch(() => undefined);
    else audio.pause();
  };

  const arm = () => {
    armed = true;
    apply();
  };
  const onVisibility = () => {
    hidden = document.hidden;
    apply();
  };

  const events = ['pointerdown', 'keydown'] as const;
  for (const type of events) window.addEventListener(type, arm, { once: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribe = useSoundSettings.subscribe(apply);
  apply();

  return () => {
    for (const type of events) window.removeEventListener(type, arm);
    document.removeEventListener('visibilitychange', onVisibility);
    unsubscribe();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
