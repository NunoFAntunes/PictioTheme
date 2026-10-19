import { DEFAULT_ROOM_SETTINGS } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { GAME_STYLES, gameStyleOf, gameStyleSettings } from './game-styles';

describe('gameStyleOf', () => {
  it('recognises the default settings as the Easy game', () => {
    expect(gameStyleOf(DEFAULT_ROOM_SETTINGS)).toBe('easy');
  });

  it('round-trips every style', () => {
    for (const style of GAME_STYLES) {
      expect(gameStyleOf({ ...DEFAULT_ROOM_SETTINGS, ...gameStyleSettings(style) })).toBe(style.id);
    }
  });

  it('is Chaos mode whatever the difficulties', () => {
    const chaos = GAME_STYLES.find((s) => s.id === 'chaos');
    if (!chaos) throw new Error();
    const settings = { ...DEFAULT_ROOM_SETTINGS, ...gameStyleSettings(chaos) };
    expect(gameStyleOf({ ...settings, difficulties: ['hard'] })).toBe('chaos');
  });

  it('is null once one rule is changed by hand', () => {
    expect(gameStyleOf({ ...DEFAULT_ROOM_SETTINGS, rush: true })).toBeNull();
    expect(gameStyleOf({ ...DEFAULT_ROOM_SETTINGS, wordChoice: 1 })).toBeNull();
    expect(gameStyleOf({ ...DEFAULT_ROOM_SETTINGS, rounds: 4 })).toBeNull();
  });
});
