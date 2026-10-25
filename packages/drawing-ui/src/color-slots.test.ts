import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOTS, parseColorSlots } from './color-slots';

describe('parseColorSlots', () => {
  it('keeps stored colours and fills the rest with defaults', () => {
    expect(parseColorSlots(['#ABCDEF', '#123456'])).toEqual([
      '#abcdef',
      '#123456',
      ...DEFAULT_SLOTS.slice(2),
    ]);
  });

  it('replaces malformed entries, and ignores anything that is not a list', () => {
    const slots = parseColorSlots(['red', 42, '#12345', '#00ff00', null, '#ffffff']);
    expect(slots).toEqual([...DEFAULT_SLOTS.slice(0, 3), '#00ff00', DEFAULT_SLOTS[4]]);
    expect(parseColorSlots({ 0: '#000000' })).toEqual(DEFAULT_SLOTS);
    expect(parseColorSlots(null)).toEqual(DEFAULT_SLOTS);
  });
});
