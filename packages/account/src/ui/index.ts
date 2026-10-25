/**
 * The account's UI (`@pictiotheme/account/ui`, docs/technical/decisions.md D13), the same on the
 * portal and in every game: the "you" sticker and the profile editor it opens (with the drawing
 * pad from `@pictiotheme/drawing-ui`). Styled with Tailwind: a site imports
 * `@pictiotheme/account/ui/theme.css` after `@pictiotheme/drawing-ui/theme.css`.
 */
export { PlayerSticker } from './components/PlayerSticker';
export { openProfileEditor } from './editor';
