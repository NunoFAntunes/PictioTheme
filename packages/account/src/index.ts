/**
 * The player's account, shared by the portal and every game (docs/technical/decisions.md D13):
 * the profile store (`/api/me`, cached in this browser), the account widget and its editor.
 * A game shows the widget in its corner, keeps the profile as its identity, and may plug in its
 * own editor and fallback avatar.
 */
export {
  accountLoaded,
  accountStore,
  importLegacyProfile,
  saveProfile,
  startAccount,
  useAccount,
  type AccountState,
  type SaveResult,
} from './account-store';
export { AccountWidget } from './components/AccountWidget';
export { DrawingPad } from './components/DrawingPad';
export { ProfileEditor } from './components/ProfileEditor';
export { initialDisc } from './fallback-avatar';
export { accountKindOf, EMPTY_PROFILE, type AccountKind } from './profile';
