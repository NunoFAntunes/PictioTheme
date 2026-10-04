# Security, Abuse and Moderation

## Threats and mitigations

### Cheating

| Threat | Mitigation |
|---|---|
| Reading the answer from network traffic / devtools | The word is **never sent** to guessers. They get only the mask and hints. The drawer and solved players get it |
| Solved player leaks the answer in chat | Messages from solved players only go to other solved players and the drawer |
| Drawer writes the word as letters on the canvas | Social rule plus a "report drawing" button. A host can skip the turn. (Automatic OCR detection is possible later) |
| Typing many guesses to brute-force | Rate limit (3 guesses/s, burst 5). Close guesses don't confirm which part is right |
| Fake score / spoofed messages | The server is authoritative. Clients only send intents, and every message is checked against the sender's role and the current phase |
| Joining a private room by guessing codes | 191M code space, rate-limit join attempts per IP and session (e.g. 10/min). Codes expire when rooms close |

### Abuse

| Threat | Mitigation |
|---|---|
| Offensive display names / room names | Profanity filter (with leetspeak normalization) on create. Report option. **Built:** offensive names are refused at room create and join (`hasProfanity` in game-core, on the `obscenity` English list); no report option yet |
| Offensive drawings in public rooms | Vote kick, report drawing (stores a snapshot of the stroke list for review), host kick |
| Offensive chat | Filter (mask words), mute player (per-viewer), report. **Built:** chat, solvers' chat and guesses are masked for other players (the whole word becomes asterisks); the guesser sees what they typed. Not yet: mute, report |
| Spam rooms | Max 1 active room per session as host. Rate limit room creation |
| Offensive generated decks | Prompt rules + blocklist (**built**: theme and notes before the job, then cards, alternates, title and tags, `generation/content-check.ts`) + family-friendly default + report → auto-hide at 3 unique reports → moderator queue. **Built:** `POST /api/decks/:id/reports` with reason `cover` or `content`; one report per player, reason and cover (`deck_reports`). Cover reports hide the cover (`decks.cover_hidden`, the default cover shows); content reports hide the deck (`visibility = 'hidden'`). Not yet: the moderator queue, per-IP limits on reports (throwaway guest sessions could hide a deck) |
| Credit farming via throwaway accounts | Free generations require a verified email/OAuth account. Device/IP heuristics. Disposable-email blocklist. **Now (guests generate):** 1 deck per player and 3 per IP in any 24 h, and a global daily budget (`GENERATION_*` config); IPs are stored only as an HMAC |
| Prompt injection via theme/notes | User input goes in clearly delimited fields, the output schema is enforced, and output is validated deterministically. The model has no tools, so an injection can only affect the deck content, which is filtered anyway |
| WebSocket flooding / huge stroke payloads | Message size cap (e.g. 16 KB), per-connection message rate cap, points-per-turn cap, schema validation |

### Payments

- Credits are granted only by verified Stripe webhooks (signature check), idempotent on the event ID.
- No card data ever touches our servers (Stripe Checkout).
- Refund or chargeback webhooks → negative ledger entry. Accounts with a negative balance can't generate.

## Auth and sessions

- Guest: HttpOnly, Secure, SameSite=Lax signed cookie holding `guestId`. No personal data.
- Registered users: session cookies via the auth library. CSRF protection on mutating REST endpoints.
- Realtime: a short-lived (60s) **join token** (JWT signed with a server secret) per room join. It is checked on WebSocket upgrade, and it binds the player identity to the room.

## Privacy (GDPR, since the user is EU-based)

- Collect the minimum: email (if registered), display name, avatar choice, purchase records.
- Drawings and chat are not stored after a room ends, **except** snapshots attached to reports (kept 30 days).
- Account deletion: deletes the user and anonymizes their decks (they stay in the library as "by a former player").
- Cookie banner only if analytics cookies are used. Prefer cookieless analytics (Plausible, or self-hosted).
- Privacy policy and terms before launch. The terms should say generated decks are public and licensed to the platform.
- Age: if children are a target audience (family decks), avoid collecting data from under-16s. Guest play without accounts helps a lot. No open public chat for unregistered young users would be safest. See open questions.

## Moderation tooling (minimum)

- Admin page: list reports (decks, cards, drawings, users), with actions hide / restore / ban / delete.
- Auto-hide thresholds: deck hidden at ≥ 3 unique reports (or ≥ 20% of plays), and cards removed at ≥ 5 "unfair/inappropriate" flags. Reviewed later. **Built:** the 3-report rule for a deck's content and for its cover (`REPORTS_TO_HIDE` in `decks.service.ts`). Rooms already playing a deck keep it, and its cover, until they load it again.
