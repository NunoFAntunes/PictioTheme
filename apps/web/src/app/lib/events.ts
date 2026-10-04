import { ClientEventResponse, type ClientEvent } from '@pictiotheme/protocol';
import { apiPost } from './api';

/**
 * Product events only the browser knows (time to first turn, the phone gate, the device), for
 * the launch metrics (`POST /api/events`). Fire and forget: a lost event never bothers a player.
 */

/** When this tab first loaded the app, and whether it arrived on an invite link. */
const LANDED_AT = Date.now();
const LANDED_VIA_LINK = typeof location !== 'undefined' && location.pathname.startsWith('/r/');

export function sendEvent(event: ClientEvent): void {
  apiPost('/api/events', event, ClientEventResponse).catch(() => {
    // Metrics are best-effort.
  });
}

/** Called once per tab, when the player's first turn starts. */
export function landingInfo(): { msSinceLanding: number; viaLink: boolean } {
  return { msSinceLanding: Date.now() - LANDED_AT, viaLink: LANDED_VIA_LINK };
}
