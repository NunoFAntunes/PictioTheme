import { useSoundSettings } from './sound-settings';

/**
 * Plays Doodle Tower's sounds with the Web Audio API (docs/tower/design/visual-identity.md#sound).
 * Plain TypeScript, no React. Three kinds: the music (a looping theme), clips (short files in
 * `public/sounds/`) and voices and jingles synthesised on the spot (the villagers' yelps, squeaks
 * and pops follow each villager's pitch).
 *
 * Browsers only allow audio after the player interacts with the page, so the AudioContext starts
 * on the first pointer or key press and the files are fetched then. Sounds asked for before that
 * are dropped (they'd be stale). Everything goes through a master gain (the mute), with a bus each
 * for the music and the effects (their volumes). A hidden tab goes quiet.
 */

const CLIPS = {
  thump: ['thump-0', 'thump-1', 'thump-2'],
  thud: ['thud-wood'],
  whack: ['whack-0', 'whack-1', 'whack-2'],
} as const;
export type ClipId = keyof typeof CLIPS;

/** The main theme: OwlishMedia's "Happy Clappy Loop" (CC0), 17.44 s, loops seamlessly. */
const THEME = 'music/happy-clappy-loop';
/** The music's loudness at full volume, under the effects. */
const MUSIC_LEVEL = 0.45;

type Buses = { master: GainNode; music: GainNode; effects: GainNode };

let context: AudioContext | null = null;
let buses: Buses | null = null;
let noise: AudioBuffer | null = null;
const buffers = new Map<string, AudioBuffer>();

function load(ctx: AudioContext, file: string): Promise<AudioBuffer> {
  return fetch(`/sounds/${file}.mp3`)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
    .then((data) => ctx.decodeAudioData(data));
}

/** Volumes feel even when the gain goes with the square of the slider. */
function applySettings(): void {
  if (!context || !buses) return;
  const { muted, music, effects } = useSoundSettings.getState();
  const t = context.currentTime;
  buses.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.04);
  buses.music.gain.setTargetAtTime(music * music * MUSIC_LEVEL, t, 0.04);
  buses.effects.gain.setTargetAtTime(effects * effects, t, 0.04);
}

function startMusic(ctx: AudioContext, music: GainNode): void {
  load(ctx, THEME)
    .then((buffer) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      // Fades in, so it doesn't jump out at the first click.
      const fade = ctx.createGain();
      fade.gain.setValueAtTime(0.0001, ctx.currentTime);
      fade.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5);
      source.connect(fade).connect(music);
      source.start();
    })
    .catch(() => {}); // no music: the game still plays
}

function unlock(): void {
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      return; // no Web Audio: the game stays silent
    }
    const ctx = context;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const music = ctx.createGain();
    const effects = ctx.createGain();
    music.connect(master);
    effects.connect(master);
    buses = { master, music, effects };
    applySettings();
    useSoundSettings.subscribe(applySettings);
    for (const files of Object.values(CLIPS)) {
      for (const file of files) {
        load(ctx, file)
          .then((buffer) => buffers.set(file, buffer))
          .catch(() => {}); // a missing clip just stays silent
      }
    }
    startMusic(ctx, music);
  }
  if (context.state === 'suspended' && document.visibilityState === 'visible')
    void context.resume();
}

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown'] as const)
    window.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.visibilityState === 'hidden') void context.suspend();
    else void context.resume();
  });
}

export type PlayOptions = {
  /** Loudness, 0–1. */
  volume?: number;
  /** −1 (left) to 1 (right). */
  pan?: number;
};

/** A gain and panner into the effects bus, or null when there's no sound to make. */
export function output(volume: number, pan = 0): { ctx: AudioContext; out: GainNode } | null {
  const ctx = context;
  const { muted, effects } = useSoundSettings.getState();
  if (!ctx || !buses || ctx.state !== 'running' || muted || effects <= 0 || volume <= 0)
    return null;
  const out = ctx.createGain();
  out.gain.value = volume;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  out.connect(panner).connect(buses.effects);
  return { ctx, out };
}

/** Plays one of a clip's files, picked at random, at `rate` (speed and pitch). */
export function playClip(id: ClipId, rate = 1, { volume = 1, pan = 0 }: PlayOptions = {}): void {
  const files = CLIPS[id];
  const buffer = buffers.get(files[Math.floor(Math.random() * files.length)] as string);
  if (!buffer) return; // still loading
  const o = output(volume, pan);
  if (!o) return;
  const source = o.ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(o.out);
  source.start();
}

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A tone gliding through `freqs` (Hz, at the given times in s) under an envelope. */
export function tone(
  ctx: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  freqs: readonly (readonly [number, number])[],
  peak: number,
  length: number,
  start = ctx.currentTime,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  const [first, ...rest] = freqs;
  osc.frequency.setValueAtTime(first?.[1] ?? 440, start);
  for (const [at, f] of rest) osc.frequency.exponentialRampToValueAtTime(f, start + at);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + length + 0.02);
  return osc;
}

export type Voice = 'yelp' | 'squish' | 'squeak' | 'pop';

/** A villager's voice, synthesised. `pitch` is theirs (about 0.8–1.3). */
export function playVoice(voice: Voice, pitch = 1, options: PlayOptions = {}): void {
  const o = output(options.volume ?? 1, options.pan ?? 0);
  if (!o) return;
  const { ctx, out } = o;
  const p = pitch;
  switch (voice) {
    case 'yelp':
      // "Eep!": a quick rise and a little fall.
      tone(
        ctx,
        out,
        'triangle',
        [
          [0, 520 * p],
          [0.07, 1250 * p],
          [0.2, 900 * p],
        ],
        0.32,
        0.24,
      );
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 1040 * p],
          [0.07, 2500 * p],
          [0.2, 1800 * p],
        ],
        0.06,
        0.2,
      );
      return;
    case 'squish': {
      // A wet "splorf": a low bwomp sinking, with a squelch of filtered noise.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 260 * p],
          [0.3, 55],
        ],
        0.6,
        0.34,
      );
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2.5;
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.2);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.5, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      src.connect(filter).connect(env).connect(out);
      src.start();
      src.stop(ctx.currentTime + 0.25);
      // And a squeaky "eek" from underneath.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 1300 * p],
          [0.08, 1900 * p],
        ],
        0.1,
        0.12,
        ctx.currentTime + 0.12,
      );
      return;
    }
    case 'squeak':
      // A flattened footstep, like a rubber toy.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 1500 * p],
          [0.04, 2100 * p],
          [0.09, 1650 * p],
        ],
        0.12,
        0.1,
      );
      return;
    case 'pop': {
      // Back into shape: a rising bloop and a wobbly boing.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 220 * p],
          [0.12, 900 * p],
        ],
        0.4,
        0.2,
      );
      const boing = tone(ctx, out, 'triangle', [[0, 330 * p]], 0.16, 0.45, ctx.currentTime + 0.05);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 16;
      const depth = ctx.createGain();
      depth.gain.value = 50 * p;
      lfo.connect(depth).connect(boing.frequency);
      lfo.start();
      lfo.stop(ctx.currentTime + 0.55);
      return;
    }
  }
}
