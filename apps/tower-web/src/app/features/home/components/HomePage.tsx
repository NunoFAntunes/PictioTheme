import type { PlayerIdentity } from '@pictiotheme/protocol';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { ApiError } from '../../../lib/api';
import { isValidName, useIdentity } from '../../../lib/identity';
import { Button } from '../../../ui/Button';
import { Panel } from '../../../ui/Panel';
import { createLobby, lookupRoom, quickPlay } from '../api';
import { NameField } from './NameField';

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

type Busy = 'quick' | 'join' | 'create' | null;

/** One way into a game: an icon, a title, a line about it, and its controls at the bottom. */
function WayIn({
  icon,
  title,
  blurb,
  children,
}: {
  icon: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-2">
        <span aria-hidden="true" className="text-4xl">
          {icon}
        </span>
        <h2 className="font-display text-2xl tracking-wide text-ink">{title}</h2>
      </div>
      <p className="px-2 text-sm font-medium text-ink/70">{blurb}</p>
      <div className="mt-auto px-2">{children}</div>
    </Panel>
  );
}

/**
 * The home page: your name, then the three ways into a game. Quick game drops you into a public
 * room (or opens one others can find), a code or a pasted invite link joins a friend's lobby, and
 * Create a lobby opens a private room with an invite card to share.
 */
export function HomePage() {
  const { identity, setName } = useIdentity();
  const [name, setNameDraft] = useState(identity?.displayName ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOk = isValidName(name);

  const go = async (
    what: Exclude<Busy, null>,
    enter: (me: PlayerIdentity) => Promise<{ code: string }>,
  ) => {
    if (!nameOk) return;
    setBusy(what);
    setError(null);
    try {
      const room = await enter(setName(name));
      // Stays busy: the page is navigating away.
      location.assign(`/r/${room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t reach the server. Try again?');
      setBusy(null);
    }
  };

  const join = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.length !== 7) return;
    void go('join', () => lookupRoom(code));
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-7 px-6 pt-10 pb-36">
      <h1 className="title-outline animate-[bob_4s_ease-in-out_infinite] text-center font-display text-7xl leading-none tracking-wide sm:text-8xl">
        Doodle <span className="text-sun">Tower</span>
      </h1>
      <p className="max-w-lg rounded-2xl bg-white/70 px-5 py-2 text-center text-lg font-medium text-ink backdrop-blur-sm">
        Two crews race to build a tower past the line. Every block is a drawing: guess it, then
        build with it, or send it to the other crew.
      </p>

      <Panel className="w-full max-w-md">
        <div className="px-2">
          <NameField value={name} onChange={setNameDraft} autoFocus={!identity} />
          {!nameOk && (
            <p className="mt-1 text-xs text-ink/60">Pick a name first (2–20 characters).</p>
          )}
        </div>
      </Panel>

      <div className="grid w-full gap-5 md:grid-cols-3">
        <WayIn
          icon="⚡"
          title="Quick game"
          blurb="Jump into an open game with anyone. If there isn’t one, you start one others can find."
        >
          <Button
            variant="primary"
            className="h-14 w-full text-lg"
            disabled={!nameOk || busy !== null}
            onClick={() => void go('quick', quickPlay)}
          >
            {busy === 'quick' ? 'Finding a game…' : 'Quick game'}
          </Button>
        </WayIn>

        <WayIn
          icon="🔑"
          title="Join a private game"
          blurb="Got a code or an invite link from a friend? Type or paste it here."
        >
          <form className="flex flex-col gap-3" onSubmit={join}>
            <label htmlFor="room-code" className="sr-only">
              Room code or invite link
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              placeholder="ABC-DEF"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-xl border-2 border-ink/15 bg-paper px-3 text-center font-display text-xl tracking-[0.3em] text-ink uppercase outline-none focus:border-coral"
            />
            <Button
              type="submit"
              variant="sun"
              className="h-14 w-full text-lg"
              disabled={!nameOk || code.length !== 7 || busy !== null}
            >
              {busy === 'join' ? 'Finding the room…' : 'Join'}
            </Button>
          </form>
        </WayIn>

        <WayIn
          icon="🏗️"
          title="Create a lobby"
          blurb="A private room for your friends. Share its invite card on Discord or anywhere, and set the rules while they arrive."
        >
          <Button
            variant="soft"
            className="h-14 w-full text-lg"
            disabled={!nameOk || busy !== null}
            onClick={() => void go('create', createLobby)}
          >
            {busy === 'create' ? 'Getting ready…' : 'Create a lobby'}
          </Button>
        </WayIn>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/90 px-4 py-2 font-semibold text-cloud">
          {error}
        </p>
      )}

      <a
        href="/sandbox"
        className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-semibold text-dusk-800 shadow-[0_3px_0_var(--color-card-edge)] hover:bg-white"
      >
        Try pieces in the sandbox
      </a>
    </main>
  );
}
