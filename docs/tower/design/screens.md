# Screens

Layout only. The look is in [visual-identity.md](visual-identity.md). Target: 1280×720 and up (PC), and tablets in landscape from 1024×768. Phones and portrait tablets get a "Doodle Tower needs a bigger screen" gate.

## 1. Home

Logo, **Create room**, **Join with code** (`ABC-DEF`, same format and rules as DoodleWhirl), name and avatar. The avatar is drawn, like in DoodleWhirl, but the editor is restyled.

## 2. Waiting room

```
┌─────────────────────────────────────────────────────────────────────┐
│  ROOM ABC-DEF   [copy invite link]                       ⚙ settings │
├──────────────────────────┬──────────────────────────────────────────┤
│  🟠 ORANGE CREW (3)      │  🔵 TEAL CREW (2)                        │
│  ┌──┐ Ana (host)         │  ┌──┐ Rui                                │
│  ┌──┐ Bea                │  ┌──┐ Zé                                 │
│  ┌──┐ Carl               │                                          │
│  [ join Orange ]         │  [ join Teal ]                           │
├──────────────────────────┴──────────────────────────────────────────┤
│  Words: Tower Mix ▾   Height: medium ▾   Round: 60s ▾   Steals: on  │
│                    [ Shuffle crews ]   [ START ]  (needs 2+ each)   │
└─────────────────────────────────────────────────────────────────────┘
```

The host can drag players between crews.

## 3. Game: guesser

Reworked on 2026-10-20: **the two towers are the show.** They take most of the width, so pieces falling off either side stay in view, and both are framed the same way (the placer's whole reach, so the plinth keeps its size and nothing zooms when you start placing). The middle column is narrower and holds only your crew's things.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ 🟠 Orange ▓▓▓▓▓▓░░ 4.2 m      TOP OUT 10 M  14:12      3.1 m ▓▓▓▓░░░░ Teal 🔵 │
├──────────────────────────┬──────────────────┬──────────────────────────────────┤
│ ● Your tower             │ YOUR CREW  _ _ E 42│ ● Teal tower       ┌──────────┐ │
│                          │ ┌──────────────┐ │                    │🦝 STEAL 38│ │
│        (sky, wide)       │ │ your crew's  │ │                    │ (small)  │ │
│ ─ ─ ─ 🎀 top-out line ─ ─│ │   drawing    │ │ ─ ─ ─ 🎀 ─ ─ ─ ─ ─ └──────────┘ │
│            ┌─┐           │ └──────────────┘ │                                  │
│           ▟███▙          │ ┌──────────────┐ │             ▄▟▙                  │
│        ▔▔▔▔▔▔▔▔▔         │ │ [guess…] GUESS│ │          ▔▔▔▔▔▔▔▔▔               │
│   villagers watching     │ │ ◀ ▶ ⟲ ⟳ ⬇ DROP│ │                                  │
│                          │ └──────────────┘ │                                  │
└──────────────────────────┴──────────────────┴──────────────────────────────────┘
```

- Your tower is always on the left (framed in your crew's colour), the other crew's on the right, whichever crew you're in. Each tower panel shows its queue, who's placing and their time, a dazed overlay during a fumble, and a topping-out countdown when it's above the line. Nothing else ever sits at the bottom of a tower.
- The middle column, top to bottom: your crew's drawing (the word or the letter mask, the drawer's name, the time left), then the **play card**. The board is as big as the column allows without pushing the card off the screen; any space left over is at the bottom.
- **The play card flips.** Its front is the drawing tools (for the drawer); its back is the guess line and the placing controls (for everyone else). It turns over by itself when you start or stop drawing.
- One guess line serves both drawings. There's **no guess log and no chat**: a "so close!" tag pops over the guess line for a moment, and that's all.
- **The other crew's drawing** hangs small in the top corner of their tower's sky, labelled "🦝 STEAL IT" (or the crew's name when steals are off), with its drawer and timer. No hints for thieves.
- Your crew's drawing shows "Hint soon…" until the letter mask appears at a third of the round.

## 4. Game: drawer

Your drawing is the board in the middle, with the word on it. The play card is turned to its front: the toolbar in the Tower style and, under it, a **live piece preview**, the filled silhouette the drawing would become right now, against a ruler of the platform's width. Both towers stay visible. You can't guess while you draw.

Drawing tools: brush (with sizes), eraser, a **paint bucket**, undo, clear, a short colour palette. The bucket only colours in **closed shapes**: tapping the background, or a shape with a gap, does nothing but say so ("The bucket only fills closed shapes"). It's paint only: enclosed areas are solid in the piece anyway ([piece-pipeline.md](../technical/piece-pipeline.md)), and the colour shows on the piece.

**Colour it in**: when a brush stroke closes a new shape, a pill of seven bright colours (yellow, orange, red, pink, purple, blue, green) pops up over it, and one tap fills it, like the bucket. It's offered only for a new shape: one that was open before the stroke, or one the stroke cut well down (a window drawn in a house), and not for tiny loops or a squiggle inside a shape that's already closed. The next stroke, undo, Escape or six seconds put it away.

## 5. Build or Send (the drawer)

When your drawing is guessed, the card flips over (the solver is drawing now) and this pops up over the middle column. A stolen piece pops up for the thief instead.

```
            ┌──────────────────────────────────────────┐
            │      Bea got it!  "WATERMELON"   ⏱ 4     │
            │                                          │
            │             ◖█████████◗   ← the piece     │
            │                                          │
            │  [ 🧱 KEEP & PLACE ]  [ 💣 SEND TO TEAL ] │
            └──────────────────────────────────────────┘
```

Teammates see a "Cy is deciding…" line instead of buttons.

## 6. Placing

You place on your own tower, on the left. The placing controls are on the back of the play card, under the guess line: buttons (◀ ▶ ⟲ ⟳ ⬇ DROP, for tablets) with their keys beside them (← → move, ↑ rotate clockwise, ↓ faster, Space drops). They're always there, greyed out, so the card never jumps; they light up while you're placing, and the guess line is disabled for those 15s so the keys reach the tower. The piece floats down under a bunch of balloons, with a guide line down to the tower. Everyone else sees it move in the tower panel as normal.

## 7. Results

Both final towers side by side, zoomable. Hovering a piece shows its word, its drawer, and "stolen" or "sent" tags. Award cards. **Rematch** / **Shuffle crews** / **Leave**. **Share**: a PNG of the winning tower, rendered on the server.
