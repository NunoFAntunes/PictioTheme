import { initialDisc } from '@pictiotheme/account';
import { PlayerSticker } from '@pictiotheme/account/ui';

/**
 * You, at the top of the portal over the line between the games: the same "you" sticker as in
 * every game, with your initial on a disc until you draw yourself (docs/technical/decisions.md
 * D13). A click changes your name and drawing, for every game.
 */
export function PortalSticker() {
  return <PlayerSticker fallbackAvatar={initialDisc} />;
}
