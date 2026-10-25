/**
 * DoodleWhirl's drawing tools, for every site that lets you draw: the drawing board (brush, fill,
 * eraser, the colour wheel and slots, shortcuts), its toolbar, the pad that puts both together,
 * and the avatar pad with the cut-out that turns a doodle into the stored PNG. No game rules and
 * no socket: the room's board passes its own stroke model and `emit`.
 *
 * Styled with Tailwind. A site imports `@pictiotheme/drawing-ui/theme.css` after `tailwindcss`
 * (it scans these files and adds the tokens they use), and may override the tokens after it.
 */
export { cutoutFitted, drawingToAvatar, initialAvatar, recutAvatar } from './avatar/avatar-image';
export { AvatarPad } from './avatar/AvatarPad';
export { DrawingBoard } from './components/DrawingBoard';
export { DrawingPad } from './components/DrawingPad';
export { Toolbar } from './components/Toolbar';
export { isBlank } from './is-blank';
export { DEFAULT_TOOL, PALETTE, withColor, type ToolSettings } from './tools';
export { useColorPopover } from './use-color-popover';
