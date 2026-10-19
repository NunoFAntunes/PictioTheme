import type { RoomSettings } from '@pictiotheme/protocol';
import { cardPoolOf, cardPoolSettings, type CardPoolId } from './card-pool';
import { PACES } from './match-length';

/**
 * The house rules' simple view: four ready-made games, each setting the length, the cards and
 * every rule at once (game-rules.md#game-styles). The full rules (RoomSettingsForm) are a flip
 * away, and settings tuned there match no style.
 */

type StyleSettings = Pick<
  RoomSettings,
  'rounds' | 'drawSeconds' | 'rush' | 'hints' | 'guessVisibility' | 'wordChoice'
>;

const pace = (id: (typeof PACES)[number]['id']) => {
  const p = PACES.find((x) => x.id === id);
  if (!p) throw new Error(`no pace ${id}`);
  return { rounds: p.rounds, drawSeconds: p.drawSeconds };
};

/** Hints, everyone's guesses and three cards to pick from: on in every style. */
const FRIENDLY = { hints: true, guessVisibility: 'show', wordChoice: 3 } as const;

export const GAME_STYLES = [
  {
    id: 'quick-easy',
    label: '🐣 Quick and easy',
    blurb: 'A short warm-up with easy cards, no rush',
    pool: 'easy',
    settings: { ...pace('quick'), rush: false, ...FRIENDLY },
  },
  {
    id: 'easy',
    label: '🎈 Easy game',
    blurb: 'A full game with easy cards, no rush',
    pool: 'easy',
    settings: { ...pace('classic'), rush: false, ...FRIENDLY },
  },
  {
    id: 'standard',
    label: '🎯 Standard game',
    blurb: 'Easy and hard cards, 2 minutes to draw, with rush',
    pool: 'mixed',
    settings: { rounds: 3, drawSeconds: 120, rush: true, ...FRIENDLY },
  },
  {
    id: 'chaos',
    label: '🌀 Chaos mode',
    blurb: 'Only the absurd cards, 3 minutes to draw, with rush',
    pool: 'chaos',
    settings: { rounds: 3, drawSeconds: 180, rush: true, ...FRIENDLY },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  blurb: string;
  pool: CardPoolId;
  settings: StyleSettings;
}[];

export type GameStyleId = (typeof GAME_STYLES)[number]['id'];

export type GameStyle = (typeof GAME_STYLES)[number];

/** The settings that play `style`. Chaos keeps the difficulties, like the Cards choice. */
export function gameStyleSettings(style: GameStyle): Partial<RoomSettings> {
  return { ...style.settings, ...cardPoolSettings(style.pool) };
}

/** The style these settings match, or null when the host set them up in the full rules. */
export function gameStyleOf(
  settings: Pick<RoomSettings, 'mode' | 'difficulties'> & StyleSettings,
): GameStyleId | null {
  const pool = cardPoolOf(settings);
  return (
    GAME_STYLES.find(
      (style) =>
        style.pool === pool &&
        (Object.keys(style.settings) as (keyof StyleSettings)[]).every(
          (key) => settings[key] === style.settings[key],
        ),
    )?.id ?? null
  );
}
