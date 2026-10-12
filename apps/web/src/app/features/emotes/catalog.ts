import type { Emote } from '@pictiotheme/protocol';
import type { SoundId } from '../sound';
import type { DoodleName } from './doodles';

/**
 * How each emote looks in the wheel and reads in the feed (game-rules.md#emotes). The animations
 * are in choreography.ts.
 */
export type EmoteInfo = {
  label: string;
  icon: DoodleName;
  /** The feed line after the player's name: "Ana squished Bo!", "Ana busted a move!". */
  verb: string;
  sound: SoundId;
};

export const EMOTES: Record<Emote, EmoteInfo> = {
  dance: { label: 'Dance', icon: 'dance', verb: 'busted a move', sound: 'emotePop' },
  taunt: { label: 'Taunt', icon: 'taunt', verb: 'taunted everyone', sound: 'emoteBoing' },
  flex: { label: 'Flex', icon: 'flex', verb: 'flexed', sound: 'emoteThump' },
  cry: { label: 'Cry', icon: 'cry', verb: 'burst into tears', sound: 'emoteSob' },
  squish: { label: 'Squish', icon: 'squish', verb: 'squished', sound: 'emoteThump' },
  slap: { label: 'Slap', icon: 'hand', verb: 'slapped', sound: 'emoteSlap' },
  tomato: { label: 'Tomato', icon: 'tomato', verb: 'threw a tomato at', sound: 'emoteSplat' },
  hug: { label: 'Hug', icon: 'hug', verb: 'hugged', sound: 'emotePop' },
};
