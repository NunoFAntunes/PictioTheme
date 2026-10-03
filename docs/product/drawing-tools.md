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
| **Colour picker** | Full HSV picker with hex input. The last 8 used colours are kept as "recent" swatches |
| **Eraser** | Same size control. Erases to transparent/background |
| **Fill bucket** | Flood fill with tolerance. Runs on the rasterized canvas (see technical notes) |
| **Undo / Redo** | At least 50 steps. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z |
| **Clear canvas** | Asks for confirmation. Can be undone |
| **Cursor preview** | A circle showing the brush size and colour at the pointer |

### v1.1 (nice-to-have)

| Tool | Details |
|---|---|
| **Eyedropper** | Pick a colour from the canvas (Alt+click shortcut) |
| **Shapes** | Line, rectangle, ellipse (outline or filled). Shift locks to straight lines / squares / circles |
| **Pressure sensitivity** | With a stylus or Apple Pencil, size and/or opacity follow `PointerEvent.pressure` |
| **Brush types** | Marker (hard edge), pencil (textured), highlighter (multiply blend), spray |
| **Background colour** | Set the canvas background |

### Later

Layers (background + sketch), zoom/pan for the drawer, symmetry mode, stickers (deliberately not included at first because they'd make drawing too easy).

## Opacity done right

A common bug: drawing a semi-transparent stroke as overlapping segments makes the overlaps darker, so the stroke ends up blotchy. Instead, **each stroke is rendered at full opacity onto a temporary layer, which is then composited onto the main canvas at the stroke's opacity.** The whole stroke has one even transparency, the way it does in real drawing apps.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `B` / `E` / `F` | Brush / Eraser / Fill |
| `[` / `]` | Smaller / larger brush |
| `1`–`9`, `0` | Opacity 10%–90%, 100% |
| `Alt` (hold) | Eyedropper |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / Redo |
| `Shift` + drag | Straight line |

## Feel and performance targets

- **Input-to-ink locally: < 16 ms** (draw on the next frame. Never wait for the server).
- **Drawer-to-viewer latency: < 150 ms** p95 on normal connections.
- Smoothing: stroke stabilization (e.g. Catmull-Rom curves or a small moving average) with a "smoothing" slider.
- Use Pointer Events so mouse, touch, and stylus all work. Use `touch-action: none` on the canvas so drawing doesn't scroll the page on mobile.
- The canvas has a fixed **logical resolution** (e.g. 1200×900, 4:3) scaled to fit any screen, so drawings look the same for everyone.

## Mobile

- Guessing on a phone must work well. Drawing on a phone should work: the toolbar collapses into a bottom sheet, with size and opacity in a popover.
- The palette shows 8 swatches plus the picker on small screens.

How strokes are captured, sent, and replayed is covered in [../technical/realtime-protocol.md](../technical/realtime-protocol.md#drawing-sync).
