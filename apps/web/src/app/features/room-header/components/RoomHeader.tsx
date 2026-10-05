import {
  amHost,
  drawerIdOf,
  isInMatch,
  sendToRoom,
  useRoomStore,
  useSecondsLeft,
} from '../../../realtime';
import { CloseRoomButton } from '../../close-room';
import { RoomIdentityChip } from '../../identity';
import { nameFont } from '../../player-list';
import { SoundSettingsButton } from '../../sound';
import { ConfirmNote } from '../../../ui/ConfirmNote';
import { HEADER, STICKER_BUTTON } from '../../../ui/room-frame';
import { StickerLogo } from '../../../ui/StickerLogo';

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
  // Your name in the header, in the same hand the player list writes it.
  const font = nameFont(view.you, view.code);

  return (
    <header className={HEADER}>
      <StickerLogo />
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

      {host && (
        <div className="flex flex-wrap items-center gap-2">
          {inMatch && (
            <>
              {view.paused === 'host' ? (
                <button
                  type="button"
                  onClick={() => sendToRoom({ t: 'room:resume' })}
                  className={STICKER_BUTTON}
                >
                  ▶ Resume
                </button>
              ) : (
                <button
                  type="button"
                  disabled={view.paused !== null}
                  onClick={() => sendToRoom({ t: 'room:pause' })}
                  className={STICKER_BUTTON}
                >
                  ⏸ Pause
                </button>
              )}
              <button
                type="button"
                disabled={phase.kind === 'reveal'}
                onClick={() => sendToRoom({ t: 'room:skipTurn' })}
                className={STICKER_BUTTON}
              >
                ⏭ Skip
              </button>
              <ConfirmNote
                label="⏹ End"
                className={STICKER_BUTTON}
                title="End the match?"
                confirmLabel="Show the results"
                onConfirm={() => sendToRoom({ t: 'room:end' })}
              >
                The scores so far are the final scores.
              </ConfirmNote>
            </>
          )}
          <CloseRoomButton />
        </div>
      )}
      <RoomIdentityChip
        roomCode={view.code}
        nameStyle={{ fontFamily: font.family, fontSize: `${font.scale}rem` }}
      />
      <SoundSettingsButton />
    </header>
  );
}
