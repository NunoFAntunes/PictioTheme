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

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🟠 ▓▓▓▓▓▓▓░░ 71%   ⏱ 0:42   ───── 🎀 topping-out line ─────   48% ▓▓▓▓░░░░ 🔵 │
├───────────────┬────────────────────────────────────────┬───────────────────┤
│   │ crane     │  ORANGE DRAWING (in focus)  _ _ _ _ E  │ ┌───────────────┐ │
│   ▼           │                                        │ │ spy: Teal's   │ │
│               │                                        │ │ drawing   [⇥] │ │
│ ORANGE TOWER  │          (live strokes)                │ └───────────────┘ │
│    ┌─┐        │                                        │   TEAL TOWER      │
│   ▟███▙       │                                        │       ▄▟▙         │
│ ▔▔▔▔▔▔▔▔▔     │ ── crew feed (Orange only) ──          │   ▔▔▔▔▔▔▔▔▔       │
│ queue: 🧩 🧩   │ [ guess Orange's drawing…          ]   │   queue: 🧩       │
└───────────────┴────────────────────────────────────────┴───────────────────┘
```

- Your tower is always on the left, the other crew's on the right, whichever crew you're in.
- `Tab` swaps the large drawing and the spy window. The guess box label changes ("guess Teal's drawing… 🦝") and gets a stealing tint.
- Each tower panel shows its queue, a dazed overlay with a countdown during a fumble, and a topping-out countdown when it's above the line.

## 4. Game: drawer

The centre becomes the drawing board: the word at the top, the canvas, and a toolbar in the Tower style. In the corner there's a **live piece preview**, the filled silhouette the drawing would become right now. The spy window and both towers stay visible. The guess box is replaced by "Orange is guessing… 3 guesses".

Drawing tools: brush (with sizes), eraser, undo/redo, clear, a short colour palette. **No bucket fill**: enclosed areas are filled automatically when the piece is made ([piece-pipeline.md](../technical/piece-pipeline.md)).

## 5. Build or Send (solver)

```
            ┌──────────────────────────────────────────┐
            │      You got it!  "WATERMELON"   ⏱ 4     │
            │                                          │
            │             ◖█████████◗   ← the piece     │
            │                                          │
            │   [ 🧱 BUILD OURS ]   [ 💣 SEND TO TEAL ] │
            └──────────────────────────────────────────┘
```

Teammates see the same card with a "Bea is deciding…" label instead of buttons.

## 6. Placing

The placer's own tower panel grows to the centre (the drawings shrink to the sides for the 15s). The piece hangs from the crane hook, with a guide line down to the tower. The controls are shown as key caps on PC and as large buttons on touch (◀ ▶ ⟲ ⟳ ⬇ DROP). Everyone else sees the piece move in the tower panel as normal.

## 7. Results

Both final towers side by side, zoomable. Hovering a piece shows its word, its drawer, and "stolen" or "sent" tags. Award cards. **Rematch** / **Shuffle crews** / **Leave**. **Share**: a PNG of the winning tower, rendered on the server.
