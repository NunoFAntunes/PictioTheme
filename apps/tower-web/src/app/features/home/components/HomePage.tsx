import { GuestSessionResponse, JoinRoomResponse, RoomLookupResponse } from '@pictiotheme/protocol';
import { useState, type FormEvent } from 'react';
import { ApiError, apiGet, apiPost } from '../../../lib/api';
import { isValidName, useIdentity } from '../../../lib/identity';
import { Button } from '../../../ui/Button';
import { Panel } from '../../../ui/Panel';
import { NameField } from './NameField';

/** `abcdef`, `ABC DEF`, `abc-def` → `ABC-DEF`. */
function formatCode(raw: string): string {
  const letters = raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  return letters.length > 3 ? `${letters.slice(0, 3)}-${letters.slice(3)}` : letters;
}

/** The home page: your name, then start a new game or join a crew with a code. */
export function HomePage() {
  const { identity, setName } = useIdentity();
  const [name, setNameDraft] = useState(identity?.displayName ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOk = isValidName(name);

  const create = async () => {
    if (!nameOk) return;
    setBusy('create');
    setError(null);
    try {
      const me = setName(name);
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      const room = await apiPost('/api/tower/rooms', me, JoinRoomResponse);
      location.assign(`/r/${room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t reach the server. Try again?');
      setBusy(null);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameOk || code.length !== 7) return;
    setBusy('join');
    setError(null);
    try {
      setName(name);
      const room = await apiGet(`/api/tower/rooms/${encodeURIComponent(code)}`, RoomLookupResponse);
      location.assign(`/r/${room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t reach the server. Try again?');
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-8 px-6 pt-10 pb-36">
      <h1 className="title-outline animate-[bob_4s_ease-in-out_infinite] text-center font-display text-7xl leading-none tracking-wide sm:text-8xl">
        Doodle <span className="text-sun">Tower</span>
      </h1>
      <p className="max-w-lg rounded-2xl bg-white/70 px-5 py-2 text-center text-lg font-medium text-ink backdrop-blur-sm">
        Two crews race to build a tower past the line. Every block is a drawing: guess it, then
        build with it, or send it to the other crew.
      </p>

      <div className="grid w-full gap-5 md:grid-cols-[1fr_1fr]">
        <Panel title="New game" className="flex flex-col gap-4">
          <div className="px-2">
            <NameField value={name} onChange={setNameDraft} autoFocus={!identity} />
          </div>
          <div className="mt-auto px-2">
            <Button
              variant="primary"
              className="h-14 w-full text-lg"
              disabled={!nameOk || busy !== null}
              onClick={() => void create()}
            >
              {busy === 'create' ? 'Getting ready…' : 'Create a room'}
            </Button>
          </div>
        </Panel>

        <Panel title="Join a crew">
          <form className="flex flex-col gap-4 px-2" onSubmit={(e) => void join(e)}>
            <div className="space-y-1">
              <label htmlFor="room-code" className="block text-sm font-semibold text-ink/75">
                Room code
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
            </div>
            <Button
              type="submit"
              variant="sun"
              className="h-14 w-full text-lg"
              disabled={!nameOk || code.length !== 7 || busy !== null}
            >
              {busy === 'join' ? 'Finding the room…' : 'Join'}
            </Button>
            {!nameOk && <p className="text-xs text-ink/60">Pick a name first (2–20 characters).</p>}
          </form>
        </Panel>
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
