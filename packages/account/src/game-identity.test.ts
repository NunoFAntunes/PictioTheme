import { describe, expect, it, vi } from 'vitest';
import { accountStore } from './account-store';
import { createGameIdentity } from './game-identity';
import { EMPTY_PROFILE } from './profile';

const drawing = 'data:image/png;base64,DRAWN';

describe('createGameIdentity', () => {
  const fallbackAvatar = vi.fn((name: string) => `data:image/png;base64,${name}`);
  const game = createGameIdentity({ fallbackAvatar, actions: () => ({}) });
  const setProfile = (patch: Partial<typeof EMPTY_PROFILE>) =>
    accountStore.setState({ profile: { ...EMPTY_PROFILE, ...patch }, status: 'ready' });

  it('mirrors the profile: the drawing, or the fallback made once per name', () => {
    setProfile({ displayName: null });
    expect(game.useIdentity.getState().identity).toBeNull();

    setProfile({ displayName: 'Ana', nameChosen: true });
    const identity = game.useIdentity.getState().identity;
    expect(identity).toEqual({ displayName: 'Ana', avatar: 'data:image/png;base64,Ana' });
    expect(identity && game.isFallback(identity)).toBe(true);

    setProfile({ displayName: 'Ana', nameChosen: true, drawing });
    expect(game.useIdentity.getState()).toMatchObject({
      identity: { displayName: 'Ana', avatar: drawing },
      drawn: drawing,
    });
    expect(fallbackAvatar.mock.calls.filter(([name]) => name === 'Ana')).toHaveLength(1);
  });

  it('leaves the identity alone when a sync brings the same profile', () => {
    setProfile({ displayName: 'Bea', nameChosen: true });
    const before = game.useIdentity.getState().identity;
    setProfile({ displayName: 'Bea', nameChosen: true });
    expect(game.useIdentity.getState().identity).toBe(before);
  });
});
