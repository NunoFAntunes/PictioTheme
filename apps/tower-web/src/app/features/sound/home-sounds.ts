import { noiseBuffer, output, tone } from './sound-engine';

/**
 * The home page's toys (docs/tower/design/visual-identity.md#home-sounds): a balloon popping, a
 * new one blowing up, and the menu's balloons lifting off. Synthesised, like the villagers.
 */
export type HomeCue = 'balloon-pop' | 'inflate' | 'lift-off';

export function playHomeCue(cue: HomeCue, pan = 0): void {
  const o = output(cue === 'inflate' ? 0.35 : 0.8, pan);
  if (!o) return;
  const { ctx, out } = o;
  const now = ctx.currentTime;
  switch (cue) {
    case 'balloon-pop': {
      // A sharp crack of bright noise over a short low thump.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.9, now);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      src.connect(filter).connect(env).connect(out);
      src.start(now);
      src.stop(now + 0.1);
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 190],
          [0.08, 55],
        ],
        0.5,
        0.1,
      );
      return;
    }
    case 'inflate':
      // A rubbery squeak, rising as it fills.
      tone(
        ctx,
        out,
        'triangle',
        [
          [0, 260],
          [0.3, 520],
          [0.42, 700],
        ],
        0.25,
        0.45,
      );
      return;
    case 'lift-off':
      // "Wheee": a slide up, with a little sparkle on top.
      tone(
        ctx,
        out,
        'triangle',
        [
          [0, 380],
          [0.55, 1180],
        ],
        0.28,
        0.65,
      );
      tone(
        ctx,
        out,
        'sine',
        [
          [0, 1520],
          [0.4, 2400],
        ],
        0.06,
        0.5,
        now + 0.18,
      );
      return;
  }
}
