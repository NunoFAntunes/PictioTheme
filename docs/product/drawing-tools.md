# Drawing Tools

The canvas is half the game, so it needs to feel responsive and capable without overwhelming casual players. Approach: **simple by default, with power one click away.**

## Toolbar

Under the canvas, one row of trays (`Toolbar.tsx`): tools and colours on the left, brush settings and history on the right.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [✏️Q 🪣W 🧽E] [■C ▪X 💧] [①②③④⑤] [▦▦ ▦▦▦▦▦▦▦▦▦ ▦▦▦]      [• ● ⬤ ⬤ SIZE [ ] ━━●━ 8 px ] [ ↶   ↷ ] │
│                                                       [         OPACITY ▒▒━━● 100%] [🗑 ⌨ ?] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Every tray in a line is the same height (72 px in the single row): the tools, the colour slots (tall paint chips) and the palette swatches grow to fill it. It needs about 1380 px, which a 1080p screen (or 4K at 150–200%) gives the board. Where the board is narrower (laptops) the right-hand group wraps under as a whole, and clear, ⌨ and ? line up beside undo and redo instead of under them, so the bar stays short.

- **Tools** (Q W E): hand-drawn pencil, bucket and eraser. The pencil's lead and the bucket's spill are the current colour. The chosen tool is a sticker: yellow, outlined, lifted and tilted, with a wiggle when picked (not with reduced motion).
- **Brush**: four size dots drawn at their relative size (dashed on the eraser), then size (a thin-to-thick track) and opacity stacked (the current colour from clear to solid over a checkerboard), each with its value. On Fill, tolerance replaces the size controls.
- **History**: big undo and redo arrows, greyed out when there's nothing to undo or redo. Clear (🗑), ⌨ and ? sit small under them. Clear is greyed out on a blank canvas, and asks first.
- **Colour**: the **ink well** is the current colour, big, at the current opacity, with the previous colour tucked behind it. Clicking the front opens the [colour popover](#picking-and-sampling-colours), and clicking the back swaps to it (as `X` does). Then the eyedropper (`S`), the [colour slots](#colour-slots) and the [palette](#colour-palette).
- **Keys on the buttons**: every control with a shortcut has a small keycap on its corner (Q, S, `[ ]`, C, X, 1–5, Ctrl Z…). ⌨ hides or shows them, remembered in this browser. **?** opens a short card with the canvas gestures that have no button (right-drag, Alt+click, holding Space or C…). Touch screens get no keycaps or ⌨, and ? lists the touch gestures instead.

## Colour palette

28 swatches in a **hue grid**: each column is a colour over a darker one, in three groups: neutrals (white, black, greys), the wheel from red round to pink (red, orange, yellow, lime, green, cyan, blue, violet, pink, with dark red, dark orange, mustard, olive, dark green, teal, navy, purple and magenta under them), and skin and earth tones. The colour popover shows the same grid in two bands of 7 columns.

## Feature list

### v1 (must-have)

| Tool | Details |
|---|---|
| **Brush** | Round brush, smooth lines. Size 1–64 px (slider + presets S/M/L/XL). Opacity 5–100% |
| **Colour palette** | 28 preset swatches in a [hue grid](#colour-palette) (includes skin tones and black/white/greys) |
| **Colour picker** | A colour wheel (hue ring around a saturation/brightness square) with a hex field, in the [colour popover](#picking-and-sampling-colours). The last 8 picked colours are kept there as "recent" swatches. The system picker stays one click away in the popover |
| **Eyedropper** | Pick up a colour from the canvas: `Alt`+click, or `S` (tap to arm, or hold) and click. See [below](#picking-and-sampling-colours) |
| **Eraser** | Same size control. Erases to transparent/background |
| **Fill bucket** | Flood fill with tolerance and opacity (a see-through fill is laid over what's there), grown 1 px so it tucks under a stroke's soft edge. Runs on the rasterized canvas (see technical notes) |
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
- A press that never reaches those 6 px does nothing. The right button used to sample on a quick click, but a hesitant size drag (press, nudge, let go) looked just like one and changed the colour by surprise, so sampling has its own keys now (`Alt`, `S`).
- Size is exponential: it doubles every 50 px, so small sizes are easy to fine-tune and the full 1–64 range is ~300 px. Opacity sweeps 5–100% over 200 px.
- On **Fill**, the horizontal drag changes tolerance (0–255) instead, and the toolbar shows a tolerance slider. ↕ still changes opacity.
- Applies to Brush, Eraser (eraser opacity = partial erase) and Fill. Touch has no right button: the toolbar's sliders do it (a long-press opens the colours instead).
- The context menu is blocked on the canvas only while it's your turn to draw.

## Picking and sampling colours

Two jobs, two gestures, both without leaving the canvas.

**Sampling** (eyedropper): pick up a colour that's already on the canvas.

| Gesture | Effect |
|---|---|
| **Hold `Alt`** (`⌥` on Mac) | The ring becomes a swatch of the colour under the pointer, labelled with its hex code |
| **`Alt` + click**, or drag | Picks that colour (dragging keeps picking as you move) |
| **`S`**, or the toolbar's dropper | Arms the eyedropper: the ring previews the colour under the pointer, the next click (or drag) picks, and the dropper turns itself off. `S` again puts it away |
| **Hold `S`** + click | The same, spring-loaded: letting go of `S` (after 300 ms) without clicking puts the dropper away |

- Samples one exact pixel of what you see (blended over the white board), not an average, so anti-aliased edges don't muddy it. Blank canvas samples white.
- Only the colour changes. Size and opacity stay. On the eraser it switches to the brush, as a palette click does.
- `Alt` alone opens Firefox's menu bar on Windows, so the canvas swallows it while the pointer is over the canvas. `S` is there for where `Alt` is awkward (Linux window managers take `Alt`+drag).
- `S` is the physical key under the tools (`S` on QWERTY and AZERTY), like Q W E.

**Picking** a new colour:

| Key | Effect |
|---|---|
| **`X`** | Swap to the previous colour (and back again). Outline in black, fill in colour, back to black |
| **`Space`**, **`C`**, a **middle-click**, a **long-press** (touch and pen), or the toolbar's ink well | Open the colours, with the wheel centred on the pointer (or the board's centre): the colour wheel with the last 8 recent colours on a ring around it, a hex field, the screen eyedropper (Chromium), the system picker, 7 shades of the current colour and the 28 swatches. A swatch, or a hex code and `Enter`, picks and closes it. `Space` or `C` again, another middle-click or a click elsewhere closes it without drawing, keeping a colour set on the wheel. `Esc` closes it and puts the colour back as it was |
| **Hold** `Space`, `C`, the middle button or the long-press, move, let go | What's under the pointer previews; letting go over it picks it and closes. Over the wheel, the **direction** from its centre picks the **hue** (anywhere from 16 px out to just past the recent colours, over the square too, which dims and sits out), keeping the colour's saturation and brightness, but lifted to 60% when the colour is too grey or dark for a hue to show (black flicked toward red gives a red). A recent colour, shade or swatch under the pointer is that colour. Letting go in the 16 px centre or off the popover closes it unchanged. Letting go without moving (under 10 px) leaves it open, as a click; fine-tune saturation and brightness on the square then |

Space is the thumb's key, so the wheel opens while the fingers stay on Q W E. It doesn't scroll the page, and it doesn't press the toolbar button you last clicked. It still presses a control you reached with Tab (one that shows its focus ring), and it types in text fields.

Every way of picking a colour (palette, popover, eyedropper, `X`, the wheel when the popover closes, the system picker when it closes) adds it to the recent colours, and the ring flashes with the new ink and its hex code. Dragging on the wheel or the system picker previews live without filling the recent list.

## Colour slots

Five slots, numbered like their keys, sit in the toolbar beside the palette: your own colours, one key away.

| Gesture | Effect |
|---|---|
| **`1`–`5`**, or click a slot | Switch to that colour (it joins the recent colours, and the eraser switches to the brush, as a palette click does) |
| **`Shift` + `1`–`5`**, **right-click** a slot, or **long-press** it (touch, pen) | Save the current colour there. The ring flashes "Saved to 3" |

- They start as black, red, blue, green and yellow, and are remembered in this browser (not per room), shared by the game board, the deck cover pad and the avatar pad.
- `6`–`9` and `0` do nothing. They used to set opacity; drag on the canvas for that (↕), or use the slider.

The wheel: drag the ring for the hue (red at the top, clockwise) and the square for saturation (left to right) and brightness (bottom to top). Each part is also a keyboard slider (arrow keys, `Shift` for bigger steps). Dragging through greys or black keeps the hue. Where the board is narrow (the deck cover pad) the swatches sit under the wheel instead of beside it, and the popover scrolls if it still doesn't fit. While a hold is previewing, the shades stay those of the colour it opened with, so they don't shift under the pointer. Swatches are 36 px on touch screens.

The middle button is free on the canvas for now, so a middle-click mirrors `C`. Many people have no middle button (Mac trackpads, the Magic Mouse, pens), so it's only a quicker way in. Its defaults (autoscroll on Windows, pasting on Linux) are blocked over the canvas. If zoom and pan arrive, a middle *drag* should pan and a middle *click* keep opening the colours, the same click/drag split the right button uses.

Touch has no `Alt` or right button, so a **long-press** (500 ms without moving) opens the colours under the finger or pen, and the toolbar's dropper samples. So that holding still never leaves a mark, a finger or pen stroke only starts once it moves a few pixels (10 px for a finger, 4 px for a pen) and is drawn from where it landed; a tap still draws a dot (or fills).

## Cursor preview

A ring at the pointer shows the **actual on-screen size** of the next stroke (the logical size scaled to how big the canvas is drawn). The eraser's ring is dashed.

Whenever size, opacity, tolerance or the tool changes (drag, keyboard or toolbar slider), the ring is briefly **filled with the real colour at the real opacity** and labelled "24 px · 60%". During a drag it stays pinned where the drag began, so you see the size grow under a fixed point. If the pointer isn't over the canvas (e.g. you're using the slider), it appears at the canvas centre.

## Keyboard shortcuts

Tool, size and colour-slot keys match the **physical key**, so they work on any layout: the tools are the three keys under the left hand's fingers (Q W E on QWERTY, A Z E on AZERTY, and the toolbar's keycaps show what your layout prints there, in Chromium). On Portuguese, German or Spanish keyboards `[` `]` need AltGr; on AZERTY the slot keys are the ones labelled `&` `é` `"` `'` `(`.

| Key | Action |
|---|---|
| `Q` / `W` / `E` | Brush / Fill / Eraser (`B` and `F` still work) |
| `[` / `]` (or `-` / `=`) | Smaller / larger brush, ~19% per press (four presses double it). On Fill: tolerance ±8 |
| `Shift` + `[` / `]` | Halve / double the size. On Fill: tolerance ±32 |
| `1`–`5` | Switch to that colour slot (number row or numpad) |
| `Shift` + `1`–`5` | Save the current colour to that slot |
| `S` (tap, or hold) + click, `Alt` (hold) + click | Eyedropper |
| `X` | Swap to the previous colour |
| `Space` or `C` (or middle-click) | Colour popover at the pointer |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / Redo |
| `Shift` + drag | Straight line (planned) |

## Feel and performance targets

- **Input-to-ink locally: < 16 ms** (draw on the next frame. Never wait for the server).
- **Drawer-to-viewer latency: < 150 ms** p95 on normal connections.
- Smoothing: stroke stabilization (e.g. Catmull-Rom curves or a small moving average) with a "smoothing" slider.
- Use Pointer Events so mouse, touch, and stylus all work. Use `touch-action: none` on the canvas so drawing doesn't scroll the page on mobile.
- The canvas has a fixed **logical resolution** (e.g. 1200×900, 4:3) scaled to fit any screen, so drawings look the same for everyone.

## Other pads

The **deck cover pad** (a local 600×800 canvas) and the **avatar pad** (a local 512×512 canvas) use this same toolbar, shortcuts and canvas input: colour wheel, eyedropper, drag to change size and opacity, and all (`DrawingPad`). There the toolbar is a **panel**: a ~22rem column of full-width trays beside the pad (tools, colour and slots, the palette in two bands of 7, brush, history), with the owner's buttons under it. Where the space is under 42rem the panel goes under the pad instead.

Both open in a **paper popup** (`ui/PaperDialog`): a taped sheet with a marker outline and a ✕ sticker. Esc and a click outside don't close it (Esc already cancels a drag or closes the colour wheel), so a drawing isn't lost by accident. The cover popup opens by itself when a deck starts generating; closing it keeps the drawing, and the generate panel can reopen it or go without a cover. When the avatar editor opens over a turn in progress, its shortcuts go to the avatar pad, not the room's board, and a hidden pad's toolbar ignores the keyboard.

## Touch screens

On touch screens (`pointer: coarse`) the toolbar's buttons grow to 44 px, swatches to 36 px and sliders (and their thumbs) get bigger, the keycaps and ⌨ are hidden, and the cover pad is drawn bigger. The toolbar wraps onto more rows when it doesn't fit. Mouse users keep the compact bar.

Touch has no Alt key or right button, so everything they do has a visible control: size and opacity have sliders, a long-press on a colour slot saves to it, and the toolbar's **dropper** arms the eyedropper: the next press on the canvas picks up the colour under it (dragging keeps sampling), then the dropper turns itself off. It works with a mouse too.

## Touch and stylus

Tablets send several pointers at once (a pen, a palm resting on the glass, a second finger), so the canvas keeps one in charge (`pointer-gate.ts` in `packages/canvas-engine`, shared with Doodle Tower):

- **One pointer draws at a time.** Another pointer landing, moving or lifting mid-stroke is ignored, so a palm can't add points to a stroke or end it.
- **Palm rejection.** Once a pen has been seen on the page (a press, or Apple Pencil hovering above the glass), touches no longer draw. Fingers still work on everything else. Without a pen, fingers draw normally.
- **Pressure.** Only a pen's pressure is recorded. Fingers and mice record a flat 0.5 and perfect-freehand simulates pressure from speed, so a screen that reports a constant touch pressure doesn't draw fat lines.
- **No page movement while drawing.** The canvas has `touch-action: none`, the page has `touch-action: manipulation` (no double-tap zoom), the room page never scrolls (only its panels do), and long-press on the board doesn't select text or open the iOS callout.

## Mobile

- Phones get the "bigger screen" page instead (next-features.md, decided 2026-10-03). The notes below are for a possible phone guess-only mode later.
- Guessing on a phone must work well. Drawing on a phone should work: the toolbar collapses into a bottom sheet, with size and opacity in a popover.

How strokes are captured, sent, and replayed is covered in [../technical/realtime-protocol.md](../technical/realtime-protocol.md#drawing-sync).
