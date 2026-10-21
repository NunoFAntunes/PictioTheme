/**
 * Who is making a request (rule B13). Services take an `Actor`, never a Fastify request.
 *
 * `playerKey` is the player's row (`players.id`), whatever proved who they are: every game, every
 * stored record and the profile go by it (docs/technical/decisions.md D13). A guest's is the id in
 * their cookie, made together with the guest. An account will resolve to the row it is linked to
 * (`players.user_id`), so a guest who signs up stays the same player, on every device.
 */
export type Actor = { kind: 'guest' | 'user'; playerKey: string };

/**
 * The id a player has in rooms and in stored records (votes, reports, jobs, match results):
 * `g_<players.id>`, for guests and accounts alike. The `g_` is historical; it never says how the
 * player signed in (that's `actor.kind`).
 */
export function playerIdOf(actor: Actor): string {
  return `g_${actor.playerKey}`;
}
