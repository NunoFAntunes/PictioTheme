import { describe, expect, it } from 'vitest';
import { accountKindOf, applyPatch, EMPTY_PROFILE, mergePatches } from './profile';

const named = { ...EMPTY_PROFILE, displayName: 'Ana', nameChosen: true };

describe('applyPatch', () => {
  it('sets a chosen name, and a made-up one only over another made-up one', () => {
    const auto = applyPatch(EMPTY_PROFILE, { displayName: 'Wobbly Penguin', nameChosen: false });
    expect(auto).toMatchObject({ displayName: 'Wobbly Penguin', nameChosen: false });
    expect(applyPatch(auto, { displayName: 'Ana' })).toMatchObject(named);
    expect(applyPatch(named, { displayName: 'Sneaky Otter', nameChosen: false })).toEqual(named);
  });

  it('sets and drops the drawing without touching the name', () => {
    const drawn = applyPatch(named, { drawing: 'data:image/png;base64,AA' });
    expect(drawn).toMatchObject({ displayName: 'Ana', drawing: 'data:image/png;base64,AA' });
    expect(applyPatch(drawn, { drawing: null }).drawing).toBeNull();
  });
});

describe('mergePatches', () => {
  it('lets later changes win, except a made-up name over a chosen one', () => {
    expect(mergePatches({ displayName: 'Ana' }, { displayName: 'Bea' })).toEqual({
      displayName: 'Bea',
    });
    expect(
      mergePatches({ displayName: 'Ana' }, { displayName: 'Silly', nameChosen: false }),
    ).toEqual({ displayName: 'Ana' });
    expect(
      mergePatches({ displayName: 'Silly', nameChosen: false }, { displayName: 'Ana' }),
    ).toEqual({ displayName: 'Ana' });
    expect(mergePatches({ displayName: 'Ana' }, { drawing: null })).toEqual({
      displayName: 'Ana',
      drawing: null,
    });
  });

  it('gives the same result as applying both, one after the other', () => {
    const first = { displayName: 'Silly', nameChosen: false };
    const second = { displayName: 'Ana', drawing: 'data:image/png;base64,AA' };
    expect(applyPatch(EMPTY_PROFILE, mergePatches(first, second))).toEqual(
      applyPatch(applyPatch(EMPTY_PROFILE, first), second),
    );
  });
});

describe('accountKindOf', () => {
  it('tells new, named-for-you and named guests apart', () => {
    expect(accountKindOf(EMPTY_PROFILE)).toBe('new');
    expect(accountKindOf({ ...EMPTY_PROFILE, displayName: 'Silly' })).toBe('named-for-you');
    expect(accountKindOf(named)).toBe('guest');
  });
});
