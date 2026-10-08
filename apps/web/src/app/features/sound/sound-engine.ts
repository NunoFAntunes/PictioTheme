import { SOUNDS, soundUrl, type SoundId } from './sound-catalog';
import { groupGain, useSoundSettings } from './sound-settings';

/**
 * Plays the game's sounds with the Web Audio API. Plain TypeScript, no React.
 *
 * Browsers only allow audio after the player interacts with the page, so the AudioContext is
 * created on the first pointer or key press, and every clip is fetched and decoded then (~140 KB).
 * Sounds asked for before that are dropped: they would be stale by the time audio is allowed.
 */

let context: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<SoundId, number>();

function load(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  let pending = loading.get(file);
  if (!pending) {
    pending = fetch(soundUrl(file))
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(file, buffer);
        return buffer;
      })
      .catch(() => null); // a missing clip just stays silent
    loading.set(file, pending);
  }
  return pending;
}

function unlock(): void {
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      return; // no Web Audio: the game stays silent
    }
    const ctx = context;
    for (const def of Object.values(SOUNDS)) for (const file of def.files) void load(ctx, file);
  }
  if (context.state === 'suspended') void context.resume();
}

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

export type PlayOptions = {
  /** Playback speed; also shifts the pitch (alternating tick/tock). */
  rate?: number;
  /** Extra loudness factor, 0–1. */
  volume?: number;
};

/** Plays a sound once. Returns a function that cuts it off (a skipped drumroll), if it played. */
export function playSound(
  id: SoundId,
  { rate = 1, volume = 1 }: PlayOptions = {},
): (() => void) | undefined {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  const def = SOUNDS[id];
  const gain = groupGain(useSoundSettings.getState(), def.group) * def.volume * volume;
  if (gain <= 0) return;

  const now = performance.now();
  const minGap = 'minGapMs' in def ? def.minGapMs : 0;
  if (now - (lastPlayed.get(id) ?? -Infinity) < minGap) return;
  lastPlayed.set(id, now);

  const file = def.files[Math.floor(Math.random() * def.files.length)];
  const buffer = file ? buffers.get(file) : undefined;
  if (!buffer) return; // still loading

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gainNode = ctx.createGain();
  gainNode.gain.value = gain;
  source.connect(gainNode).connect(ctx.destination);
  source.start();
  return () => {
    gainNode.gain.setTargetAtTime(0, ctx.currentTime, FADE_S);
    try {
      source.stop(ctx.currentTime + FADE_S * 8);
    } catch {
      // already stopped
    }
  };
}

/** A sound that loops while something goes on (the pencil), with its level steered live. */
export type LoopVoice = {
  /** level 0–1 on top of the sound's own volume and its group's; rate shifts speed and pitch. */
  set(level: number, rate?: number): void;
  /** Fades out, then frees the voice. */
  stop(): void;
};

const FADE_S = 0.04;

export function startLoop(id: SoundId): LoopVoice | null {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return null;
  const def = SOUNDS[id];
  const file = def.files[0];
  const buffer = file ? buffers.get(file) : undefined;
  if (!buffer) return null;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  source.connect(gainNode).connect(ctx.destination);
  // Start somewhere in the loop so every stroke doesn't begin with the same scratch.
  source.start(0, Math.random() * buffer.duration);
  let stopped = false;

  return {
    set(level, rate = 1) {
      if (stopped) return;
      // Read the settings every time, so moving a slider applies to a stroke in progress.
      const gain = groupGain(useSoundSettings.getState(), def.group) * def.volume * level;
      gainNode.gain.setTargetAtTime(gain, ctx.currentTime, FADE_S);
      source.playbackRate.setTargetAtTime(rate, ctx.currentTime, FADE_S);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      gainNode.gain.setTargetAtTime(0, ctx.currentTime, FADE_S);
      source.stop(ctx.currentTime + FADE_S * 8);
    },
  };
}
