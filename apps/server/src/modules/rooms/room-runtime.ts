import {
  step,
  type DeckInfo,
  type DisconnectReason,
  type Effect,
  type MetricEffect,
  type RoomEvent,
  type RoomState,
  type Rng,
  type TimerId,
} from '@pictiotheme/game-core';
import { CloseCode, type PublicRoomSummary } from '@pictiotheme/protocol';
import type { Logger } from '../../lib/logger';
import type { RoomTransport } from './room-transport';

/**
 * The imperative shell around one room's state machine (rules R1–R3, R9).
 * `handle` is synchronous: events are applied one at a time, then their effects are run.
 */

export type RoomRuntimeDeps = {
  transport: RoomTransport;
  loadDeck(deckId: string): Promise<DeckInfo>;
  /** Metric effects (match start/end, cards dealt, turn results, card votes). Best-effort. */
  onMetric(roomCode: string, effect: MetricEffect): void;
  onClosed(roomCode: string): void;
  log: Logger;
  now(): number;
  rng: Rng;
};

const CLOSE_CODE_BY_REASON: Record<DisconnectReason, number> = {
  kicked: CloseCode.kicked,
  banned: CloseCode.banned,
  room_full: CloseCode.roomFull,
  room_closed: CloseCode.roomClosed,
};

export class RoomRuntime {
  readonly state: RoomState;
  private readonly deps: RoomRuntimeDeps;
  private readonly timers = new Map<TimerId, NodeJS.Timeout>();
  private readonly queue: RoomEvent[] = [];
  private processing = false;
  private disposed = false;

  constructor(state: RoomState, deps: RoomRuntimeDeps) {
    this.state = state;
    this.deps = deps;
  }

  get code(): string {
    return this.state.code;
  }

  get isClosed(): boolean {
    return this.disposed;
  }

  handle(event: RoomEvent): void {
    if (this.disposed) return;
    this.queue.push(event);
    if (this.processing) return; // an effect triggered this synchronously: run after the current event
    this.processing = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        if (this.disposed) break;
        let effects: Effect[];
        try {
          effects = step(this.state, next, { now: this.deps.now(), rng: this.deps.rng });
        } catch (err) {
          this.deps.log.error({ err, event: next.type, roomCode: this.code }, 'room step failed');
          continue;
        }
        for (const effect of effects) this.run(effect);
      }
    } finally {
      this.processing = false;
    }
  }

  /** Closes every socket and stops every timer. Idempotent. */
  dispose(closeCode: number = CloseCode.roomClosed, reason = 'Room closed'): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.queue.length = 0;
    this.deps.transport.closeRoom(this.code, closeCode, reason);
    this.deps.onClosed(this.code);
  }

  summary(): PublicRoomSummary {
    const { state } = this;
    return {
      code: state.code,
      name: state.name,
      deckTitle: state.deck?.title ?? null,
      players: [...state.players.values()].filter((p) => p.connected).length,
      maxPlayers: state.settings.maxPlayers,
      status:
        state.phase.kind === 'waiting' || state.phase.kind === 'results' ? 'waiting' : 'playing',
      difficulties: state.settings.difficulties,
      silly: state.settings.silly.enabled,
    };
  }

  private run(effect: Effect): void {
    const { deps } = this;
    switch (effect.kind) {
      case 'send':
        deps.transport.send(this.code, effect.to, JSON.stringify(effect.msg));
        return;
      case 'schedule': {
        const existing = this.timers.get(effect.timer);
        if (existing) clearTimeout(existing);
        const delay = Math.max(0, effect.at - deps.now());
        this.timers.set(
          effect.timer,
          setTimeout(() => {
            this.timers.delete(effect.timer);
            this.handle({ type: 'timer', timer: effect.timer });
          }, delay),
        );
        return;
      }
      case 'cancel': {
        const existing = this.timers.get(effect.timer);
        if (existing) clearTimeout(existing);
        this.timers.delete(effect.timer);
        return;
      }
      case 'loadDeck':
        deps.loadDeck(effect.deckId).then(
          (deck) => this.handle({ type: 'deckLoaded', deck }),
          (err: unknown) => {
            deps.log.warn(
              { err, deckId: effect.deckId, roomCode: this.code },
              'deck failed to load',
            );
            this.handle({ type: 'deckFailed', deckId: effect.deckId });
          },
        );
        return;
      case 'disconnect':
        deps.transport.disconnect(
          this.code,
          effect.playerId,
          CLOSE_CODE_BY_REASON[effect.reason],
          effect.reason,
        );
        return;
      case 'matchStarted':
      case 'matchEnded':
      case 'cardsDealt':
      case 'turnEnded':
      case 'cardVoted':
        // Best-effort and never blocks the game.
        try {
          deps.onMetric(this.code, effect);
        } catch (err) {
          deps.log.error(
            { err, roomCode: this.code, kind: effect.kind },
            'recording a metric failed',
          );
        }
        return;
      case 'close':
        this.dispose();
        return;
    }
  }
}
