import type { Cue, CueKind } from '../scenery';
import { playClip, playVoice, type PlayOptions } from './sound-engine';

/** The fewest ms between two of the same village sound, so a burst doesn't turn into a buzz. */
const MIN_GAP: Record<CueKind, number> = {
  thump: 40,
  yelp: 90,
  squish: 60,
  squeak: 90,
  pop: 60,
  whack: 70,
};
const last = new Map<CueKind, number>();

/**
 * Plays a village's sound (`village.ts`): a fallen piece's thump (with a woody thud under the big
 * ones), the mallet's whacks, and the villagers' yelps, squish, squeaks and pop.
 */
export function playVillageCue(cue: Cue, options: PlayOptions = {}): void {
  const now = performance.now();
  if (now - (last.get(cue.kind) ?? -Infinity) < MIN_GAP[cue.kind]) return;
  last.set(cue.kind, now);
  const volume = options.volume ?? 1;
  switch (cue.kind) {
    case 'thump':
      playClip('thump', cue.pitch, { ...options, volume: volume * 0.9 });
      if (cue.pitch < 1) playClip('thud', cue.pitch * 0.9, { ...options, volume: volume * 0.5 });
      return;
    case 'whack':
      playClip('whack', cue.pitch, { ...options, volume: volume * 0.55 });
      return;
    case 'yelp':
      playVoice('yelp', cue.pitch, { ...options, volume: volume * 0.55 });
      return;
    case 'squish':
      playVoice('squish', cue.pitch, options);
      return;
    case 'squeak':
      playVoice('squeak', cue.pitch, { ...options, volume: volume * 0.6 });
      return;
    case 'pop':
      playVoice('pop', cue.pitch, { ...options, volume: volume * 0.8 });
      return;
  }
}
