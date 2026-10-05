/**
 * The room's share card: the server draws the waiting room's card as a picture (apps/server
 * share-card.ts). Invite links unfurl into it in chat apps; "Copy as image" puts it on the
 * clipboard. It's an image, not REST data, so it doesn't go through TanStack Query (W4).
 */

export function shareCardUrl(code: string): string {
  return `/api/rooms/${encodeURIComponent(code)}/card.png`;
}

/**
 * Copies the card to the clipboard as a PNG. Where images can't be copied (Firefox without
 * ClipboardItem), opens it in a new tab instead, so it can be saved or dragged. The image's
 * promise goes into the ClipboardItem straight away: Safari only allows the write within the click.
 */
export async function copyShareCardImage(code: string): Promise<'copied' | 'opened'> {
  const url = shareCardUrl(code);
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    window.open(url, '_blank', 'noopener');
    return 'opened';
  }
  const png = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`The card didn't load (${response.status})`);
    return response.blob();
  });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  return 'copied';
}
