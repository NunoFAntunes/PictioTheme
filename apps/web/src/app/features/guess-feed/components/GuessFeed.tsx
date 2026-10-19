import type { NoticeCode, PlayerId } from '@pictiotheme/protocol';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { playerName, useRoomStore, type FeedItem, type RoomView } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { Doodle, EMOTES } from '../../emotes';
import { nameFont } from '../../player-list';

const REDACTED = '██████';

/** How close to the bottom (px) still counts as reading the latest messages. */
const STICK_SLACK = 32;

/*
 * The feed mixes what players type with what the game says. Players' lines are left-aligned with
 * their name; the game's lines are centred and never start with a name, so they can't be mistaken
 * for chat: dividers between turns, the reveal as a card, and small stickers for everything else.
 */

function noticeText(view: RoomView, item: Extract<FeedItem, { kind: 'notice' }>): string {
  const who = item.playerId ? playerName(view, item.playerId) : '';
  const texts: Record<NoticeCode, string> = {
    pool_reshuffled: 'The deck ran out of cards and was reshuffled.',
    player_kicked: `${who} was removed from the room.`,
    vote_kick: `Vote to kick ${who}: ${item.count ?? 0}/${item.needed ?? 0}.`,
    host_changed: `${who} is now the host.`,
    deck_unavailable: 'That deck could not be loaded. Pick another one.',
  };
  return texts[item.code];
}

/** A player's name in the hand the player list writes it in. `you`: how to say it's you. */
function HandName({ view, id, you = 'You' }: { view: RoomView; id: PlayerId; you?: string }) {
  const font = nameFont(id, view.code);
  return (
    <span
      className="text-ink"
      style={{ fontFamily: font.family, fontSize: `${font.scale}em`, lineHeight: 1 }}
    >
      {id === view.you ? you : playerName(view, id)}
    </span>
  );
}

/** A dashed rule across the note with a label in the middle: where a turn or the match starts or ends. */
function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 mb-1 flex items-center gap-2 text-xs text-zinc-500" role="separator">
      <span aria-hidden="true" className="flex-1 border-t-2 border-dashed border-zinc-300" />
      <span className="flex max-w-[85%] flex-wrap items-baseline justify-center gap-x-1.5 text-center">
        {children}
      </span>
      <span aria-hidden="true" className="flex-1 border-t-2 border-dashed border-zinc-300" />
    </div>
  );
}

/** A small centred sticker for the game's one-line announcements. */
function SystemLine({
  icon,
  className,
  children,
}: {
  icon: ReactNode;
  className: string;
  children: ReactNode;
}) {
  return (
    <p
      className={`mx-auto my-0.5 flex max-w-[95%] items-baseline gap-1.5 px-2.5 py-0.5 text-center text-xs ${WOBBLE[2]} ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function FeedLine({ item, view }: { item: FeedItem; view: RoomView }) {
  switch (item.kind) {
    case 'guess': {
      const name = item.self ? 'You' : playerName(view, item.playerId);
      if (item.guess === 'close') {
        return (
          <p className="text-close">
            <span className="font-medium">{name}:</span> {item.text ?? REDACTED}
            <span className="ml-1 text-xs">{item.self ? 'So close!' : '(close)'}</span>
          </p>
        );
      }
      return (
        <p>
          <span className="font-medium">{name}:</span> {item.text}
        </p>
      );
    }
    case 'chat':
      return (
        <p className={item.solvedChannel ? 'rounded bg-solved/15 px-1' : ''}>
          {item.solvedChannel && (
            <span className="mr-1 text-[0.65rem] font-semibold tracking-wide text-emerald-800 uppercase">
              Solvers
            </span>
          )}
          <span className="font-medium">{playerName(view, item.playerId)}:</span> {item.text}
        </p>
      );
    case 'turn':
      return (
        <Divider>
          <span className="font-logo text-sm text-ink">
            Round {item.round}/{view.settings.rounds}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <HandName view={view} id={item.drawerId} />{' '}
            {item.drawerId === view.you ? 'draw' : 'draws'}
          </span>
        </Divider>
      );
    case 'solved':
      return (
        <SystemLine
          icon="🎉"
          className="border border-solved/60 bg-solved/15 font-medium text-emerald-900"
        >
          {item.playerId === view.you
            ? 'You got it!'
            : `${playerName(view, item.playerId)} guessed it!`}
          {item.order === 1 && <span className="ml-1 font-normal">First!</span>}
        </SystemLine>
      );
    case 'rush':
      return (
        <SystemLine icon="⚡" className="border border-pop-sun bg-pop-sun/25 font-medium text-ink">
          Rush! {item.seconds} seconds left to guess.
        </SystemLine>
      );
    case 'reveal':
      return (
        <div
          className={`mx-auto my-2 -rotate-1 border-2 border-ink bg-pop-sun/25 px-4 py-1.5 text-center shadow-[2px_3px_0_var(--color-ink)] ${WOBBLE[1]}`}
        >
          <p className="text-[0.65rem] font-semibold tracking-wider text-zinc-600 uppercase">
            The word was
          </p>
          <p className="font-logo text-xl leading-tight break-words text-ink">{item.word}</p>
          {item.drawerId && (
            <p className="text-xs text-zinc-600">
              {item.drawerId === view.you ? (
                'your drawing'
              ) : (
                <>
                  drawn by <HandName view={view} id={item.drawerId} />
                </>
              )}
            </p>
          )}
        </div>
      );
    case 'emote': {
      const info = EMOTES[item.emote];
      return (
        <SystemLine
          icon={<Doodle name={info.icon} className="inline size-4 self-center" />}
          className="border border-pop-pink/60 bg-pop-pink/15 text-ink"
        >
          <HandName view={view} id={item.playerId} /> {info.verb}
          {item.target && (
            <>
              {' '}
              <HandName view={view} id={item.target} you="you" />
            </>
          )}
          !
        </SystemLine>
      );
    }
    case 'matchOver':
      return (
        <Divider>
          <span className="font-logo text-sm text-ink">🏁 Match over</span>
        </Divider>
      );
    case 'pause':
      return (
        <SystemLine icon={item.reason ? '⏸' : '▶'} className="bg-zinc-100 text-zinc-600">
          {item.reason === 'host'
            ? 'The host paused the game.'
            : item.reason === 'players'
              ? 'Paused until more players are here.'
              : 'The game goes on.'}
        </SystemLine>
      );
    case 'notice':
      return (
        <SystemLine icon="📣" className="bg-zinc-100 text-zinc-600">
          {noticeText(view, item)}
        </SystemLine>
      );
    case 'error':
      return (
        <SystemLine icon="⚠️" className="border border-close/40 bg-close/10 text-close">
          {item.message}
        </SystemLine>
      );
  }
}

/** Lines the viewer wrote or earned themselves: those always bring the feed back to the bottom. */
function isOwn(item: FeedItem, view: RoomView): boolean {
  if (item.kind === 'guess') return item.self;
  if (item.kind === 'chat' || item.kind === 'solved') return item.playerId === view.you;
  return false;
}

/**
 * Guesses, chat and events (screens.md §4, right column). The feed sticks to the latest line while
 * the reader is at the bottom. Scrolling up unsticks it and shows "Jump to latest".
 */
export function GuessFeed() {
  const view = useRoomStore((s) => s.view);
  const listRef = useRef<HTMLDivElement>(null);
  // A ref, so new lines can read it without waiting for a render; the state drives the button.
  const stuckRef = useRef(true);
  const lastTopRef = useRef(0);
  const [stuck, setStuck] = useState(true);
  const [unread, setUnread] = useState(false);
  const last = view?.feed.at(-1);
  // The feed is capped (oldest lines drop off), so its length stops changing: follow the last id.
  const lastId = last?.id;
  const ownLast = last && view ? isOwn(last, view) : false;

  const hasView = view !== null;

  const stick = useCallback((value: boolean) => {
    stuckRef.current = value;
    setStuck(value);
    if (value) setUnread(false);
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || lastId === undefined) return;
    if (stuckRef.current || ownLast) {
      list.scrollTop = list.scrollHeight;
      lastTopRef.current = list.scrollTop;
      if (!stuckRef.current) stick(true);
    } else {
      setUnread(true);
    }
  }, [lastId, ownLast, stick]);

  // The column changes height (window resize, the guess bar's notes): stay on the latest line.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (stuckRef.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [hasView]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const top = list.scrollTop;
    const atBottom = list.scrollHeight - top - list.clientHeight <= STICK_SLACK;
    // Only the reader scrolling up unsticks it, not the content moving under it.
    if (atBottom) {
      if (!stuckRef.current) stick(true);
    } else if (top < lastTopRef.current && stuckRef.current) {
      stick(false);
    }
    lastTopRef.current = top;
  };

  const jumpToLatest = () => {
    const list = listRef.current;
    if (!list) return;
    stick(true);
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  };

  if (!view) return null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 text-sm"
        role="log"
        aria-live="polite"
        aria-label="Guesses and chat"
      >
        {view.feed.map((item) => (
          <FeedLine key={item.id} item={item} view={view} />
        ))}
      </div>
      {!stuck && (
        <button
          type="button"
          onClick={jumpToLatest}
          className={`absolute bottom-2 left-1/2 flex -translate-x-1/2 -rotate-1 items-center gap-1.5 border-2 border-ink bg-white px-3 py-1 text-xs font-medium whitespace-nowrap text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashed focus-visible:outline-ink active:translate-y-0.5 active:shadow-none pointer-coarse:py-2.5 ${WOBBLE[2]}`}
        >
          {unread && <span aria-hidden="true" className="size-2 rounded-full bg-pop-tomato" />}
          Jump to latest
          {unread && <span className="sr-only">(new messages)</span>}
          <span aria-hidden="true">↓</span>
        </button>
      )}
    </div>
  );
}
