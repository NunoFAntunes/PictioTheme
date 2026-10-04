import type {
  CardOption,
  GuessKind,
  NoticeCode,
  PauseReason,
  PlayerId,
  PublicPhase,
  PublicPlayer,
  RoomDeck,
  RoomSettings,
  ServerMessage,
} from '@pictiotheme/protocol';

/**
 * What the UI renders for a room, built from server messages by a pure reducer.
 * Drawing operations are not here: they go to the stroke model (rule W9).
 */

export type FeedItem =
  | {
      id: number;
      kind: 'guess';
      playerId: PlayerId;
      guess: GuessKind;
      text?: string;
      self: boolean;
    }
  | { id: number; kind: 'chat'; playerId: PlayerId; text: string; solvedChannel: boolean }
  | { id: number; kind: 'solved'; playerId: PlayerId; order: number }
  | { id: number; kind: 'reveal'; word: string }
  | {
      id: number;
      kind: 'notice';
      code: NoticeCode;
      playerId?: PlayerId;
      count?: number;
      needed?: number;
    }
  | { id: number; kind: 'error'; message: string };

type NewFeedItem = FeedItem extends infer T ? (T extends FeedItem ? Omit<T, 'id'> : never) : never;

/** The latest guess shown under a player's name (fades out in the UI). */
export type Bubble = { kind: GuessKind; text?: string; at: number };

export type RoomView = {
  you: PlayerId;
  code: string;
  name: string;
  isPublic: boolean;
  settings: RoomSettings;
  deck: RoomDeck | null;
  players: PublicPlayer[];
  phase: PublicPhase;
  paused: PauseReason | null;
  round: number;
  /** Drawer's options while choosing; the word for the drawer and for players who solved. */
  secret: { options?: CardOption[]; word?: string };
  feed: FeedItem[];
  bubbles: Record<PlayerId, Bubble>;
  restarting: boolean;
  nextFeedId: number;
};

const MAX_FEED_ITEMS = 200;

export function viewFromSnapshot(
  msg: Extract<ServerMessage, { t: 'room:snapshot' }>,
  previous: RoomView | null,
): RoomView {
  // A reconnect to the same room keeps the feed so the conversation isn't lost.
  const keep = previous?.code === msg.code ? previous : null;
  return {
    you: msg.you,
    code: msg.code,
    name: msg.name,
    isPublic: msg.isPublic,
    settings: msg.settings,
    deck: msg.deck,
    players: msg.players,
    phase: msg.phase,
    paused: msg.paused,
    round: msg.round,
    secret: msg.secret,
    feed: keep?.feed ?? [],
    bubbles: {},
    restarting: false,
    nextFeedId: keep?.nextFeedId ?? 1,
  };
}

function addFeed(view: RoomView, item: NewFeedItem): RoomView {
  const feed = [...view.feed, { ...item, id: view.nextFeedId }];
  return {
    ...view,
    feed: feed.length > MAX_FEED_ITEMS ? feed.slice(-MAX_FEED_ITEMS) : feed,
    nextFeedId: view.nextFeedId + 1,
  };
}

/** True when this message starts a new drawing, so the canvas must be cleared. */
export function startsNewDrawing(view: RoomView | null, msg: ServerMessage): boolean {
  if (msg.t === 'phase:choosing') return true;
  // phase:drawing is also re-sent after a pause: only a new turn clears the canvas.
  return msg.t === 'phase:drawing' && view?.phase.kind !== 'drawing';
}

export function applyServerMessage(view: RoomView, msg: ServerMessage, now: number): RoomView {
  switch (msg.t) {
    case 'room:snapshot':
      return viewFromSnapshot(msg, view);
    case 'room:players':
      return { ...view, players: msg.players };
    case 'room:settings':
      return { ...view, settings: msg.settings, deck: msg.deck };
    case 'room:paused':
      return { ...view, paused: msg.paused };
    case 'room:notice': {
      const { t: _t, ...notice } = msg;
      return addFeed(view, { kind: 'notice', ...notice });
    }
    case 'phase:choosing':
      return {
        ...view,
        phase: { kind: 'choosing', drawerId: msg.drawerId, endsAt: msg.endsAt },
        secret: msg.options ? { options: msg.options } : {},
        bubbles: {},
        round: msg.round,
      };
    case 'phase:drawing':
      return {
        ...view,
        phase: { kind: 'drawing', drawerId: msg.drawerId, endsAt: msg.endsAt, mask: msg.mask },
        secret: msg.word ? { word: msg.word } : {},
        bubbles: view.phase.kind === 'drawing' ? view.bubbles : {},
        round: msg.round,
      };
    case 'hint':
      return view.phase.kind === 'drawing'
        ? { ...view, phase: { ...view.phase, mask: msg.mask } }
        : view;
    case 'guess:feed': {
      const bubbles = {
        ...view.bubbles,
        [msg.playerId]: { kind: msg.kind, text: msg.text, at: now },
      };
      // Correct guesses appear in the feed through turn:solved.
      if (msg.kind === 'correct') return { ...view, bubbles };
      return addFeed(
        { ...view, bubbles },
        { kind: 'guess', playerId: msg.playerId, guess: msg.kind, text: msg.text, self: false },
      );
    }
    case 'guess:self': {
      const withBubble = {
        ...view,
        bubbles: { ...view.bubbles, [view.you]: { kind: msg.kind, text: msg.text, at: now } },
        secret: msg.word ? { word: msg.word } : view.secret,
      };
      if (msg.kind === 'correct') return withBubble;
      return addFeed(withBubble, {
        kind: 'guess',
        playerId: view.you,
        guess: msg.kind,
        text: msg.text,
        self: true,
      });
    }
    case 'chat':
      return addFeed(view, {
        kind: 'chat',
        playerId: msg.playerId,
        text: msg.text,
        solvedChannel: msg.solvedChannel ?? false,
      });
    case 'turn:solved':
      return addFeed(view, { kind: 'solved', playerId: msg.playerId, order: msg.order });
    case 'phase:reveal':
      return addFeed(
        {
          ...view,
          phase: { kind: 'reveal', word: msg.word, deltas: msg.deltas, endsAt: msg.endsAt },
          secret: {},
        },
        { kind: 'reveal', word: msg.word },
      );
    case 'phase:results':
      return {
        ...view,
        phase: { kind: 'results', ranking: msg.ranking, awards: msg.awards },
        secret: {},
        paused: null,
        bubbles: {},
      };
    case 'error':
      return addFeed(view, { kind: 'error', message: msg.message });
    case 'server:restarting':
      return { ...view, restarting: true };
    default:
      // draw:* go to the stroke model; pong is handled by the connection.
      return view;
  }
}
