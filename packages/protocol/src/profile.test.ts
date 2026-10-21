import { describe, expect, it } from 'vitest';
import { nameAfter } from './profile';

const empty = { displayName: null, nameChosen: false };
const chosen = { displayName: 'Ana', nameChosen: true };

describe('nameAfter', () => {
  it('takes a chosen name, and a made-up one only over no name or another made-up one', () => {
    const auto = nameAfter(empty, { displayName: 'Wobbly Penguin', nameChosen: false });
    expect(auto).toEqual({ displayName: 'Wobbly Penguin', nameChosen: false });
    expect(nameAfter(auto, { displayName: 'Sneaky Otter', nameChosen: false })).toEqual({
      displayName: 'Sneaky Otter',
      nameChosen: false,
    });
    expect(nameAfter(auto, { displayName: 'Ana' })).toEqual(chosen);
    expect(nameAfter(chosen, { displayName: 'Silly', nameChosen: false })).toEqual(chosen);
  });

  it('leaves the name alone when the change has none', () => {
    expect(nameAfter(chosen, { drawing: null })).toBe(chosen);
  });
});
