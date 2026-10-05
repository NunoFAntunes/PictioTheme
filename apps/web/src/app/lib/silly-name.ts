/**
 * Generated names for first-time players, so nobody has to fill in a form before playing
 * (user-flows.md §2): an adjective plus a doodle-ish noun, like "Sneaky Pickle". Every pairing is
 * a valid display name (2–20 characters) and passes the profanity filter (silly-name.test.ts).
 */

const ADJECTIVES = [
  'Sneaky',
  'Wobbly',
  'Fuzzy',
  'Sleepy',
  'Bouncy',
  'Giggly',
  'Sparkly',
  'Grumpy',
  'Jolly',
  'Zippy',
  'Dizzy',
  'Squishy',
  'Brave',
  'Cosmic',
  'Curious',
  'Speedy',
  'Wiggly',
  'Crunchy',
  'Mighty',
  'Snazzy',
  'Peppy',
  'Breezy',
  'Doodly',
  'Swirly',
] as const;

const NOUNS = [
  'Pickle',
  'Crayon',
  'Noodle',
  'Pencil',
  'Marker',
  'Penguin',
  'Doodle',
  'Muffin',
  'Squiggle',
  'Taco',
  'Walrus',
  'Waffle',
  'Llama',
  'Narwhal',
  'Pancake',
  'Potato',
  'Eraser',
  'Sloth',
  'Turnip',
  'Donut',
  'Gecko',
  'Otter',
  'Scribble',
  'Teapot',
] as const;

/** `random` returns a number in [0, 1), like Math.random (injectable for tests). */
export function sillyName(random: () => number = Math.random): string {
  const pick = (list: readonly string[]) => list[Math.floor(random() * list.length)] ?? '';
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export const SILLY_NAME_PARTS = { adjectives: ADJECTIVES, nouns: NOUNS };
