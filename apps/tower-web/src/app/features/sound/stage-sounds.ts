import { noiseBuffer, output, tone, type PlayOptions } from './sound-engine';

/**
 * The crews' avatars moving about (docs/tower/design/screens.md#the-crews-on-stage), synthesised
 * like the villagers' voices: a springy whoop as one takes off, a plop as it lands (a soft puff
 * on a cloud), and a knock with a twinkle of stars when two bonk in the air. For the powers they
 * act out: a sparkly burst where a thrown spell or curse lands (or a spell reaches its slot), and
 * a quick swish for a thief's dash.
 */
export type StageCueKind = 'hop' | 'land' | 'land-soft' | 'bonk' | 'burst' | 'swish';

/** The fewest ms between two of the same sound, so a crowd swapping places doesn't buzz. */
const MIN_GAP: Record<StageCueKind, number> = {
  hop: 55,
  land: 55,
  'land-soft': 80,
  bonk: 150,
  burst: 120,
  swish: 120,
};
const last = new Map<StageCueKind, number>();

/** `pitch` is the avatar's own (about 0.85–1.25). */
export function playStageCue(kind: StageCueKind, pitch = 1, options: PlayOptions = {}): void {
  const now = performance.now();
  if (now - (last.get(kind) ?? -Infinity) < MIN_GAP[kind]) return;
  last.set(kind, now);
  const o = output(options.volume ?? 1, options.pan ?? 0);
  if (!o) return;
  const { ctx, out } = o;
  const p = pitch;
  switch (kind) {
    case 'hop':
      // "Whoop!": a quick rising glide.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 280 * p],
          [0.13, 760 * p],
        ],
        0.16,
        0.16,
      );
      return;
    case 'land':
      // "Plop": a little drop in pitch.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 520 * p],
          [0.08, 170 * p],
        ],
        0.24,
        0.11,
      );
      return;
    case 'land-soft': {
      // "Fwump" into a cloud: a puff of low noise.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900 * p, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      src.connect(filter).connect(env).connect(out);
      src.start();
      src.stop(ctx.currentTime + 0.3);
      return;
    }
    case 'bonk':
      // A hollow knock, then stars twinkling round their heads.
      tone(
        ctx,
        out,
        'triangle',
        [
          [0, 760 * p],
          [0.07, 430 * p],
        ],
        0.32,
        0.12,
      );
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 190],
          [0.12, 120],
        ],
        0.3,
        0.16,
      );
      for (let i = 0; i < 3; i++) {
        tone(
          ctx,
          out,
          'sine',
          [
            [0, 1900 + i * 350],
            [0.05, 2300 + i * 350],
          ],
          0.05,
          0.09,
          ctx.currentTime + 0.1 + i * 0.07,
        );
      }
      return;
    case 'burst':
      // "Pff-ting!": a soft pop opening into a little shimmer.
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 240 * p],
          [0.08, 820 * p],
        ],
        0.22,
        0.12,
      );
      for (let i = 0; i < 4; i++) {
        tone(
          ctx,
          out,
          'triangle',
          [[0, 1600 + i * 420]],
          0.045,
          0.14,
          ctx.currentTime + 0.05 + i * 0.045,
        );
      }
      return;
    case 'swish': {
      // A quick high whoosh, like running past.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.8;
      filter.frequency.setValueAtTime(2600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.2);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      src.connect(filter).connect(env).connect(out);
      src.start();
      src.stop(ctx.currentTime + 0.25);
      return;
    }
  }
}
