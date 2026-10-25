/**
 * How much bigger than at the browser's own font size the interface is drawn: 1 up to 1080p, 2 on
 * a 4K screen at 100%. global.css grows the root font size on big screens, which scales
 * everything sized in rem; what's sized in px in code (canvas text, avatars on the crew stage)
 * multiplies by this to follow.
 */
let scale: number | null = null;

const read = () => {
  scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
};

export function uiScale(): number {
  if (scale === null) {
    read();
    window.addEventListener('resize', read);
  }
  return scale ?? 1;
}
