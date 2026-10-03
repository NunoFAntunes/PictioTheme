# Vision

## Pitch

> **Draw it. Guess it. Theme it.**
> A multiplayer drawing game where every match has a theme, with endless AI-generated decks and a Silly Mode that makes everyone laugh.

Existing drawing games (skribbl.io, Gartic Phone, Drawasaurus) mostly use generic word lists or custom lists typed in by hand. PictioTheme's angle is **themed, curated, shareable decks**, generated on demand by AI and improved by the community over time. A Halloween party gets Halloween prompts. A team offsite gets office-themed prompts. A family night gets an easy deck the kids can draw.

## Who it's for

| Player | Needs | Implication |
|---|---|---|
| **Party host** (friends, family, remote team) | Set up a private game fast, with a theme that fits the occasion | Private rooms, short codes, deck search, no-signup guest play |
| **Casual drop-in player** | Jump into a game in under 10 seconds | Guest mode, public lobby list, quick join |
| **Deck creator** | Make a deck for a niche theme and share it | AI generation for logged-in users; decks become public |
| **Streamer / classroom** | Control what's shown on screen | Host can hide guesses; family-safe content |

## Core loop

```
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │  Pick name   │ →  │  Join/host   │ →  │   Play a     │ →  │  Results &   │
 │  & avatar    │    │    room      │    │    match     │    │  play again  │
 └──────────────┘    └──────────────┘    └──────┬───────┘    └──────┬───────┘
                                                │ (each turn)        │
                                   ┌────────────▼────────────┐       │
                                   │ Drawer picks 1 of 3 cards│       │
                                   │ Drawer draws, others     │       │
                                   │ guess; points awarded    │◄──────┘
                                   └─────────────────────────┘
```

Secondary loop (logged-in users): **search for a theme → not found → generate a deck → play it → the deck is now in the library for everyone.** Every generated deck makes the library bigger for all players, which is the long-term growth engine.

## Design principles

1. **Ten seconds to fun.** A guest who opens a share link should be drawing or guessing within 10 seconds. No forced signup.
2. **The server is the referee.** The secret word never reaches guessers' browsers. Scoring and guess checks run only on the server.
3. **Don't spoil the answer.** Near-miss guesses are redacted so other players can't copy them.
4. **The canvas should feel good.** Smooth strokes, low latency, real brush controls. Drawing is half the game.
5. **Decks are a shared library.** Generate once, play forever. Before generating a deck, show people what already exists.
6. **Monetize creation, not play.** Playing is always free. Only AI generation, which actually costs money, is limited.

## Glossary

| Term | Meaning |
|---|---|
| **Room** | A game session with a name, a code (`ABC-DEF`), a host, and up to N players |
| **Public / private room** | Public rooms are listed in the lobby. Private rooms can only be joined with the code or a link |
| **Host** | The player who created the room (host rights can be transferred) and controls its settings |
| **Deck** | A named, themed collection of cards (e.g. "Spooky Halloween") |
| **Card / prompt** | One thing to draw (e.g. "Haunted house"), with a difficulty and accepted answers |
| **Difficulty** | `easy`, `medium`, or `hard`. A host can enable several at once |
| **Silly Mode** | Adds absurd combination prompts ("Ghost plowing a field") from the deck's silly pool |
| **Match** | One full game: several rounds |
| **Round** | Every player draws once |
| **Turn** | One player draws one card while the others guess |
| **Close guess** | A guess that is nearly right. It is redacted for others and shown in red |
| **Guest** | A player without an account. Can play and host, but cannot generate decks |
| **Credit** | One AI deck generation |
