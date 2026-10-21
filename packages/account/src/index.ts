/**
 * The player's account, shared by the portal and every game (docs/technical/decisions.md D13):
 * the profile store (`/api/me`, cached in this browser), its rules and the default fallback
 * avatar. No components or styles: a game builds its identity on this store, and may add the
 * ready-made widget and editor from `@pictiotheme/account/ui`.
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
export { initialDisc } from './fallback-avatar';
export { accountKindOf, EMPTY_PROFILE, type AccountKind } from './profile';
