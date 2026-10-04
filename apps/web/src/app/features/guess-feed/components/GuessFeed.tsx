import type { NoticeCode } from '@pictiotheme/protocol';
import { useEffect, useRef } from 'react';
import { playerName, useRoomStore, type FeedItem, type RoomView } from '../../../realtime';

const REDACTED = '██████';

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
          <span className="font-medium">{playerName(view, item.playerId)}:</span> {item.text}
        </p>
      );
    case 'solved':
      return (
        <p className="font-medium text-solved">
          🎉{' '}
          {item.playerId === view.you
            ? 'You got it!'
            : `${playerName(view, item.playerId)} guessed it!`}
        </p>
      );
    case 'reveal':
      return (
        <p className="text-zinc-500">
          The word was <strong className="text-zinc-900 dark:text-zinc-100">{item.word}</strong>
        </p>
      );
    case 'notice':
      return <p className="text-sm text-zinc-500 italic">{noticeText(view, item)}</p>;
    case 'error':
      return <p className="text-sm text-close">⚠️ {item.message}</p>;
  }
}

/** Guesses, chat and events (screens.md §4, right column). */
export function GuessFeed() {
  const view = useRoomStore((s) => s.view);
  const listRef = useRef<HTMLDivElement>(null);
  const count = view?.feed.length ?? 0;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count]);

  if (!view) return null;
  return (
    <div
      ref={listRef}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 text-sm"
      role="log"
      aria-live="polite"
      aria-label="Guesses and chat"
    >
      {view.feed.map((item) => (
        <FeedLine key={item.id} item={item} view={view} />
      ))}
    </div>
  );
}
