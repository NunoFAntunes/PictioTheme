/**
 * The avatar shown before someone draws themselves, when the game has no look of its own for it:
 * their initial on a coloured disc (a "?" without a name). Games pass their own instead
 * (DoodleWhirl's initial, Doodle Tower's bobble hat).
 */

const COLORS = ['#f97362', '#f6b93b', '#4cc38a', '#4ea8de', '#9b7be8', '#f07ab8'];

export function initialDisc(name: string | null): string {
  const letter = name?.trim().charAt(0).toUpperCase() || '?';
  let hash = 0;
  for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = COLORS[hash % COLORS.length] ?? '#4ea8de';
  const escaped = letter.replace(/[<>&"']/g, '?');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="32" r="30" fill="${color}"/>` +
    `<text x="32" y="43" text-anchor="middle" font-family="system-ui,sans-serif" ` +
    `font-size="30" font-weight="700" fill="#fff">${escaped}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
