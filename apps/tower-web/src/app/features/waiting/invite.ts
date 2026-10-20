/**
 * Sharing a room: its invite link, which chat apps unfurl into the room's share card (the server
 * draws it: apps/server/src/modules/tower/tower-share-card.ts), and the card itself as a picture.
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

/** The card as a PNG on the clipboard, for apps that don't unfurl links. */
export async function copyCardImage(code: string): Promise<void> {
  // The blob is passed as a promise, so Safari still counts the click as the user's gesture.
  const png = fetch(cardUrl(code)).then(async (res) => {
    if (!res.ok) throw new Error(`card ${res.status}`);
    return res.blob();
  });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export const canCopyImages = () =>
  typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
