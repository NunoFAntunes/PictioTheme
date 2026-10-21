import { hasProfanity } from '@pictiotheme/game-core';
import type { Profile, UpdateProfileRequest } from '@pictiotheme/protocol';
import type { Db } from '../../db/client';
import { playerIdOf, type Actor } from '../../lib/actor';
import { AppError } from '../../lib/errors';
import type { AvatarsService } from '../avatars';
import { findPlayer, findPlayerForUpdate, savePlayer, type PlayerRow } from './players.repository';

/**
 * The player's profile: one name and drawing for the portal and every game
 * (docs/technical/decisions.md D13). Rooms still take the identity on join, so a game works
 * the same with or without it; the games keep the profile up to date.
 */

function toProfile(actor: Actor, row: PlayerRow | null): Profile {
  return {
    playerId: playerIdOf(actor),
    kind: actor.kind,
    displayName: row?.displayName ?? null,
    nameChosen: row?.nameChosen ?? false,
    drawing: row?.drawingPng ? `data:image/png;base64,${row.drawingPng.toString('base64')}` : null,
  };
}

export function createPlayersService(deps: { db: Db; avatars: AvatarsService }) {
  return {
    /** An empty profile until a game or the portal saves one. */
    async profile(actor: Actor): Promise<Profile> {
      return toProfile(actor, await findPlayer(deps.db, actor.playerKey));
    },

    /**
     * Saves part of the profile. A made-up name (`nameChosen: false`) never replaces a chosen one,
     * so a game that names a newcomer can't undo a name picked in another game.
     */
    async update(actor: Actor, patch: UpdateProfileRequest): Promise<Profile> {
      const id = actor.playerKey;
      if (patch.displayName !== undefined && hasProfanity(patch.displayName)) {
        throw new AppError('VALIDATION', 400, "That name isn't allowed. Please pick another one.");
      }
      // Stored (and checked) before the transaction: it's idempotent and content-addressed.
      const drawingId =
        patch.drawing === undefined || patch.drawing === null
          ? patch.drawing
          : await deps.avatars.store(patch.drawing);

      await deps.db.transaction(async (tx) => {
        const current = await findPlayerForUpdate(tx, id);
        let displayName = current?.displayName ?? null;
        let nameChosen = current?.nameChosen ?? false;
        if (patch.displayName !== undefined) {
          const chosen = patch.nameChosen ?? true;
          if (chosen || !nameChosen) {
            displayName = patch.displayName;
            nameChosen = chosen;
          }
        }
        await savePlayer(tx, id, {
          displayName,
          nameChosen,
          drawingId: drawingId === undefined ? (current?.drawingId ?? null) : drawingId,
        });
      });
      return toProfile(actor, await findPlayer(deps.db, id));
    },
  };
}

export type PlayersService = ReturnType<typeof createPlayersService>;
