import { Profile, UpdateProfileRequest } from '@pictiotheme/protocol';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { AccountApiError, ensureGuest, fetchProfile, putProfile } from './api';
import { applyPatch, EMPTY_PROFILE, mergePatches } from './profile';

/**
 * The player's profile, shared by the portal and every game (docs/technical/decisions.md D13).
 * The server (`/api/me`) is the source of truth. This browser keeps a copy so a page shows who you
 * are before the server answers, and so changes made while it can't be reached are sent later.
 *
 * Outside React, so a game's own identity code can read and subscribe to it; React reads it with
 * `useAccount`.
 */

export type AccountState = {
  /** Null on a first visit until the server answers (or fails to). */
  profile: Profile | null;
  /** `offline`: the server couldn't be reached; showing this browser's copy. */
  status: 'loading' | 'ready' | 'offline';
};

/** The result of a save: `ok: false` when the server refused it (e.g. a name that isn't allowed). */
export type SaveResult = { ok: true; profile: Profile } | { ok: false; message: string };

const CACHE_KEY = 'account.profile.v1';
/** Refresh at most this often when the tab comes back (a rename in another game shows up). */
const REFRESH_GAP_MS = 2_000;

type Cached = { profile: Profile; pending: UpdateProfileRequest | null };

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: unknown; pending?: unknown };
    const profile = Profile.safeParse(parsed.profile);
    if (!profile.success) return null;
    const pending = UpdateProfileRequest.safeParse(parsed.pending);
    return { profile: profile.data, pending: pending.success ? pending.data : null };
  } catch {
    return null;
  }
}

function writeCache(cached: Cached): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Not kept; the profile still works for this tab.
  }
}

const cached = readCache();
/** Changes not yet confirmed by the server, merged into one. */
let pending: UpdateProfileRequest | null = cached?.pending ?? null;
/** Bumped by every local change, so a server answer that predates it isn't applied. */
let generation = 0;
let guestReady = false;
let syncing: Promise<void> | null = null;
let lastSync = 0;
let started = false;
let resolveFirstSync: () => void = () => {};
const firstSync = new Promise<void>((resolve) => {
  resolveFirstSync = resolve;
});

export const accountStore = createStore<AccountState>(() => ({
  profile: cached?.profile ?? null,
  status: 'loading',
}));

function setProfile(profile: Profile, status: AccountState['status']): void {
  accountStore.setState({ profile, status });
  writeCache({ profile, pending });
}

/** Sends waiting changes, then reads the profile. Never throws, except for a refused change. */
async function syncOnce(): Promise<void> {
  try {
    if (!guestReady) {
      await ensureGuest();
      guestReady = true;
    }
    for (;;) {
      const gen = generation;
      const sent = pending;
      const profile = sent ? await putProfile(sent) : await fetchProfile();
      // Something changed while waiting: send or read again, so the newest change wins.
      if (gen !== generation) continue;
      pending = null;
      setProfile(profile, 'ready');
      return;
    }
  } catch (err) {
    if (err instanceof AccountApiError && err.status === 400 && pending) {
      // Refused (a name that isn't allowed): drop it, and show what the server has.
      pending = null;
      const profile = await fetchProfile().catch(() => null);
      if (profile) setProfile(profile, 'ready');
      throw err;
    }
    accountStore.setState({ status: 'offline' });
  } finally {
    lastSync = Date.now();
  }
}

function sync(): Promise<void> {
  syncing ??= syncOnce().finally(() => {
    syncing = null;
    resolveFirstSync();
  });
  return syncing;
}

/**
 * Loads the profile and keeps it fresh: again when the tab comes back into view (you may have
 * renamed yourself in another game) and when the network returns. Safe to call more than once.
 */
export function startAccount(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void sync().catch(() => {});
  const refresh = () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastSync < REFRESH_GAP_MS) return;
    void sync().catch(() => {});
  };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);
}

/** Resolves once the first load has finished, whether or not the server answered. */
export function accountLoaded(): Promise<AccountState> {
  startAccount();
  return firstSync.then(() => accountStore.getState());
}

/**
 * Changes the profile. It shows at once (and in rooms that join now); the server confirms it, or
 * gets it later if it can't be reached. A change the server refuses is undone.
 */
export async function saveProfile(patch: UpdateProfileRequest): Promise<SaveResult> {
  startAccount();
  generation++;
  pending = mergePatches(pending, patch);
  const current = accountStore.getState();
  setProfile(applyPatch(current.profile ?? EMPTY_PROFILE, patch), current.status);
  try {
    // A sync already under way restarts its loop with this change (the generation moved on).
    await sync();
    if (syncing) await syncing;
    const profile = accountStore.getState().profile ?? EMPTY_PROFILE;
    return { ok: true, profile };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof AccountApiError ? err.message : 'Couldn’t save. Try again?',
    };
  }
}

/**
 * Moves an identity a game kept before profiles were shared (its own browser storage) into the
 * profile, once: only while the profile has no chosen name and no drawing, so the first game you
 * open after the change wins. `clear` is called once the old copy is no longer needed.
 */
export async function importLegacyProfile(
  read: () => UpdateProfileRequest | null | Promise<UpdateProfileRequest | null>,
  clear: () => void,
): Promise<void> {
  const { profile, status } = await accountLoaded();
  if (status !== 'ready' || !profile) return;
  // Only a made-up name (or nothing): the old identity is likely more yours.
  if (!profile.nameChosen && profile.drawing === null) {
    const legacy = await read();
    if (!legacy) return;
    const result = await saveProfile(legacy);
    if (!result.ok) return;
  }
  clear();
}

export function useAccount<T>(selector: (state: AccountState) => T): T {
  return useStore(accountStore, selector);
}
