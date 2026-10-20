/**
 * The meadow's sprites (docs/tower/design/visual-identity.md): Kenney's "Toon Characters 1" and
 * "Background Elements Redux", both CC0 (public/scenery/LICENSE-*.txt). Loaded on first use;
 * anything not loaded yet is simply skipped for that frame.
 */

export const CHARACTERS = [
  'femalePerson',
  'malePerson',
  'femaleAdventurer',
  'maleAdventurer',
  'robot',
] as const;
export type Character = (typeof CHARACTERS)[number];

export type Pose = 'idle' | 'cheer0' | 'cheer1';

export const PROPS = {
  cloud: ['cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6', 'cloud7', 'cloud8'],
  tree: ['tree', 'treeLong', 'treePine'],
  sapling: ['treeSmall_green1', 'treeSmall_green2', 'treeSmall_green3'],
  bush: ['bush1', 'bush2', 'bush3', 'bush4', 'bushAlt1', 'bushAlt2'],
  house: ['house1', 'house2', 'houseSmall1', 'houseSmall2'],
  fence: ['fence'],
  sun: ['sun'],
} as const;

const cache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

/** Calls `listener` whenever another sprite finishes loading (for views that draw only once). */
export function onSpriteLoad(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function image(src: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      for (const listener of listeners) listener();
    };
    img.src = src;
    cache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** A character's frame: 96×128, feet near the bottom edge. */
export function characterSprite(character: Character, pose: Pose): HTMLImageElement | null {
  return image(`/scenery/characters/${character}/${pose}.png`);
}

/** A prop (2× "retina" PNGs, transparent around the shape). */
export function propSprite(name: string): HTMLImageElement | null {
  return image(`/scenery/props/${name}.png`);
}

/** Starts loading everything, so the first frames already have their sprites. */
export function preloadScenery(): void {
  for (const c of CHARACTERS) {
    characterSprite(c, 'idle');
    characterSprite(c, 'cheer0');
    characterSprite(c, 'cheer1');
  }
  for (const names of Object.values(PROPS)) for (const n of names) propSprite(n);
}
