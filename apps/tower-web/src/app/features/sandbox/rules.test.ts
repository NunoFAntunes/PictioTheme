import { describe, expect, it } from 'vitest';
import { DEFAULT_DAZE, fumble, isDazed, topOut } from './rules';

describe('fumble', () => {
  it('dazes for 5s', () => {
    const daze = fumble(null, 1000);
    expect(daze).toEqual({ since: 1000, until: 6000 });
    expect(isDazed(daze, 5999)).toBe(true);
    expect(isDazed(daze, 6000)).toBe(false);
  });

  it('adds 2s per extra fumble during a daze, up to 10s in all', () => {
    let daze = fumble(null, 0);
    daze = fumble(daze, 1000);
    expect(daze?.until).toBe(7000);
    daze = fumble(daze, 2000);
    daze = fumble(daze, 2500);
    expect(daze?.until).toBe(10_000);
    daze = fumble(daze, 3000);
    expect(daze?.until).toBe(10_000);
  });

  it('starts a fresh daze after the last one ended', () => {
    const daze = fumble(fumble(null, 0), 8000);
    expect(daze).toEqual({ since: 8000, until: 13_000 });
  });

  it('does nothing when dazes are off', () => {
    expect(fumble(null, 0, { ...DEFAULT_DAZE, firstMs: 0 })).toBeNull();
  });
});

describe('topOut', () => {
  it('counts down 3s above the line, and resets when the tower drops below it', () => {
    let state = topOut(null, 18.2, 18, 1000);
    expect(state).toEqual({ since: 1000, done: false, progress: 0 });
    state = topOut(state.since, 18.1, 18, 2500);
    expect(state.progress).toBeCloseTo(0.5);
    expect(topOut(state.since, 17.9, 18, 3000)).toEqual({
      since: null,
      done: false,
      progress: null,
    });
    expect(topOut(state.since, 18.1, 18, 4000).done).toBe(true);
  });
});
