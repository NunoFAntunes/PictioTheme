import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
import { HEADER, sticker } from '../../../ui/room-frame';
import {
  CrownIcon,
  FinishFlagIcon,
  PauseIcon,
  PlayIcon,
  SkipIcon,
} from '../../../ui/ScribbleIcons';
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

/** One of the host's stickers, popping onto the header one after another as they unfold. */
function Unfolded({ order, children }: { order: number; children: ReactNode }) {
  return (
    <div
      className="motion-safe:animate-sticker-pop"
      style={{ animationDelay: `${order * 50}ms`, '--drop-spin': '-12deg' } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * The host's controls, folded away behind one "Manage room" sticker so they don't crowd the
 * header. Pressing it lays them out beside it; pressing it again, Escape or a click elsewhere on
 * the page folds them back up.
 */
function HostControls() {
  const view = useRoomStore((s) => s.view);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const controlsId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape puts an open confirm note away first (ConfirmNote), not the controls under it.
      if (e.key !== 'Escape' || ref.current?.querySelector('[role="alertdialog"]')) return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!view) return null;
  const { phase } = view;
  const inMatch = isInMatch(phase);
  const icon = 'size-5 shrink-0';

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-end gap-2">
      {open && (
        <div id={controlsId} className="flex flex-wrap items-center gap-2">
          {inMatch && (
            <>
              <Unfolded order={0}>
                {view.paused === 'host' ? (
                  <button
                    type="button"
                    onClick={() => sendToRoom({ t: 'room:resume' })}
                    className={sticker(1)}
                  >
                    <PlayIcon className={icon} />
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={view.paused !== null}
                    onClick={() => sendToRoom({ t: 'room:pause' })}
                    className={sticker(1)}
                  >
                    <PauseIcon className={icon} />
                    Pause
                  </button>
                )}
              </Unfolded>
              <Unfolded order={1}>
                <button
                  type="button"
                  disabled={phase.kind === 'reveal'}
                  onClick={() => sendToRoom({ t: 'room:skipTurn' })}
                  className={sticker(2)}
                >
                  <SkipIcon className={icon} />
                  Skip
                </button>
              </Unfolded>
              <Unfolded order={2}>
                <ConfirmNote
                  label={
                    <>
                      <FinishFlagIcon className={icon} />
                      End
                    </>
                  }
                  className={sticker(3)}
                  title="End the match?"
                  confirmLabel="Show the results"
                  onConfirm={() => sendToRoom({ t: 'room:end' })}
                >
                  The scores so far are the final scores.
                </ConfirmNote>
              </Unfolded>
            </>
          )}
          <Unfolded order={inMatch ? 3 : 0}>
            <CloseRoomButton className={sticker(4)} />
          </Unfolded>
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? controlsId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`${sticker(0)} aria-expanded:bg-pop-sun/60`}
      >
        <CrownIcon className="size-6 shrink-0" />
        Manage room
      </button>
    </div>
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

      {host && <HostControls />}
      <RoomIdentityChip
        roomCode={view.code}
        nameStyle={{ fontFamily: font.family, fontSize: `${font.scale}rem` }}
      />
      <SoundSettingsButton />
    </header>
  );
}
