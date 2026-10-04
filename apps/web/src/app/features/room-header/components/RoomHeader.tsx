import { Link } from 'react-router';
import {
  amHost,
  drawerIdOf,
  isInMatch,
  sendToRoom,
  useRoomStore,
  useSecondsLeft,
} from '../../../realtime';
import { SoundSettingsButton } from '../../sound';

/** `"_____ ___"` → spaced blanks plus word lengths "(5, 3)". Revealed hint letters show. */
function MaskedWord({ mask }: { mask: string }) {
  const lengths = mask.split(/[\s]+/).map((w) => w.length);
  return (
    <span
      className="flex items-baseline gap-3"
      aria-label={`Word with ${lengths.join(', ')} letters`}
    >
      <span className="font-mono text-xl tracking-[0.3em] whitespace-pre" aria-hidden="true">
        {mask}
      </span>
      <span className="text-sm text-zinc-500">({lengths.join(', ')})</span>
    </span>
  );
}

function Timer({ endsAt, paused }: { endsAt: number | null; paused: boolean }) {
  const seconds = useSecondsLeft(paused ? null : endsAt);
  if (paused) return <span className="font-semibold">⏸ Paused</span>;
  if (seconds === null) return null;
  return (
    <span className={`font-semibold tabular-nums ${seconds <= 10 ? 'text-close' : ''}`}>
      ⏱ {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      {seconds === 10 && (
        <span className="sr-only" aria-live="assertive">
          10 seconds left
        </span>
      )}
    </span>
  );
}

/** Round, timer, word (or blanks) and host controls (screens.md §4, top bar). */
export function RoomHeader() {
  const view = useRoomStore((s) => s.view);
  const connection = useRoomStore((s) => s.connection);
  if (!view) return null;
  const { phase } = view;
  const host = amHost(view);
  const inMatch = isInMatch(phase);
  const endsAt = 'endsAt' in phase ? phase.endsAt : null;
  const word = view.secret.word;
  const isDrawer = drawerIdOf(phase) === view.you;

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <Link to="/play" className="font-display text-lg font-bold">
        Pictio<span className="text-brand-600">Theme</span>
      </Link>
      {inMatch && (
        <span className="text-sm">
          Round {view.round}/{view.settings.rounds}
        </span>
      )}
      {inMatch && <Timer endsAt={endsAt} paused={view.paused !== null} />}

      <div className="flex flex-1 justify-center">
        {phase.kind === 'drawing' &&
          (word ? (
            <span className="text-xl font-bold tracking-wide uppercase" data-testid="current-word">
              {isDrawer ? '✏️ ' : '✅ '}
              {word}
            </span>
          ) : (
            <MaskedWord mask={phase.mask} />
          ))}
        {phase.kind === 'waiting' && <span className="text-zinc-500">{view.name}</span>}
      </div>

      {connection.kind === 'reconnecting' && (
        <span className="text-sm text-close" role="status">
          Reconnecting…
        </span>
      )}
      {view.restarting && (
        <span className="text-sm text-close" role="status">
          Server restarting…
        </span>
      )}

      {host && inMatch && (
        <div className="flex gap-1 text-sm">
          {view.paused === 'host' ? (
            <button
              type="button"
              onClick={() => sendToRoom({ t: 'room:resume' })}
              className="rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ▶ Resume
            </button>
          ) : (
            <button
              type="button"
              disabled={view.paused !== null}
              onClick={() => sendToRoom({ t: 'room:pause' })}
              className="rounded-md px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
            >
              ⏸ Pause
            </button>
          )}
          <button
            type="button"
            disabled={phase.kind === 'reveal'}
            onClick={() => sendToRoom({ t: 'room:skipTurn' })}
            className="rounded-md px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            ⏭ Skip
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('End the match now and show the results?'))
                sendToRoom({ t: 'room:end' });
            }}
            className="rounded-md px-2 py-1 text-close hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ⏹ End
          </button>
        </div>
      )}
      <SoundSettingsButton />
    </header>
  );
}
