/**
 * The account's ready-made UI (`@pictiotheme/account/ui`, docs/technical/decisions.md D13): the
 * widget for a game's corner, its editor and the drawing pad, styled with `--acct-*` custom
 * properties (account.css). Optional: a game may build its own on the store
 * (`@pictiotheme/account`), as DoodleWhirl does. Importing this brings account.css with it.
 */
export { AccountWidget } from './components/AccountWidget';
export { DrawingPad } from './components/DrawingPad';
export { ProfileEditor } from './components/ProfileEditor';
