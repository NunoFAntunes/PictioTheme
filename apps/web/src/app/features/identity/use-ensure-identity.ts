import { accountLoaded, saveProfile, useAccount } from '@pictiotheme/account';
import { useEffect } from 'react';
import { sillyName } from '../../lib/silly-name';
import { importLegacyIdentity, useIdentity, type Identity } from './identity-store';

/**
 * The player's identity, made up on the first visit so nobody fills in a form before playing
 * (user-flows.md §2): a silly name (saved as not chosen, so every game still asks you to pick
 * your own) and its initial as the avatar. Null until the profile has loaded on a first visit.
 */
export function useEnsureIdentity(): Identity | null {
  const identity = useIdentity((s) => s.identity);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await importLegacyIdentity();
      await accountLoaded();
      if (cancelled || useIdentity.getState().identity) return;
      await saveProfile({ displayName: sillyName(), nameChosen: false });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return identity;
}

/** False while you play under a made-up name: the home page asks you to introduce yourself. */
export function useNameChosen(): boolean {
  return useAccount((s) => s.profile?.nameChosen ?? false);
}
