import type { PublicPlayer, ServerMessage } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import type { RoomView } from '../../realtime';
import { soundsForMessage, tickFor } from './room-sounds';
import { DEFAULT_SOUND_SETTINGS, groupGain, parseSoundSettings } from './sound-settings';

function player(id: string): PublicPlayer {
  return {
    id,
    name: id,
    avatar: 'a'.repeat(32),
    score: 0,
    connected: true,
    isHost: false,
    guessedThisTurn: false,
  };
}

function view(overrides: Partial<RoomView> = {}): RoomView {
  return {
    you: 'me',
    code: 'ABC-DEF',
    name: 'Room',
    isPublic: false,
    settings: {} as RoomView['settings'],
    deck: null,
    players: [player('me'), player('ana')],
    phase: { kind: 'drawing', drawerId: 'ana', endsAt: 99, mask: '___' },
    phaseLive: true,
    paused: null,
    round: 1,
    secret: {},
    likes: null,
    feed: [],
    bubbles: {},
    restarting: false,
    nextFeedId: 1,
    ...overrides,
  };
}

const sounds = (msg: ServerMessage, before: RoomView | null = view(), after = view()) =>
  soundsForMessage(msg, before, after);

describe('room sounds', () => {
  it('stays quiet when catching up from a snapshot or switching rooms', () => {
    expect(sounds({ t: 'phase:results', ranking: [], awards: [] }, null)).toEqual([]);
    expect(
      sounds({ t: 'phase:results', ranking: [], awards: [] }, view({ code: 'XYZ-XYZ' })),
    ).toEqual([]);
  });

  it('tells you apart from everyone else', () => {
    const choosing = { t: 'phase:choosing', round: 1, endsAt: 1 } as const;
    expect(sounds({ ...choosing, drawerId: 'me' })).toEqual(['yourTurn']);
    expect(sounds({ ...choosing, drawerId: 'ana' })).toEqual([]);
    expect(sounds({ t: 'guess:self', kind: 'correct', text: 'cat' })).toEqual(['guessCorrect']);
    expect(sounds({ t: 'guess:self', kind: 'close', text: 'cap' })).toEqual(['guessClose']);
    expect(sounds({ t: 'guess:self', kind: 'wrong', text: 'dog' })).toEqual([]);
    expect(sounds({ t: 'turn:solved', playerId: 'me', order: 1 })).toEqual([]);
    expect(sounds({ t: 'turn:solved', playerId: 'ana', order: 1 })).toEqual(['guessSolved']);
    expect(sounds({ t: 'chat', playerId: 'me', text: 'hi' })).toEqual([]);
    expect(sounds({ t: 'guess:feed', playerId: 'ana', kind: 'wrong', text: 'dog' })).toEqual([
      'chat',
    ]);
  });

  it('notices players joining and leaving', () => {
    const msg: ServerMessage = { t: 'room:players', players: [] };
    expect(
      sounds(msg, view(), view({ players: [player('me'), player('ana'), player('bo')] })),
    ).toEqual(['playerJoin']);
    expect(sounds(msg, view(), view({ players: [player('me')] }))).toEqual(['playerLeave']);
    // Score or connection updates are not joins.
    expect(sounds(msg, view(), view())).toEqual([]);
  });

  it('plays the hint and time-up cues only on real changes', () => {
    expect(sounds({ t: 'hint', mask: 'C__' })).toEqual(['hint']);
    expect(sounds({ t: 'hint', mask: '___' })).toEqual([]);
    expect(sounds({ t: 'phase:reveal', word: 'cat', deltas: {}, endsAt: 1 })).toEqual(['timeUp']);
  });

  it('ticks through the last ten seconds, alternating and getting louder', () => {
    expect(tickFor(11)).toBeNull();
    expect(tickFor(0)).toBeNull();
    const ten = tickFor(10);
    const nine = tickFor(9);
    const one = tickFor(1);
    expect(ten?.rate).not.toBe(nine?.rate);
    expect(ten?.volume).toBeCloseTo(0.6);
    expect(one?.volume).toBeCloseTo(1);
  });
});

describe('sound settings', () => {
  it('keeps defaults for missing or broken stored values', () => {
    expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    const parsed = parseSoundSettings({ master: 3, groups: { timer: { on: false } }, muted: 'no' });
    expect(parsed.master).toBe(1);
    expect(parsed.muted).toBe(false);
    expect(parsed.groups.timer).toEqual({
      on: false,
      volume: DEFAULT_SOUND_SETTINGS.groups.timer.volume,
    });
    expect(parsed.groups.game).toEqual(DEFAULT_SOUND_SETTINGS.groups.game);
  });

  it('silences a group when it is off or everything is muted', () => {
    const s = DEFAULT_SOUND_SETTINGS;
    expect(groupGain(s, 'game')).toBeCloseTo(0.8);
    expect(groupGain({ ...s, muted: true }, 'game')).toBe(0);
    expect(
      groupGain({ ...s, groups: { ...s.groups, timer: { on: false, volume: 1 } } }, 'timer'),
    ).toBe(0);
  });
});
