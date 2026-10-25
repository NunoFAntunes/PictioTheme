import { accountKindOf, useAccount } from '@pictiotheme/account';
import { openProfileEditor } from '@pictiotheme/account/ui';
import type { PlayerIdentity } from '@pictiotheme/protocol';
import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import { useIdentity } from '../../../lib/identity';
import { DOODLE_URL, PORTAL_URL } from '../../../lib/portal';
import { AccountCorner } from '../../account';
import { HowToPlay } from '../../how-to-play';
import { createLobby, createTestRoom, lookupRoom, quickPlay } from '../api';
import { BalloonMenu, type WayIn } from './BalloonMenu';
import { TowerLogo } from './TowerLogo';
import { UnderConstruction } from './UnderConstruction';

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
 * you are (the "you" sticker in the corner, where you change your name and drawing), and the
 * balloon menu with the three ways into a game. Quick game drops you into a public room (or opens
 * one others can find), Private game takes a code or a pasted invite link, and Create a lobby
 * opens a private room with an invite card to share. Without a name, a way in asks for one.
 */
export function HomePage() {
  const identity = useIdentity((s) => s.identity);
  // No name yet, or one made up for you in another game: an arrow asks you to introduce yourself.
  const nudge = useAccount((s) => {
    const kind = s.profile && accountKindOf(s.profile);
    return kind === 'new' || kind === 'named-for-you';
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<Way | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (way: Way, me: PlayerIdentity) => {
    setBusy(way);
    setError(null);
    try {
      const room = await ENTER[way](me, code);
      // Stays busy: the page is navigating away.
      location.assign(`/r/${room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t reach the server. Try again?');
      setBusy(null);
    }
  };

  const pick = (way: Way) => {
    if (busy !== null) return false;
    if (!identity) {
      openProfileEditor();
      return false;
    }
    if (way === 'join' && code.length !== 7) return false;
    void go(way, identity);
    return true;
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center gap-4 overflow-x-clip px-6 pt-14 pb-28">
      <AccountCorner nudge={nudge} portalLink />
      <TowerLogo />

      <div className="mt-2 flex items-center justify-center">
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

      <HowToPlay variant="hero" openOnFirstVisit />

      {/* Development only: the sandbox is for tuning pieces and physics, and the server refuses
          test rooms in production. */}
      {import.meta.env.DEV && (
        <div className="flex gap-3">
          <a
            href="/sandbox"
            className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-dusk-800 shadow-[0_3px_0_var(--color-card-edge)] hover:bg-white"
          >
            Try pieces in the sandbox
          </a>
          <button
            type="button"
            onClick={() => pick('test')}
            className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-dusk-800 shadow-[0_3px_0_var(--color-card-edge)] hover:bg-white"
          >
            🧪 Test the powers
          </button>
        </div>
      )}

      <UnderConstruction />

      <p className="text-sm text-dusk-900/80">
        Part of{' '}
        <a href={PORTAL_URL} className="font-semibold text-dusk-950 underline">
          Games
        </a>{' '}
        · Also try{' '}
        <a href={DOODLE_URL} className="font-semibold text-dusk-950 underline">
          DoodleWhirl!
        </a>
      </p>
    </main>
  );
}
