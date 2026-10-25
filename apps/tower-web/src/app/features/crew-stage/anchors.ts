import { useEffect, useRef } from 'react';
import type { Ledge } from './ledges';

/**
 * The places on screen avatars stand (`seats.ts` names them): the drawing pads, their rims, the
 * decide card, a placer's cloud. Whatever shows a place registers a function that says where it is
 * right now, and the stage asks every one of them once per frame, so an anchor can move (a cloud
 * follows its piece) without React rendering anything.
 */

type Locate = () => Ledge | null;

const anchors = new Map<string, Locate>();

/** Registers `key`'s place until the returned function is called. The latest registration wins. */
export function setAnchor(key: string, locate: Locate): () => void {
  anchors.set(key, locate);
  return () => {
    if (anchors.get(key) === locate) anchors.delete(key);
  };
}

/** Where every anchor on screen is now. */
export function locateAnchors(): Map<string, Ledge> {
  const found = new Map<string, Ledge>();
  for (const [key, locate] of anchors) {
    const ledge = locate();
    if (ledge) found.set(key, ledge);
  }
  return found;
}

/**
 * Keeps `key` registered while the component is mounted (none while `key` is null). `locate` is
 * called every frame and may read refs; the latest one passed is used.
 */
export function useStageAnchor(key: string | null, locate: Locate): void {
  const latest = useRef(locate);
  useEffect(() => {
    latest.current = locate;
  });
  useEffect(() => (key ? setAnchor(key, () => latest.current()) : undefined), [key]);
}
