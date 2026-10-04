import { AvatarId, DisplayName, RoomCode } from '@pictiotheme/protocol';
import { jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/**
 * Guest identities and WebSocket join tokens.
 * A join token is a 60s HS256 JWT that binds a player identity to one room. The WebSocket
 * upgrade checks it, so the realtime layer never reads sessions (docs/technical/architecture.md).
 */

const AUDIENCE = 'pictiotheme:ws';
const JOIN_TOKEN_TTL = '60s';

export const JoinClaims = z.object({
  roomCode: RoomCode,
  playerId: z.string().min(1).max(64),
  displayName: DisplayName,
  avatar: AvatarId,
  isRegistered: z.boolean(),
});
export type JoinClaims = z.infer<typeof JoinClaims>;

export function createAuthService(deps: { secret: string }) {
  const key = new TextEncoder().encode(deps.secret);

  return {
    newGuestId(): string {
      return randomUUID();
    },

    async issueJoinToken(claims: JoinClaims): Promise<string> {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(JOIN_TOKEN_TTL)
        .sign(key);
    },

    /** The claims, or null for anything invalid, expired, or signed with another key. */
    async verifyJoinToken(token: string): Promise<JoinClaims | null> {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          audience: AUDIENCE,
        });
        const parsed = JoinClaims.safeParse(payload);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
