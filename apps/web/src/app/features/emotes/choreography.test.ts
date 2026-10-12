import { Emote, SOLO_EMOTES, TARGETED_EMOTES } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { choreograph, standingSide, type Box, type Motion } from './choreography';

// Two characters in the margin column: Ana on top, Bo below.
const ana: Box = { x: 20, y: 100, w: 120, h: 120 };
const bo: Box = { x: 20, y: 300, w: 120, h: 120 };
const VIEWPORT = 1600;

/** The translate of a keyframe's transform, in px. */
function translate(frame: Keyframe | undefined): [number, number] {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(String(frame?.transform));
  if (!match) throw new Error(`no translate in ${String(frame?.transform)}`);
  return [Number(match[1]), Number(match[2])];
}

function offsets(motion: Motion): number[] {
  return motion.frames.map((f) => f.offset ?? NaN);
}

describe('emote choreography', () => {
  it('has well-formed keyframes for every emote', () => {
    for (const emote of Emote.options) {
      const c = choreograph(emote, ana, bo, VIEWPORT);
      if (!c) throw new Error(emote);
      for (const motion of [c.actor, c.target, ...c.sprites]) {
        if (!motion) continue;
        const list = offsets(motion);
        expect(list[0]).toBe(0);
        expect(list.at(-1)).toBe(1);
        expect([...list].sort((a, b) => a - b)).toEqual(list);
        expect(motion.durationMs).toBeGreaterThan(0);
      }
    }
  });

  it('keeps solo emotes on your own character', () => {
    for (const emote of SOLO_EMOTES) {
      const c = choreograph(emote, ana, null, VIEWPORT);
      expect(c?.actor).not.toBeNull();
      expect(c?.target).toBeNull();
      expect(c?.sprites.some((s) => s.kind === 'clone')).toBe(false);
    }
  });

  it('does nothing visible for a targeted emote when the target is off screen', () => {
    for (const emote of TARGETED_EMOTES) expect(choreograph(emote, ana, null, VIEWPORT)).toBeNull();
  });

  it('lands the squish on the target, then flies the clone home', () => {
    const c = choreograph('squish', ana, bo, VIEWPORT);
    const clone = c?.sprites.find((s) => s.kind === 'clone');
    if (!c || !clone) throw new Error('no clone');
    expect(translate(clone.frames[0])).toEqual([0, 0]);
    expect(translate(clone.frames.at(-1))).toEqual([0, 0]);

    // At the impact, its feet are on the target's flattened head.
    const impact = clone.frames.find((f) => f.offset === c.impactMs / clone.durationMs);
    const [dx, dy] = translate(impact);
    expect(dx).toBe(0); // same column
    expect(ana.y + ana.h + dy).toBeCloseTo(bo.y + bo.h * 0.68, 0);
    // The target flattens right then, and the real Ana hides while her clone is out.
    expect(c.target?.delayMs).toBe(c.impactMs);
    expect(c.actor?.durationMs).toBe(clone.durationMs);
  });

  it('slaps from the board side, unless the target is at the right edge', () => {
    expect(standingSide(bo, VIEWPORT)).toBe(1);
    expect(standingSide({ ...bo, x: VIEWPORT - 150 }, VIEWPORT)).toBe(-1);
    const c = choreograph('slap', ana, bo, VIEWPORT);
    const clone = c?.sprites.find((s) => s.kind === 'clone');
    const [dx] = translate(clone?.frames.find((f) => f.offset === 0.3));
    expect(dx).toBeGreaterThan(0);
  });

  it('throws the tomato from the actor so it hits as the target flinches', () => {
    const c = choreograph('tomato', ana, bo, VIEWPORT);
    const tomato = c?.sprites.find((s) => s.doodle === 'tomato');
    if (!c || !tomato) throw new Error('no tomato');
    expect(tomato.delayMs + tomato.durationMs).toBe(c.impactMs);
    expect(c.target?.delayMs).toBe(c.impactMs);
    // Ana stays put: she throws from where she stands.
    expect(c.sprites.some((s) => s.kind === 'clone')).toBe(false);
  });
});
