/**
 * Every sound the game plays, which group's volume controls it, and how loud it is within that
 * group. Files live in apps/web/public/sounds (sources and licenses: docs/design/sounds.md).
 * To try another clip, drop it in that folder and change the file name here.
 * MP3 for one-shots; WAV for loops.
 */

export type SoundGroup = 'game' | 'guesses' | 'drawing' | 'timer' | 'room' | 'music';

export const SOUND_GROUPS: { id: SoundGroup; label: string; description: string }[] = [
  { id: 'game', label: 'Cards & turns', description: 'Shuffling, dealing, your turn, results' },
  { id: 'guesses', label: 'Guesses', description: 'Correct, close, and others solving' },
  { id: 'drawing', label: 'Drawing', description: 'Pencil scribbling and the paint bucket' },
  { id: 'timer', label: 'Clock ticking', description: 'The last 10 seconds of a turn' },
  { id: 'room', label: 'Chat & players', description: 'Messages, players joining and leaving' },
  { id: 'music', label: 'Music', description: 'The tune on the home page' },
];

type SoundDef = {
  /** One is picked at random each time, so repeated sounds don't feel robotic. */
  files: string[];
  group: SoundGroup;
  /** Relative loudness, 0–1, to balance clips from different packs. */
  volume: number;
  /** Plays at most once in this window (chat bursts, several players solving at once). */
  minGapMs?: number;
};

export const SOUNDS = {
  cardShuffle: { files: ['card-shuffle.mp3'], group: 'game', volume: 0.8 },
  cardDeal: {
    files: ['card-deal-1.mp3', 'card-deal-2.mp3', 'card-deal-3.mp3', 'card-deal-4.mp3'],
    group: 'game',
    volume: 0.7,
  },
  cardFlip: { files: ['card-flip.mp3'], group: 'game', volume: 0.6 },
  cardPick: { files: ['card-pick.mp3'], group: 'game', volume: 0.8 },
  yourTurn: { files: ['your-turn.mp3'], group: 'game', volume: 0.6 },
  timeUp: { files: ['time-up.mp3'], group: 'game', volume: 0.6 },
  matchResults: { files: ['match-results.mp3'], group: 'game', volume: 0.6 },
  // The results' podium ceremony (features/results), synthesised for the game.
  podiumScribble: { files: ['podium-scribble.mp3'], group: 'game', volume: 0.35 },
  podiumThump: { files: ['podium-thump.mp3'], group: 'game', volume: 0.7 },
  drumroll: { files: ['drumroll.mp3'], group: 'game', volume: 0.55 },
  cymbalCrash: { files: ['cymbal-crash.mp3'], group: 'game', volume: 0.6 },
  winnerFanfare: { files: ['winner-fanfare.mp3'], group: 'game', volume: 0.5 },
  stickerPop: { files: ['sticker-pop.mp3'], group: 'game', volume: 0.4, minGapMs: 60 },
  pokeBoing: { files: ['poke-boing.mp3'], group: 'game', volume: 0.45 },
  hint: { files: ['hint.mp3'], group: 'guesses', volume: 0.5 },
  guessCorrect: { files: ['guess-correct.mp3'], group: 'guesses', volume: 0.8 },
  guessSolved: { files: ['guess-solved.mp3'], group: 'guesses', volume: 0.45, minGapMs: 150 },
  guessClose: { files: ['guess-close.mp3'], group: 'guesses', volume: 0.6 },
  // Very faint on purpose: it plays the whole time someone draws. Loops, so it's a WAV
  // (MP3 adds silence at the start, which would click on every loop).
  pencil: { files: ['pencil-loop.wav'], group: 'drawing', volume: 0.12 },
  fillGlug: { files: ['fill-glug-1.mp3', 'fill-glug-2.mp3'], group: 'drawing', volume: 0.55 },
  clockTick: { files: ['clock-tick.mp3'], group: 'timer', volume: 0.35 },
  chat: { files: ['chat.mp3'], group: 'room', volume: 0.4, minGapMs: 120 },
  playerJoin: { files: ['player-join.mp3'], group: 'room', volume: 0.5, minGapMs: 200 },
  playerLeave: { files: ['player-leave.mp3'], group: 'room', volume: 0.5, minGapMs: 200 },
  // The host closing the room: it's crumpled into a ball and kicked away (features/close-room).
  paperCrumple: { files: ['paper-crumple.mp3'], group: 'room', volume: 0.6 },
  paperKick: { files: ['paper-kick.mp3'], group: 'room', volume: 0.6 },
} as const satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

/** What plays when a group's volume is changed in the settings, so players hear the result. */
export const GROUP_PREVIEW: Record<SoundGroup, SoundId | null> = {
  game: 'cardDeal',
  guesses: 'guessCorrect',
  drawing: 'fillGlug',
  timer: 'clockTick',
  room: 'chat',
  music: null, // the music itself is the preview
};

/** The home page's tune: Ogg Vorbis (gapless loop) where the browser plays it, else MP3. */
export const HOME_MUSIC = [
  { file: 'flowerbed-fields.ogg', type: 'audio/ogg; codecs=vorbis' },
  { file: 'flowerbed-fields.mp3', type: 'audio/mpeg' },
] as const;

export function soundUrl(file: string): string {
  return `/sounds/${file}`;
}
