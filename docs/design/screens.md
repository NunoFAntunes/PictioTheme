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
│   │  Avatar: [draw pad]   │   │  [ ABC-DEF ]  [Join]     │   │
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

**Built so far:** name, public/private, a search box, and a grid of deck covers in sections: "Your decks" (✨ yours, with ✏️ to redraw the cover), "Featured" (seasonal curated decks) and "More decks", 4 per section until "Show all". Each tile has the [back cover](../product/decks.md#back-cover), title, card count and 🤪. Searching matches titles and tags of all public decks, typos included. No ratings or play counts yet, and the other settings are changed in the waiting room.

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

- The **drawn avatar is the focus**: shown large (64 px), with the name in small text beside it, then the status, the guess bubble and the score. Status: ✏️ drawing (badge on the avatar) / ✅ guessed / 💤 disconnected (greyed out).
- **Latest guess bubble** under each player when guess visibility is ON. It fades out after ~3s. Close guesses show as `█████` in red (the guesser sees their own text in red).
- Crown on the host's avatar. The host gets a ⋯ menu on each player (kick, make host).
- Score changes animate (+180) at the end of each turn.
- **In a match the list is a leaderboard**: sorted by score with a `#rank` beside it (ties share a rank and keep join order). When the order changes the rows slide to their new places, and whoever overtook someone pops with a brand-coloured ring as they pass. No motion with `prefers-reduced-motion`. The sort is display only: the drawing order is still the server's join-order rotation.

Drawer's view: the header shows the **full word** (e.g. "VAMPIRE ON A UNICYCLE" with a 🤪 tag) instead of blanks. The guess input is disabled and reads "You're drawing!".

**Tablets in portrait** (built; any screen under 1024 px wide, while tablets in landscape and laptops get the three columns): the canvas takes the top of the screen, at most ~56% of its height. The drawer's toolbar sits right under it. Below that, tabs switch between [Guesses] (the default, with a count of new lines while you're on Players) and [Players], and the guess input is pinned at the bottom. Mid-match the page doesn't scroll, only the tab content. The lobby also stacks below 1024 px, "Join with a code" first.

**Phones** get the "bigger screen" page (`features/phone-gate`, [next-features.md](../planning/next-features.md) 1.3). If a phone guess-only mode comes later: the player list becomes a horizontal avatar strip above the canvas with the guess bubbles shown as small overlays.

## 5. Turn transitions

- **Choose card overlay** (drawer): three big cards with a difficulty badge and points multiplier. A 10s ring timer. Under each card, 👍/👎 to rate it without picking it (card quality metrics).
- **Waiting overlay** (others): "Nuno is choosing a card…".
- **Card animation**: a deck sits in the bottom-left of the board during choosing and reveal. When a turn starts it shuffles, deals the cards onto the table, and flips them face up for the drawer (others see them face down). The card backs are the deck's drawn back cover, or its default cover (the title on a coloured, striped tile) for decks without one. The picked card pops and the rest fall away. The animation is skipped with `prefers-reduced-motion` or when joining with under 5s left.
- **Reveal overlay** (everyone): "The word was **VAMPIRE ON A UNICYCLE**", with per-player points earned. There is a small "🚩 unfair card" link.

## 6. Results

The deck's cover and title next to the heading (with 🚩 to report the deck), podium (top 3 with avatars), full table, awards, drawing gallery strip, and buttons [Play again] [Change deck] [Lobby]. Logged-in users see "Rate deck 👍 👎".

## 7. Deck generation

A form, then a streaming progress view ("Brewing easy cards… medium… silly…"), then a review grid where each card has an ✕ to remove it, then [Publish & use].

**Built so far:** the form, then a polled progress line above the 3:4 cover pad with the full drawing toolbar (bigger targets on touch screens), [Skip] and [Done ✓]. No review grid yet.

## Accessibility

- Colour is never the only signal: close guesses are red **and** redacted **and** carry an icon/label ("close") for screen readers.
- Everything except drawing works with the keyboard. Timers are announced via `aria-live` at 10s.
- Colour-blind friendly palette for UI states. The drawing palette has labelled swatches (via tooltip).
