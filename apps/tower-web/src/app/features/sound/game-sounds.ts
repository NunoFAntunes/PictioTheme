import { noiseBuffer, output, playClip, playVoice, tone } from './sound-engine';

/**
 * The match's sounds (docs/tower/design/visual-identity.md#game-sounds): little synthesised
 * jingles for the moments that matter to you, so they sit with the villagers' voices and under the
 * music. Picked by `roomCues` (room-cues.ts) from what changed in the room.
 */
export type GameCue =
  | 'join'
  | 'start'
  | 'draw-turn'
  | 'place-turn'
  | 'correct'
  | 'crew-solved'
  | 'close'
  | 'wrong'
  | 'stole'
  | 'robbed'
  | 'expired'
  | 'incoming'
  | 'placed'
  | 'fumble'
  | 'topping'
  | 'rival-topping'
  | 'tick'
  | 'tick-last'
  | 'win'
  | 'lose'
  | 'draw';

/** A note `semis` semitones above C5. */
const n = (semis: number) => 523.25 * 2 ** (semis / 12);

type Note = {
  /** Semitones above C5. */
  at: number;
  /** When it starts, in s. */
  t: number;
  /** How long it rings, in s. */
  len: number;
  type?: OscillatorType;
  peak?: number;
};

/** A run of notes, each with a quiet octave above to make it sparkle. */
function melody(notes: readonly Note[], volume = 1, sparkle = 0.18): void {
  const o = output(volume);
  if (!o) return;
  const { ctx, out } = o;
  const now = ctx.currentTime;
  for (const { at, t, len, type = 'triangle', peak = 0.3 } of notes) {
    tone(ctx, out, type, [[0, n(at)]], peak, len, now + t);
    if (sparkle > 0) tone(ctx, out, 'sine', [[0, n(at + 12)]], peak * sparkle, len * 0.7, now + t);
  }
}

/** A soft, muted brass-ish "wah": a sawtooth through a closing low-pass. */
function wah(notes: readonly (readonly [number, number, number])[], volume = 1): void {
  const o = output(volume);
  if (!o) return;
  const { ctx, out } = o;
  const now = ctx.currentTime;
  for (const [semis, t, len] of notes) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(400, now + t);
    filter.frequency.exponentialRampToValueAtTime(1600, now + t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(350, now + t + len);
    filter.connect(out);
    const osc = tone(ctx, filter, 'sawtooth', [[0, n(semis)]], 0.22, len, now + t);
    // The last note wobbles.
    if (t === notes[notes.length - 1]?.[1]) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const depth = ctx.createGain();
      depth.gain.value = 6;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(now + t);
      lfo.stop(now + t + len);
    }
  }
}

/** A burst of filtered noise sweeping from `from` to `to` Hz. */
function whoosh(from: number, to: number, len: number, volume: number): void {
  const o = output(volume);
  if (!o) return;
  const { ctx, out } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(from, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + len);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + len * 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len);
  src.connect(filter).connect(env).connect(out);
  src.start();
  src.stop(ctx.currentTime + len + 0.02);
}

/** A woodblock tick for the last seconds. */
function tick(freq: number, volume: number): void {
  const o = output(volume);
  if (!o) return;
  tone(
    o.ctx,
    o.out,
    'sine',
    [
      [0, freq],
      [0.05, freq * 0.8],
    ],
    0.35,
    0.07,
  );
  tone(o.ctx, o.out, 'square', [[0, freq * 2.5]], 0.03, 0.02);
}

export function playGameCue(cue: GameCue): void {
  switch (cue) {
    case 'join':
      playVoice('pop', 1.3, { volume: 0.5 });
      return;
    case 'start':
      // "Ready… go!"
      melody([
        { at: 0, t: 0, len: 0.12 },
        { at: 4, t: 0.12, len: 0.12 },
        { at: 7, t: 0.24, len: 0.12 },
        { at: 12, t: 0.38, len: 0.5, peak: 0.34 },
      ]);
      return;
    case 'draw-turn':
      // "Ta-da!": your turn to draw.
      melody([
        { at: 7, t: 0, len: 0.12 },
        { at: 12, t: 0.12, len: 0.45 },
      ]);
      return;
    case 'place-turn':
      melody(
        [
          { at: 16, t: 0, len: 0.08, type: 'sine' },
          { at: 21, t: 0.09, len: 0.18, type: 'sine' },
        ],
        0.8,
      );
      return;
    case 'correct':
    case 'crew-solved':
      // A bright "ding-ding!", softer when it was a crewmate.
      melody(
        [
          { at: 11, t: 0, len: 0.16, type: 'sine', peak: 0.32 },
          { at: 16, t: 0.1, len: 0.6, type: 'sine', peak: 0.32 },
        ],
        cue === 'correct' ? 1 : 0.6,
        0.35,
      );
      return;
    case 'close': {
      // "Hm?": a little rising wobble.
      const o = output(0.7);
      if (o)
        tone(
          o.ctx,
          o.out,
          'triangle',
          [
            [0, 620],
            [0.08, 760],
            [0.18, 700],
          ],
          0.22,
          0.22,
        );
      return;
    }
    case 'wrong': {
      // A soft "bonk", quiet: wrong guesses are most guesses.
      const o = output(0.4);
      if (o)
        tone(
          o.ctx,
          o.out,
          'sine',
          [
            [0, 320],
            [0.1, 200],
          ],
          0.3,
          0.13,
        );
      return;
    }
    case 'stole':
      // A sneaky run up and a "ting".
      melody(
        [0, 2, 4, 7, 9]
          .map((at, i) => ({ at, t: i * 0.05, len: 0.07, peak: 0.22 }))
          .concat({
            at: 16,
            t: 0.28,
            len: 0.5,
            peak: 0.3,
          }),
      );
      return;
    case 'robbed':
      wah(
        [
          [-5, 0, 0.22],
          [-6, 0.24, 0.22],
          [-7, 0.48, 0.55],
        ],
        0.8,
      );
      return;
    case 'expired': {
      // A dull "bwomp".
      const o = output(0.6);
      if (o)
        tone(
          o.ctx,
          o.out,
          'sine',
          [
            [0, 200],
            [0.35, 90],
          ],
          0.4,
          0.4,
        );
      return;
    }
    case 'incoming': {
      // A piece sent your way: a falling bomb whistle.
      const o = output(0.6);
      if (o)
        tone(
          o.ctx,
          o.out,
          'sine',
          [
            [0, 2100],
            [0.9, 600],
          ],
          0.16,
          0.95,
        );
      return;
    }
    case 'placed':
      playClip('thud', 1.15, { volume: 0.45 });
      return;
    case 'fumble':
      // A whoosh and a "wah-wah".
      whoosh(2500, 300, 0.45, 0.5);
      wah(
        [
          [-3, 0.25, 0.22],
          [-8, 0.5, 0.6],
        ],
        0.8,
      );
      return;
    case 'topping':
      // Your tower is over the line: a rising shimmer.
      melody(
        [0, 4, 7, 12, 16, 19, 24].map((at, i) => ({
          at,
          t: i * 0.06,
          len: i === 6 ? 0.7 : 0.12,
          type: 'sine' as const,
          peak: 0.22,
        })),
        0.9,
        0.3,
      );
      return;
    case 'rival-topping':
      // Theirs is: an alarm, twice.
      melody(
        [0, 0.3].flatMap((t) => [
          { at: 9, t, len: 0.13, type: 'square' as const, peak: 0.08 },
          { at: 4, t: t + 0.14, len: 0.13, type: 'square' as const, peak: 0.08 },
        ]),
        1,
        0,
      );
      return;
    case 'tick':
      tick(1100, 0.6);
      return;
    case 'tick-last':
      tick(1500, 0.8);
      return;
    case 'win':
      // A fanfare, then the chord rings.
      melody([
        { at: 0, t: 0, len: 0.14 },
        { at: 4, t: 0.14, len: 0.14 },
        { at: 7, t: 0.28, len: 0.14 },
        { at: 12, t: 0.42, len: 0.28 },
        { at: 7, t: 0.72, len: 0.12 },
        ...[0, 4, 7, 12].map((at) => ({ at, t: 0.86, len: 1.2, peak: 0.2 })),
      ]);
      return;
    case 'lose':
      wah(
        [
          [-5, 0, 0.3],
          [-6, 0.32, 0.3],
          [-7, 0.64, 0.3],
          [-8, 0.96, 0.9],
        ],
        0.8,
      );
      return;
    case 'draw':
      melody([
        { at: 0, t: 0, len: 0.18 },
        { at: -5, t: 0.2, len: 0.18 },
        { at: 0, t: 0.4, len: 0.5 },
      ]);
      return;
  }
}
