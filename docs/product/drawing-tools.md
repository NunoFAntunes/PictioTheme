# Drawing Tools

The canvas is half the game, so it needs to feel responsive and capable without overwhelming casual players. Approach: **simple by default, with power one click away.**

## Toolbar

```
┌────────────────────────────────────────────────────────────────────────┐
│ [✏️ Brush][🧽 Eraser][🪣 Fill][▭ Shapes ▾]  │ Size ●──○── 12  │ Opacity ●───○ 80% │
│ ■■■■■■■■■■■■■■■■ (palette)  [🎨 picker]  [💧 eyedropper] │ ↶ ↷ 🗑 │
└────────────────────────────────────────────────────────────────────────┘
```

## Feature list

### v1 (must-have)

| Tool | Details |
|---|---|
| **Brush** | Round brush, smooth lines. Size 1–64 px (slider + presets S/M/L/XL). Opacity 5–100% |
| **Colour palette** | 24 preset swatches (good contrast, includes skin tones and black/white/greys) |
| **Colour picker** | A colour wheel (hue ring around a saturation/brightness square) with a hex field, in the [colour popover](#picking-and-sampling-colours). The last 8 picked colours are kept there as "recent" swatches. The system picker stays one click away in the popover |
| **Eyedropper** | Pick up a colour from the canvas: `Alt`+click or a right-click. See [below](#picking-and-sampling-colours) |
| **Eraser** | Same size control. Erases to transparent/background |
| **Fill bucket** | Flood fill with tolerance, grown 1 px so it tucks under a stroke's soft edge. Runs on the rasterized canvas (see technical notes) |
| **Undo / Redo** | At least 50 steps. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z |
| **Clear canvas** | Asks for confirmation. Can be undone |
| **Cursor preview** | A ring at the pointer, the exact size a stroke will be on screen. See [below](#cursor-preview) |

### v1.1 (nice-to-have)

| Tool | Details |
|---|---|
| **Shapes** | Line, rectangle, ellipse (outline or filled). Shift locks to straight lines / squares / circles |
| **Pressure sensitivity** | With a stylus or Apple Pencil, size and/or opacity follow `PointerEvent.pressure` |
| **Brush types** | Marker (hard edge), pencil (textured), highlighter (multiply blend), spray |
| **Background colour** | Set the canvas background |

### Later

Layers (background + sketch), zoom/pan for the drawer, symmetry mode, stickers (deliberately not included at first because they'd make drawing too easy).

## Opacity done right

A common bug: drawing a semi-transparent stroke as overlapping segments makes the overlaps darker, so the stroke ends up blotchy. Instead, **each stroke is rendered at full opacity onto a temporary layer, which is then composited onto the main canvas at the stroke's opacity.** The whole stroke has one even transparency, the way it does in real drawing apps.

## Adjusting size and opacity

Drag on the canvas to change the brush without reaching for the toolbar (Photoshop/Krita style):

| Gesture | Effect |
|---|---|
| **Right-button drag** | ↔ size (right = bigger), ↕ opacity (up = more opaque) |
| **Ctrl + drag** (⌘ + drag on Mac) | The same, for trackpads where a right-drag is awkward |
| Pen barrel button + drag | The same (browsers report the barrel button as the right button) |
| `Esc` during the drag | Put the settings back as they were |

- The gesture **locks to one axis** after 6 px of movement, so a size change never nudges opacity.
- A press that never reaches those 6 px (and lasts < 300 ms) is a click, not a drag: it [samples the colour](#picking-and-sampling-colours) instead.
- Size is exponential: it doubles every 50 px, so small sizes are easy to fine-tune and the full 1–64 range is ~300 px. Opacity sweeps 5–100% over 200 px.
- On **Fill**, the horizontal drag changes tolerance (0–255) instead, and the toolbar shows a tolerance slider.
- Applies to Brush and Eraser (eraser opacity = partial erase). Touch has no right button: the toolbar's sliders do it (a long-press opens the colours instead).
- The context menu is blocked on the canvas only while it's your turn to draw.

## Picking and sampling colours

Two jobs, two gestures, both without leaving the canvas.

**Sampling** (eyedropper): pick up a colour that's already on the canvas.

| Gesture | Effect |
|---|---|
| **Hold `Alt`** (`⌥` on Mac) | The ring becomes a swatch of the colour under the pointer, labelled with its hex code |
| **`Alt` + click**, or drag | Picks that colour (dragging keeps picking as you move) |
| **Right-click** (or Ctrl/⌘ + click, or a pen barrel-button tap) | Picks the colour where you clicked. It counts only if it's quick (< 300 ms) and doesn't move far enough to start a size/opacity drag (6 px) |

- Samples one exact pixel of what you see (blended over the white board), not an average, so anti-aliased edges don't muddy it. Blank canvas samples white.
- Only the colour changes. Size and opacity stay. On the eraser it switches to the brush, as a palette click does.
- `Alt` alone opens Firefox's menu bar on Windows, so the canvas swallows it while the pointer is over the canvas.
- An accidental right-click sample is one `X` away from undone.

**Picking** a new colour:

| Key | Effect |
|---|---|
| **`X`** | Swap to the previous colour (and back again). Outline in black, fill in colour, back to black |
| **`C`**, a **middle-click**, a **long-press** (touch and pen), or the toolbar's wheel button | Open the colours, with the wheel centred on the pointer (or the board's centre): the colour wheel with the last 8 recent colours on a ring around it, a hex field, the screen eyedropper (Chromium), the system picker, 7 shades of the current colour and the 24 swatches. A swatch, or a hex code and `Enter`, picks and closes it. `C` again, another middle-click or a click elsewhere closes it without drawing, keeping a colour set on the wheel. `Esc` closes it and puts the colour back as it was |
| **Hold** `C`, the middle button or the long-press, move, let go | What's under the pointer previews; letting go over it picks it and closes. Over the wheel, the **direction** from its centre picks the **hue** (anywhere from 16 px out to just past the recent colours, over the square too, which dims and sits out), keeping the colour's saturation and brightness, but lifted to 60% when the colour is too grey or dark for a hue to show (black flicked toward red gives a red). A recent colour, shade or swatch under the pointer is that colour. Letting go in the 16 px centre or off the popover closes it unchanged. Letting go without moving (under 10 px) leaves it open, as a click; fine-tune saturation and brightness on the square then |

Every way of picking a colour (palette, popover, eyedropper, `X`, the wheel when the popover closes, the system picker when it closes) adds it to the recent colours, and the ring flashes with the new ink and its hex code. Dragging on the wheel or the system picker previews live without filling the recent list.

The wheel: drag the ring for the hue (red at the top, clockwise) and the square for saturation (left to right) and brightness (bottom to top). Each part is also a keyboard slider (arrow keys, `Shift` for bigger steps). Dragging through greys or black keeps the hue. Where the board is narrow (the deck cover pad) the swatches sit under the wheel instead of beside it, and the popover scrolls if it still doesn't fit. While a hold is previewing, the shades stay those of the colour it opened with, so they don't shift under the pointer. Swatches are 36 px on touch screens.

The middle button is free on the canvas for now, so a middle-click mirrors `C`. Many people have no middle button (Mac trackpads, the Magic Mouse, pens), so it's only a quicker way in. Its defaults (autoscroll on Windows, pasting on Linux) are blocked over the canvas. If zoom and pan arrive, a middle *drag* should pan and a middle *click* keep opening the colours, the same click/drag split the right button uses.

Touch has no `Alt` or right button, so a **long-press** (500 ms without moving) opens the colours under the finger or pen, and the toolbar's 💧 samples. So that holding still never leaves a mark, a finger or pen stroke only starts once it moves a few pixels (10 px for a finger, 4 px for a pen) and is drawn from where it landed; a tap still draws a dot (or fills).

## Cursor preview

A ring at the pointer shows the **actual on-screen size** of the next stroke (the logical size scaled to how big the canvas is drawn). The eraser's ring is dashed.

Whenever size, opacity, tolerance or the tool changes (drag, keyboard or toolbar slider), the ring is briefly **filled with the real colour at the real opacity** and labelled "24 px · 60%". During a drag it stays pinned where the drag began, so you see the size grow under a fixed point. If the pointer isn't over the canvas (e.g. you're using the slider), it appears at the canvas centre.

## Keyboard shortcuts

Size and opacity keys match the **physical key**, so they work on any layout (on Portuguese, German or Spanish keyboards `[` `]` need AltGr, and AZERTY digits need Shift).

| Key | Action |
|---|---|
| `B` / `E` / `F` | Brush / Eraser / Fill |
| `[` / `]` (or `-` / `=`) | Smaller / larger brush, ~19% per press (four presses double it). On Fill: tolerance ±8 |
| `Shift` + `[` / `]` | Halve / double the size. On Fill: tolerance ±32 |
| `1`–`9`, `0` | Opacity 10%–90%, 100% (number row or numpad) |
| `Alt` (hold) + click | Eyedropper. A quick right-click also samples |
| `X` | Swap to the previous colour |
| `C` (or middle-click) | Colour popover at the pointer |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / Redo |
| `Shift` + drag | Straight line (planned) |

## Feel and performance targets

- **Input-to-ink locally: < 16 ms** (draw on the next frame. Never wait for the server).
- **Drawer-to-viewer latency: < 150 ms** p95 on normal connections.
- Smoothing: stroke stabilization (e.g. Catmull-Rom curves or a small moving average) with a "smoothing" slider.
- Use Pointer Events so mouse, touch, and stylus all work. Use `touch-action: none` on the canvas so drawing doesn't scroll the page on mobile.
- The canvas has a fixed **logical resolution** (e.g. 1200×900, 4:3) scaled to fit any screen, so drawings look the same for everyone.

## Other pads

The **deck cover pad** uses this same toolbar, shortcuts and canvas input on a local 600×800 canvas. The **avatar pad** keeps a reduced toolbar (3 tools, 3 sizes, 15 colours, undo, start over): a 128 px avatar doesn't need more.

## Touch screens

On touch screens (`pointer: coarse`) the toolbar's buttons grow to 44 px, swatches to 36 px and sliders get longer, the keyboard tip is hidden, and the cover pad is drawn bigger. The toolbar wraps onto more rows when it doesn't fit. Mouse users keep the compact bar.

Touch has no Alt key or right button, so everything they do has a visible control: size and opacity have sliders, and **💧** in the toolbar arms the eyedropper: the next press on the canvas picks up the colour under it (dragging keeps sampling), then 💧 turns itself off. It works with a mouse too.

## Touch and stylus

Tablets send several pointers at once (a pen, a palm resting on the glass, a second finger), so the canvas keeps one in charge (`engine/pointer-gate.ts`):

- **One pointer draws at a time.** Another pointer landing, moving or lifting mid-stroke is ignored, so a palm can't add points to a stroke or end it.
- **Palm rejection.** Once a pen has been seen on the page (a press, or Apple Pencil hovering above the glass), touches no longer draw. Fingers still work on everything else. Without a pen, fingers draw normally.
- **Pressure.** Only a pen's pressure is recorded. Fingers and mice record a flat 0.5 and perfect-freehand simulates pressure from speed, so a screen that reports a constant touch pressure doesn't draw fat lines.
- **No page movement while drawing.** The canvas has `touch-action: none`, the page has `touch-action: manipulation` (no double-tap zoom), the room page never scrolls (only its panels do), and long-press on the board doesn't select text or open the iOS callout.

## Mobile

- Phones get the "bigger screen" page instead (next-features.md, decided 2026-10-03). The notes below are for a possible phone guess-only mode later.
- Guessing on a phone must work well. Drawing on a phone should work: the toolbar collapses into a bottom sheet, with size and opacity in a popover.
- The palette shows 8 swatches plus the picker on small screens.

How strokes are captured, sent, and replayed is covered in [../technical/realtime-protocol.md](../technical/realtime-protocol.md#drawing-sync).
