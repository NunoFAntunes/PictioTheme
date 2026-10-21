import { randomInt, type Rng } from '@pictiotheme/game-core';
import type { PlayerId, Stroke } from '@pictiotheme/protocol';
import { shakePoints, TEAMS, type Team } from '@pictiotheme/protocol/tower';
import { emptyStats, type Ctx, type PlayerState } from './types';

/**
 * Test mode's bots (docs/tower/planning/test-mode.md). Each crew gets a drawer bot, which "draws"
 * a coloured-in rectangle at the start of every round; a crew with nobody in it also gets a
 * builder bot, which places that crew's pieces and acts for it when a `test` message says so.
 * Bots are always connected and have no socket: what's sent to them goes nowhere.
 */

export const isTestRoom = (c: Ctx): boolean => c.state.settings.testMode === true;

export const isBot = (p: PlayerState | undefined): boolean => p?.bot !== undefined;

/** Connected people (not bots). A test room with only its bots left is empty. */
export function connectedHumans(c: Ctx): PlayerState[] {
  return [...c.state.players.values()].filter((p) => p.connected && !isBot(p));
}

const NAMES: Record<Team, string> = { orange: 'Orange', teal: 'Teal' };

/** Seats the bots, just before a test match starts. They look like the host. */
export function addBots(c: Ctx): void {
  const avatar = c.state.players.get(c.state.hostId)?.avatar ?? '0'.repeat(32);
  const add = (team: Team, bot: 'drawer' | 'builder', name: string) => {
    const id = `bot-${team}-${bot}`;
    c.state.players.set(id, {
      id,
      name,
      avatar,
      connected: true,
      joinedAt: c.now,
      team,
      stats: emptyStats(),
      bot,
    });
  };
  for (const team of TEAMS) {
    const people = [...c.state.players.values()].some((p) => p.team === team && !isBot(p));
    add(team, 'drawer', `${NAMES[team]} doodlebot`);
    if (!people) add(team, 'builder', `${NAMES[team]} buildbot`);
  }
}

export function removeBots(c: Ctx): void {
  for (const p of [...c.state.players.values()]) if (isBot(p)) c.state.players.delete(p.id);
}

/** A crew's builder bot: "the rival" of test mode. */
export function builderBot(c: Ctx, team: Team): PlayerId | null {
  for (const p of c.state.players.values()) if (p.team === team && p.bot === 'builder') return p.id;
  return null;
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * A rectangle of a random size and colour, outlined and coloured in, as a drawer would draw it
 * on the 1200 × 900 canvas. Under Shaky hand its outline wobbles like a real drawer's would.
 */
export function rectangleStrokes(rng: Rng, roundId: number, shaky: boolean): Stroke[] {
  const width = 260 + randomInt(rng, 520);
  const height = 140 + randomInt(rng, 300);
  const left = Math.round((1200 - width) / 2);
  const top = Math.round((900 - height) / 2);
  const corners = [
    [left, top],
    [left + width, top],
    [left + width, top + height],
    [left, top + height],
    [left, top],
  ] as const;
  const id = `rect-${roundId}`;
  let pts: number[] = [left, top, 0.5];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1] as readonly [number, number];
    const [bx, by] = corners[i] as readonly [number, number];
    for (let k = 1; k <= 24; k++) {
      pts.push(Math.round(ax + ((bx - ax) * k) / 24), Math.round(ay + ((by - ay) * k) / 24), 0.5);
    }
  }
  if (shaky) pts = shakePoints(pts, id, 0);
  const color = hslToHex(randomInt(rng, 360), 0.7, 0.58);
  return [
    { id, tool: 'brush', color: '#14213d', size: 10, opacity: 1, pts },
    {
      id: `fill-${roundId}`,
      tool: 'fill',
      x: left + Math.round(width / 2),
      y: top + Math.round(height / 2),
      color,
      tolerance: 48,
    },
  ];
}

/** Where a bot lets a piece down: somewhere over the platform's middle. */
export const botDropX = (rng: Rng): number => Math.round((rng() * 2.4 - 1.2) * 100) / 100;
