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
  /** A turn begins: a divider between turns, so system lines stand apart from the chat. */
  | { id: number; kind: 'turn'; round: number; drawerId: PlayerId }
  /** `drawerId` is null when the reveal came without a turn we watched (a snapshot mid-reveal). */
  | { id: number; kind: 'reveal'; word: string; drawerId: PlayerId | null }
  | { id: number; kind: 'matchOver' }
  /** The match paused (with why) or resumed (null). */
  | { id: number; kind: 'pause'; reason: PauseReason | null }
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
  /**
   * True when the current phase started while we watched (a phase:* message), false when it came
   * in a snapshot (joining, reconnecting). The results' podium ceremony only plays live.
   */
  phaseLive: boolean;
  paused: PauseReason | null;
  round: number;
  /** Drawer's options while choosing; the word for the drawer and for players who solved. */
  secret: { options?: CardOption[]; word?: string };
  /**
   * ❤️ on the current drawing, while it's drawn and at its reveal (null otherwise). `drawerId` is
   * null only after reconnecting mid-reveal, when the reveal doesn't say who drew.
   */
  likes: { drawerId: PlayerId | null; likers: PlayerId[] } | null;
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
    phaseLive: false,
    paused: msg.paused,
    round: msg.round,
    secret: msg.secret,
    likes:
      msg.phase.kind === 'drawing'
        ? { drawerId: msg.phase.drawerId, likers: msg.likers }
        : msg.phase.kind === 'reveal'
          ? { drawerId: null, likers: msg.likers }
          : null,
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
    case 'turn:likes':
      return view.likes ? { ...view, likes: { ...view.likes, likers: msg.likers } } : view;
    case 'room:details':
      return { ...view, name: msg.name, isPublic: msg.isPublic };
    case 'room:paused':
      if (msg.paused === view.paused) return view;
      return addFeed({ ...view, paused: msg.paused }, { kind: 'pause', reason: msg.paused });
    case 'room:notice': {
      const { t: _t, ...notice } = msg;
      return addFeed(view, { kind: 'notice', ...notice });
    }
    case 'phase:choosing': {
      const next: RoomView = {
        ...view,
        phase: { kind: 'choosing', drawerId: msg.drawerId, endsAt: msg.endsAt },
        phaseLive: true,
        secret: msg.options ? { options: msg.options } : {},
        likes: null,
        bubbles: {},
        round: msg.round,
      };
      // phase:choosing is re-sent after a pause: only a new turn gets a divider in the feed.
      const sameTurn = view.phase.kind === 'choosing' && view.phase.drawerId === msg.drawerId;
      return sameTurn
        ? next
        : addFeed(next, { kind: 'turn', round: msg.round, drawerId: msg.drawerId });
    }
    case 'phase:drawing':
      return {
        ...view,
        phase: { kind: 'drawing', drawerId: msg.drawerId, endsAt: msg.endsAt, mask: msg.mask },
        phaseLive: true,
        secret: msg.word ? { word: msg.word } : {},
        bubbles: view.phase.kind === 'drawing' ? view.bubbles : {},
        // phase:drawing is re-sent after a pause: only a new turn starts with no likes.
        likes:
          view.phase.kind === 'drawing' && view.likes
            ? view.likes
            : { drawerId: msg.drawerId, likers: [] },
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
          phaseLive: true,
          secret: {},
        },
        {
          kind: 'reveal',
          word: msg.word,
          drawerId: view.phase.kind === 'drawing' ? view.phase.drawerId : null,
        },
      );
    case 'phase:results':
      return addFeed(
        {
          ...view,
          phase: { kind: 'results', ranking: msg.ranking, awards: msg.awards },
          phaseLive: true,
          secret: {},
          likes: null,
          paused: null,
          bubbles: {},
        },
        { kind: 'matchOver' },
      );
    case 'error':
      return addFeed(view, { kind: 'error', message: msg.message });
    case 'server:restarting':
      return { ...view, restarting: true };
    default:
      // draw:* go to the stroke model; pong is handled by the connection.
      return view;
  }
}
