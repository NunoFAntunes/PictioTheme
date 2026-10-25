import type { Rng } from '@pictiotheme/game-core';
import { CloseCode, type Card } from '@pictiotheme/protocol';
import { TEAMS, type MatchResults, type Team } from '@pictiotheme/protocol/tower';
import {
  step,
  type Effect,
  type TimerId,
  type TowerEvent,
  type TowerRoomState,
} from '@pictiotheme/tower-core';
import type { Logger } from '../../lib/logger';
import type { RoomTransport } from '../rooms';
import type { WorldEvent } from './physics/physics-messages';
import type { PhysicsPool, PhysicsWorld } from './physics/physics-pool';

/**
 * The imperative shell around one Doodle Tower room (rules R1–R3, R9), like DoodleWhirl's
 * RoomRuntime. It also owns the room's two physics worlds: their events go into the state machine,
 * and their frames go straight to the players (everyone sees both towers; there's nothing to
 * decide about them).
 */

export type TowerRoomRuntimeDeps = {
  transport: RoomTransport;
  physics: PhysicsPool;
  loadWords(): Promise<Card[]>;
  /** A finished match, for the history tables. Best-effort. */
  onMatchEnded(
    roomCode: string,
    ended: { results: MatchResults; startedAt: number; endedAt: number },
  ): void;
  onClosed(roomCode: string): void;
  log: Logger;
  now(): number;
  rng: Rng;
};

export class TowerRoomRuntime {
  readonly state: TowerRoomState;
  /** Who made the room: its name until the host is in it (the room is named after its host). */
  readonly creatorName: string;
  /** The share card, drawn on demand and kept until what it shows changes. */
  shareCard: { version: string; png: Buffer } | null = null;
  private readonly deps: TowerRoomRuntimeDeps;
  private readonly timers = new Map<TimerId, NodeJS.Timeout>();
  private readonly queue: TowerEvent[] = [];
  private processing = false;
  private disposed = false;
  private readonly worlds: Record<Team, PhysicsWorld>;
  /** The last known pose of every body, per tower: frames carry only the moving ones. */
  private readonly poses: Record<Team, Map<number, [number, number, number]>> = {
    orange: new Map(),
    teal: new Map(),
  };

  constructor(state: TowerRoomState, creatorName: string, deps: TowerRoomRuntimeDeps) {
    this.state = state;
    this.creatorName = creatorName;
    this.deps = deps;
    this.worlds = {
      orange: deps.physics.createWorld((e) => this.onWorldEvent('orange', e)),
      teal: deps.physics.createWorld((e) => this.onWorldEvent('teal', e)),
    };
  }

  get code(): string {
    return this.state.code;
  }

  get isClosed(): boolean {
    return this.disposed;
  }

  handle(event: TowerEvent): void {
    if (this.disposed) return;
    this.queue.push(event);
    if (this.processing) return;
    this.processing = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        if (this.disposed) break;
        let effects: Effect[];
        try {
          effects = step(this.state, next, { now: this.deps.now(), rng: this.deps.rng });
        } catch (err) {
          this.deps.log.error({ err, event: next.type, roomCode: this.code }, 'tower step failed');
          continue;
        }
        for (const effect of effects) this.run(effect);
        // A player who just (re)joined gets both towers as they stand, after their snapshot.
        if (next.type === 'join') this.sendPoses(next.player.id);
      }
    } finally {
      this.processing = false;
    }
  }

  dispose(closeCode: number = CloseCode.roomClosed, reason = 'Room closed'): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.queue.length = 0;
    for (const team of TEAMS) this.worlds[team].dispose();
    this.deps.transport.closeRoom(this.code, closeCode, reason);
    this.deps.onClosed(this.code);
  }

  private connected(): string[] {
    return [...this.state.players.values()].filter((p) => p.connected).map((p) => p.id);
  }

  private sendPoses(playerId: string): void {
    for (const team of TEAMS) {
      const bodies: number[] = [];
      for (const [id, [x, y, a]] of this.poses[team]) bodies.push(id, x, y, a);
      this.deps.transport.send(
        this.code,
        [playerId],
        JSON.stringify({ t: 'tower:frame', tower: team, tick: 0, bodies }),
      );
    }
  }

  private onWorldEvent(tower: Team, event: WorldEvent): void {
    if (this.disposed) return;
    switch (event.t) {
      case 'frame': {
        const poses = this.poses[tower];
        if (event.full) poses.clear();
        for (let i = 0; i + 3 < event.bodies.length; i += 4) {
          const b = event.bodies;
          poses.set(b[i] as number, [b[i + 1] as number, b[i + 2] as number, b[i + 3] as number]);
        }
        if (event.bodies.length === 0 && !event.full) return;
        this.deps.transport.send(
          this.code,
          this.connected(),
          JSON.stringify({ t: 'tower:frame', tower, tick: event.tick, bodies: event.bodies }),
        );
        return;
      }
      case 'released':
        this.handle({ type: 'released', tower, pieceId: event.pieceId });
        return;
      case 'fumbled':
        for (const id of event.pieceIds) this.poses[tower].delete(id);
        this.handle({ type: 'fumbled', tower, pieceIds: event.pieceIds });
        return;
      case 'pigeonGone':
        this.handle({ type: 'pigeonGone', tower });
        return;
      case 'magpieTook':
        if (event.pieceId !== null) this.poses[tower].delete(event.pieceId);
        this.handle({ type: 'magpieTook', tower, pieceId: event.pieceId });
        return;
      case 'height':
        this.handle({ type: 'height', tower, height: event.height, starHeld: event.starHeld });
        return;
    }
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
      case 'loadWords':
        deps.loadWords().then(
          (cards) => this.handle({ type: 'wordsLoaded', cards }),
          (err: unknown) =>
            deps.log.error({ err, roomCode: this.code }, 'tower words failed to load'),
        );
        return;
      case 'physics':
        if (effect.physics.op === 'reset') this.poses[effect.tower].clear();
        this.worlds[effect.tower].send(effect.physics);
        return;
      case 'matchEnded':
        try {
          deps.onMatchEnded(this.code, effect);
        } catch (err) {
          deps.log.error({ err, roomCode: this.code }, 'recording a tower match failed');
        }
        return;
      case 'close':
        this.dispose();
        return;
    }
  }
}
