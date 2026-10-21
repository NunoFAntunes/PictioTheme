/**
 * Sharing a room: its invite link, which chat apps unfurl into the room's share card (the server
 * draws it: apps/server/src/modules/tower/tower-share-card.ts).
 */

export function inviteLink(code: string): string {
  return `${location.origin}/r/${code}`;
}

/** The current card. `fresh` changes with what the card shows, so the preview is redrawn. */
export function cardUrl(code: string, fresh = ''): string {
  return `/api/tower/rooms/${encodeURIComponent(code)}/card.png${fresh ? `?s=${encodeURIComponent(fresh)}` : ''}`;
}

export async function copyInviteLink(code: string): Promise<void> {
  await navigator.clipboard.writeText(inviteLink(code));
}
