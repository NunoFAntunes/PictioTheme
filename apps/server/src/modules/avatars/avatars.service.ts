import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE_PX,
  type AvatarId,
  type AvatarImage,
} from '@pictiotheme/protocol';
import type { Db } from '../../db/client';
import { AppError } from '../../lib/errors';
import { contentIdOf, decodePngDataUrl } from '../../lib/png';
import { findAvatarPng, upsertAvatar } from './avatars.repository';

const invalidAvatar = () =>
  new AppError('VALIDATION', 400, `Avatars must be ${AVATAR_SIZE_PX}×${AVATAR_SIZE_PX} PNG images`);

/** Decodes the avatar's PNG, checking it is AVATAR_SIZE_PX square and within the size limit. */
export function decodeAvatar(dataUrl: AvatarImage): Buffer {
  const png = decodePngDataUrl(dataUrl, {
    width: AVATAR_SIZE_PX,
    height: AVATAR_SIZE_PX,
    maxBytes: AVATAR_MAX_BYTES,
  });
  if (!png) throw invalidAvatar();
  return png;
}

export function avatarIdOf(png: Buffer): AvatarId {
  return contentIdOf(png);
}

/** Drawn avatars. Rooms store them on join; anyone can fetch one by id. */
export function createAvatarsService(deps: { db: Db }) {
  return {
    /** Validates and stores the image, returning its id. Idempotent. */
    async store(dataUrl: AvatarImage): Promise<AvatarId> {
      const png = decodeAvatar(dataUrl);
      const id = avatarIdOf(png);
      await upsertAvatar(deps.db, id, png);
      return id;
    },

    async getPng(id: AvatarId): Promise<Buffer | null> {
      return findAvatarPng(deps.db, id);
    },
  };
}

export type AvatarsService = ReturnType<typeof createAvatarsService>;
