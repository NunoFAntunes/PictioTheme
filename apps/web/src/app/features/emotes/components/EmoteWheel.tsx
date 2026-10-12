import {
  EMOTE_CHARGES,
  emoteChargesAt,
  SOLO_EMOTES,
  TARGETED_EMOTES,
  type Emote,
  type PublicPlayer,
} from '@pictiotheme/protocol';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { sendToRoom, useNow, useRoomStore } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { BoltIcon } from '../../../ui/ScribbleIcons';
import { EMOTES } from '../catalog';
import { Doodle } from './Doodle';

/** Where the wheel's stickers sit around the character, in degrees (0: right, 90: down). */
const FAN = [-63, -21, 21, 63];

type Props = {
  /** Whose character was clicked: yourself (solo emotes) or someone else (targeted ones). */
  player: PublicPlayer;
  you: boolean;
  /** The clicked character, and where it was on screen when clicked: the wheel opens around it. */
  anchor: HTMLElement;
  rect: DOMRect;
  onClose: () => void;
};

/**
 * The emote wheel (game-rules.md#emotes): stickers fanned out around a character in the margin,
 * towards the middle of the screen. Your own character offers solo emotes, anyone else's the
 * targeted ones. Above the character, your charges and when the next one comes back.
 */
export function EmoteWheel({ player, you, anchor, rect, onClose }: Props) {
  const stored = useRoomStore((s) => s.view?.emoteCharges);
  const now = useNow(250);
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  // Closes on a click elsewhere, Escape, or when the column scrolls or the window resizes (the
  // wheel would no longer be around the character).
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onScroll = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  useEffect(() => items.current[0]?.focus(), [rect]);

  if (!stored) return null;
  // As of now: the server sends them as of your last emote, and they refill as the clock runs.
  const charges = emoteChargesAt(stored, now);

  const emotes: readonly Emote[] = you ? SOLO_EMOTES : TARGETED_EMOTES;
  const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  // Fan out towards the middle of the screen: right from the margin, left near the right edge.
  const towards = centre.x < window.innerWidth / 2 ? 0 : 180;
  const radius = rect.width / 2 + 40;
  const left = charges.refillAt === null ? 0 : Math.max(0, charges.refillAt - now);
  const waiting = charges.readyAt > now;
  const ready = charges.left > 0 && !waiting;

  function pick(emote: Emote) {
    sendToRoom(you ? { t: 'emote', emote } : { t: 'emote', emote, target: player.id });
    close();
  }

  function close() {
    onClose();
    anchor.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const at = items.current.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      items.current[(at + step + emotes.length) % emotes.length]?.focus();
    }
  }

  return createPortal(
    <div
      ref={root}
      role="menu"
      aria-label={you ? 'Your emotes' : `Emotes at ${player.name}`}
      onKeyDown={onKeyDown}
      className="pointer-events-none fixed inset-0 z-50 scheme-light"
    >
      {emotes.map((emote, i) => {
        const info = EMOTES[emote];
        const angle = (((FAN[i] ?? 0) + towards) * Math.PI) / 180;
        return (
          <div
            key={emote}
            className="pointer-events-auto fixed -translate-1/2"
            style={{
              left: centre.x + radius * Math.cos(angle),
              top: centre.y + radius * Math.sin(angle),
            }}
          >
            <button
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitem"
              disabled={!ready}
              onClick={() => pick(emote)}
              data-emote={emote}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`flex w-16 flex-col items-center gap-0.5 border-[2px_2.5px_3px_2px] border-ink bg-paper px-1 py-1.5 text-ink shadow-[2px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-pop-sun/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-dashed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-paper motion-safe:animate-sticker-pop ${WOBBLE[i % WOBBLE.length]}`}
            >
              <Doodle name={info.icon} className="size-8" />
              <span className="font-logo text-xs leading-none">{info.label}</span>
            </button>
          </div>
        );
      })}
      <div
        // Above the character, leaning away from the fan so it doesn't cover its first sticker.
        style={{ left: centre.x + (towards === 0 ? 8 : -8), top: rect.top - 4 }}
        className={`pointer-events-auto fixed -translate-y-full ${towards === 0 ? '-translate-x-full' : ''}`}
      >
        <div
          className={`flex flex-col items-center border-2 border-ink bg-paper px-2 py-0.5 text-xs text-ink shadow-[1px_2px_0_var(--color-ink)] motion-safe:animate-sticker-pop ${WOBBLE[2]}`}
        >
          <span
            role="img"
            aria-label={`${charges.left} of ${EMOTE_CHARGES} emotes left`}
            className="flex gap-0.5"
          >
            {Array.from({ length: EMOTE_CHARGES }, (_, i) => (
              <BoltIcon
                key={i}
                className={`size-4 ${i < charges.left ? '' : 'opacity-30'}`}
                fill={i < charges.left ? undefined : 'transparent'}
              />
            ))}
          </span>
          {charges.left < EMOTE_CHARGES && left > 0 && (
            <span className="text-[0.65rem] text-zinc-600">+1 in {Math.ceil(left / 1000)}s</span>
          )}
          {charges.left > 0 && waiting && (
            <span className="text-[0.65rem] text-zinc-600">Catch your breath…</span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
