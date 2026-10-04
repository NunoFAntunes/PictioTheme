/**
 * Who is making a request (rule B13). Services take an `Actor`, never a Fastify request.
 * Registered users arrive with the auth module; v1 has guests only.
 */
export type Actor = { kind: 'guest'; guestId: string } | { kind: 'user'; userId: string };

/** The id a player has inside rooms. Stable across reconnects and tabs. */
export function playerIdOf(actor: Actor): string {
  return actor.kind === 'guest' ? `g_${actor.guestId}` : `u_${actor.userId}`;
}
