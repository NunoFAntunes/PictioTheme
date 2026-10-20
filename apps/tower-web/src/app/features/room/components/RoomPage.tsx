import { useEffect, useState } from 'react';
import { isValidName, useIdentity } from '../../../lib/identity';
import { connectRoom, useRoomStore } from '../../../realtime';
import { Button } from '../../../ui/Button';
import { Panel } from '../../../ui/Panel';
import { GameScreen } from '../../game';
import { NameField } from '../../home';
import { Results } from '../../results';
import { WaitingRoom } from '../../waiting';

/** `/r/ABC-DEF` → `ABC-DEF`. */
function codeFromPath(): string {
  return decodeURIComponent(location.pathname.replace(/^\/r\//, '').replace(/\/$/, ''));
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-6">{children}</main>;
}

/** Arriving from an invite link without a name yet. */
function NameGate({ code }: { code: string }) {
  const setName = useIdentity((s) => s.setName);
  const [name, setDraft] = useState('');
  return (
    <Centered>
      <Panel title={`Join room ${code}`} className="w-full max-w-sm">
        <form
          className="space-y-4 px-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidName(name)) setName(name);
          }}
        >
          <NameField value={name} onChange={setDraft} autoFocus />
          <Button
            type="submit"
            variant="primary"
            className="h-12 w-full"
            disabled={!isValidName(name)}
          >
            Join the crews
          </Button>
        </form>
      </Panel>
    </Centered>
  );
}

/** The server's last error for you, for three seconds. */
function ErrorToast() {
  const error = useRoomStore((s) => s.view?.error ?? null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setDismissed(error.key), 3000);
    return () => clearTimeout(timer);
  }, [error]);
  if (!error || dismissed === error.key) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-danger px-4 py-2 font-semibold text-cloud shadow-xl"
    >
      {error.message}
    </div>
  );
}

/** The room: connect, then the waiting room, the match or the results. */
export function RoomPage() {
  const [code] = useState(codeFromPath);
  const identity = useIdentity((s) => s.identity);
  const view = useRoomStore((s) => s.view);
  const connection = useRoomStore((s) => s.connection);
  const hasIdentity = identity !== null;

  useEffect(() => {
    if (!hasIdentity) return;
    return connectRoom(code, () => {
      const current = useIdentity.getState().identity;
      if (!current) throw new Error('no identity');
      return current;
    });
  }, [code, hasIdentity]);

  if (!hasIdentity) return <NameGate code={code} />;

  if (connection.kind === 'closed' && connection.reason !== 'left') {
    return (
      <Centered>
        <Panel title="Room closed" className="w-full max-w-sm text-center">
          <p className="mb-4 px-2 font-semibold">{connection.message}</p>
          <Button variant="primary" onClick={() => location.assign('/')}>
            Back to the start
          </Button>
        </Panel>
      </Centered>
    );
  }
  if (!view) {
    return (
      <Centered>
        <p className="font-display text-xl text-cloud-dim">Finding the room…</p>
      </Centered>
    );
  }

  return (
    <>
      {/* Phones and portrait tablets: the game needs a landscape screen (screens.md). */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dusk-900 p-8 text-center lg:hidden">
        <p className="font-display text-xl">
          Doodle Tower needs a bigger screen. Turn your tablet sideways, or use a computer.
        </p>
      </div>
      {view.phase === 'waiting' && <WaitingRoom view={view} />}
      {view.phase === 'playing' && <GameScreen view={view} />}
      {view.phase === 'results' && <Results view={view} />}
      {connection.kind === 'reconnecting' && (
        <div className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-sun px-4 py-1.5 font-display text-ink shadow-xl">
          Reconnecting…
        </div>
      )}
      {view.restarting && (
        <div className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-sun px-4 py-1.5 font-display text-ink shadow-xl">
          The server is restarting. Back in a moment.
        </div>
      )}
      <ErrorToast />
    </>
  );
}
