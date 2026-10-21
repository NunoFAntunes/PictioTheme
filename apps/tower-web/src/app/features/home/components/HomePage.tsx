import type { PlayerIdentity } from '@pictiotheme/protocol';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { isValidName, useIdentity } from '../../../lib/identity';
import { AccountCorner } from '../../account';
import { createLobby, createTestRoom, lookupRoom, quickPlay } from '../api';
import { BalloonMenu, type WayIn } from './BalloonMenu';
import { HowToPlay } from './HowToPlay';
import { IdentityCard } from './IdentityCard';
import { TowerLogo } from './TowerLogo';

/**
 * `abcdef`, `ABC DEF`, `abc-def` → `ABC-DEF`. A pasted invite link (`…/r/ABC-DEF`) becomes its
 * code.
 */
export function formatCode(raw: string): string {
  const link = /\/r\/([A-Za-z-]+)/.exec(raw);
  const letters = (link?.[1] ?? raw)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  return letters.length > 3 ? `${letters.slice(0, 3)}-${letters.slice(3)}` : letters;
}

/** The balloon menu's ways in, and (in development) a test-mode room. */
type Way = WayIn | 'test';

const ENTER: Record<Way, (me: PlayerIdentity, code: string) => Promise<{ code: string }>> = {
  quick: (me) => quickPlay(me),
  join: (_, code) => lookupRoom(code),
  create: (me) => createLobby(me),
  test: (me) => createTestRoom(me),
};

/**
 * The home page (docs/tower/design/screens.md#1-home): the logo with its balloons to pop, who
 * you are (your avatar and name), and the balloon menu with the three ways into a game. Quick game
 * drops you into a public room (or opens one others can find), Private game takes a code or a
 * pasted invite link, and Create a lobby opens a private room with an invite card to share.
 */
export function HomePage() {
  const { identity, setName } = useIdentity();
  // The profile's name (it can arrive, or change in another game, after the page opened) until
  // you type your own.
  const [draft, setDraft] = useState<string | null>(null);
  const profileName = identity?.displayName ?? '';
  const name = draft ?? profileName;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<Way | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState(0);
  const nameOk = isValidName(name);
  // A name you type is your profile's (every game's) after a short pause.
  useEffect(() => {
    if (draft === null || !nameOk || draft.trim() === profileName) return;
    const timer = setTimeout(() => setName(draft), 800);
    return () => clearTimeout(timer);
  }, [draft, nameOk, profileName, setName]);

  const go = async (way: Way) => {
    setBusy(way);
    setError(null);
    try {
      const room = await ENTER[way](setName(name), code);
      // Stays busy: the page is navigating away.
      location.assign(`/r/${room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t reach the server. Try again?');
      setBusy(null);
    }
  };

  const pick = (way: Way) => {
    if (busy !== null) return false;
    if (!nameOk) {
      setNudge((n) => n + 1);
      return false;
    }
    if (way === 'join' && code.length !== 7) return false;
    void go(way);
    return true;
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center gap-4 overflow-x-clip px-6 pt-14 pb-28">
      {/* Editing here is the identity card below: the widget points you at it. */}
      <AccountCorner onEdit={() => setNudge((n) => n + 1)} />
      <TowerLogo />

      <div className="mt-2 flex items-center justify-center gap-14">
        <IdentityCard name={name} onName={setDraft} nameOk={nameOk} nudge={nudge} />
        <BalloonMenu
          busy={busy === 'test' ? null : busy}
          code={code}
          onCode={(raw) => setCode(formatCode(raw))}
          onPick={pick}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/90 px-4 py-2 font-semibold text-cloud">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <HowToPlay />
        <a
          href="/sandbox"
          className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-dusk-800 shadow-[0_3px_0_var(--color-card-edge)] hover:bg-white"
        >
          Try pieces in the sandbox
        </a>
        {/* Development only: the server refuses test rooms in production. */}
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => pick('test')}
            className="rounded-full bg-sun px-4 py-1.5 text-sm font-semibold text-sun-ink shadow-[0_3px_0_var(--color-sun-dark)] hover:brightness-105"
          >
            🧪 Test the powers
          </button>
        )}
      </div>
    </main>
  );
}
