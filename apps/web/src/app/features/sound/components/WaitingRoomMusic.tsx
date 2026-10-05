import { useEffect } from 'react';
import { startHomeMusic } from '../home-music';

/**
 * The home page's tune, carried on into the waiting room if it was playing there (home-music.ts).
 * It fades out when the waiting room goes, i.e. when the match starts.
 */
export function WaitingRoomMusic() {
  useEffect(() => startHomeMusic({ onlyIfCarried: true }), []);
  return null;
}
