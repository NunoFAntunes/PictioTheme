# Screens

Low-fidelity wireframes. Desktop first, with mobile notes. Visual direction: playful, hand-drawn accents, high contrast, big touch targets.

## 1. Landing

```
┌──────────────────────────────────────────────────────────────┐
│  PictioTheme ✏️                                  [Sign in]   │
│                                                              │
│        Draw it. Guess it. Theme it.                          │
│        (animated doodle of a vampire on a unicycle)          │
│                                                              │
│   ┌───────────────────────┐   ┌──────────────────────────┐   │
│   │  Your name: [______]  │   │  Have a code?            │   │
│   │  Avatar: ◀ 🧛 ▶ 🎲     │   │  [ ABC-DEF ]  [Join]     │   │
│   │  [ Play as guest ▶ ]  │   │                          │   │
│   └───────────────────────┘   └──────────────────────────┘   │
│                                                              │
│   Popular themes this week: 🎃 Halloween  🍕 Food  🚀 Space   │
└──────────────────────────────────────────────────────────────┘
```

## 2. Lobby

```
┌──────────────────────────────────────────────────────────────┐
│  PictioTheme   [🔍 search rooms/themes]   🧛 Nuno ▾  💳 3     │
├──────────────────────────────────────────────────────────────┤
│  [ + Create room ]        Join private: [ ___-___ ] [Join]   │
│                                                              │
│  Public rooms                    filters: ☐ waiting ☐ space  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 🎃 Spooky Night     Halloween · E M 🤪   6/10  waiting │ ▶ │
│  │ 🍕 Pizza Party      Food · E          3/8   in game   │ ▶ │
│  │ 🚀 Space Cadets     Space · M H       9/10  waiting   │ ▶ │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## 3. Create room → deck picker

```
┌─ Create room ────────────────────────────────────────────────┐
│ Name [Nuno's room______]   ( ● Public  ○ Private )           │
│                                                              │
│ Deck  [🔍 halloween____________]                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ◉ Spooky Halloween   E40 M40 H30 🤪40  👍92%  1.2k plays│  │
│  │ ○ Kids Halloween     E60 M20         👍88%   430 plays │  │
│  │ ○ Horror Movies      M30 H40 🤪25    👍81%   210 plays │  │
│  │                                   [Preview cards]      │  │
│  └────────────────────────────────────────────────────────┘  │
│  Can't find it? [✨ Generate "halloween" deck] (2 free left) │
│                                                              │
│ Difficulty  [✓Easy] [✓Medium] [ Hard ]                       │
│ Silly Mode  [ON]   mix ──●──── 25%                           │
│ Rounds [3]  Draw time [80s]  Max players [10]                │
│ Guesses     ( ● Show  ○ Hide )   Hints [ON]                  │
│                                           [Create room ▶]    │
└──────────────────────────────────────────────────────────────┘
```

## 4. Game screen (the main one)

Players on the **left**, canvas in the **center**, guess feed and input on the **right**.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Round 2/3   ⏱ 0:47        _ _ _ _ _ _ _   _ _ _ _ _ _ _ _ _ (7, 9)  ⚙ │
├───────────────┬──────────────────────────────────────┬───────────────────┤
│ PLAYERS       │                                      │ GUESSES / CHAT    │
│               │                                      │                   │
│ 👑🧛 Nuno 820 │                                      │ Ana: bat          │
│   ✏️ drawing   │                                      │ Rui: vampire      │
│               │            (canvas 4:3)              │ Ana: ███████  ←red│
│ 🎃 Ana    610 │                                      │ 🎉 Rui guessed it!│
│   💬 ███████   │  ← red redacted close guess          │ Mia: dracula      │
│               │                                      │                   │
│ 🐺 Rui ✅ 540 │                                      │                   │
│   guessed!    │                                      │                   │
│               │                                      │                   │
│ 👻 Mia    300 │                                      │                   │
│   💬 dracula   │                                      │                   │
│               ├──────────────────────────────────────┤                   │
│               │ (toolbar: only visible to drawer)     │ [type guess…] ⏎  │
└───────────────┴──────────────────────────────────────┴───────────────────┘
```

Player list details:

- Avatar, name, score, and a status: ✏️ drawing / ✅ guessed / 💤 disconnected (greyed out).
- **Latest guess bubble** under each player when guess visibility is ON. It fades out after ~3s. Close guesses show as `█████` in red (the guesser sees their own text in red).
- Crown for the host. The host gets a ⋯ menu on each player (kick, make host).
- Score changes animate (+180) at the end of each turn.

Drawer's view: the header shows the **full word** (e.g. "VAMPIRE ON A UNICYCLE" with a 🤪 tag) instead of blanks. The guess input is disabled and reads "You're drawing!".

**Mobile**: the canvas takes the top of the screen. Below it, tabs switch between [Players] and [Guesses], and the guess input is pinned above the keyboard. The player list becomes a horizontal avatar strip above the canvas with the guess bubbles shown as small overlays.

## 5. Turn transitions

- **Choose card overlay** (drawer): three big cards with a difficulty badge and points multiplier. A 10s ring timer.
- **Waiting overlay** (others): "Nuno is choosing a card…".
- **Reveal overlay** (everyone): "The word was **VAMPIRE ON A UNICYCLE**", with per-player points earned. There is a small "🚩 unfair card" link.

## 6. Results

Podium (top 3 with avatars), full table, awards, drawing gallery strip, and buttons [Play again] [Change deck] [Lobby]. Logged-in users see "Rate deck 👍 👎".

## 7. Deck generation

A form, then a streaming progress view ("Brewing easy cards… medium… silly…"), then a review grid where each card has an ✕ to remove it, then [Publish & use].

## Accessibility

- Colour is never the only signal: close guesses are red **and** redacted **and** carry an icon/label ("close") for screen readers.
- Everything except drawing works with the keyboard. Timers are announced via `aria-live` at 10s.
- Colour-blind friendly palette for UI states. The drawing palette has labelled swatches (via tooltip).
