# Piece Pipeline

How a drawing becomes a physics piece. It lives in `packages/doodle-shape`: pure, deterministic, integer-only until the final scale step. The server's result is the one that counts. The browser runs the same code for the drawer's live preview.

## Input

The round's strokes, in the fixed logical canvas (1200×900, `protocol/drawing.ts`). Window and screen size never matter, because everything is already in logical coordinates.

## Steps

```
strokes ─► 1 rasterise ─► 2 thicken ─► 3 fill enclosed ─► 4 pick blob ─► 5 trace ─► 6 simplify
        ─► 7 normalize scale ─► 8 convex split ─► Piece { outline, parts, area, bitmap }
```

1. **Rasterise** the strokes onto a grid **sized to the drawing**, not the canvas: the ink's bounding box (after the last clear), divided into 72 cells along its longest side (1.5–12 logical px per cell), plus an empty margin. Each stroke is stamped with its brush size, and erased strokes subtract. Sizing the grid to the drawing normalizes **resolution** as well as scale. With a fixed 8 px grid, a small dot came out as a square, because a tiny doodle had too few cells. Now a doodle keeps the same detail at any size, and gaps and thickening are relative to the drawing.
2. **Thicken**: dilate by 1 cell, so a thin line becomes a solid bar.
3. **Fill enclosed areas**: close gaps of up to about 4 cells (a closing: dilate, then erode), then flood-fill the empty cells from the grid's border. Any empty cell it can't reach is inside a closed shape, so it becomes solid. A drawn circle, even with a small gap, becomes a disc.
4. **Pick the blob**: keep the largest connected component. Components within 5 cells of it are joined to it: a balloon's string, the dashes around a shining lightbulb, motion lines. Each join is a 3-cell-wide bridge, **rounded off** with a closing of 2 cells around the bridge, so the mark meets the object with a smooth web, the way you'd cut a sticker out around it. Small or far-away bits are dropped; the live preview shows them hatched grey.
5. **Trace** the outline along the cells, through the **midpoints** of the cell edges. A staircase of cells becomes a straight diagonal, so slanted edges don't turn into zigzags (a triangle used to need 14 convex parts). Interior holes can't exist after step 3.
6. **Simplify** with Ramer–Douglas–Peucker (0.75 cell), then fill shallow notches (inward corners less than a cell deep, which cost parts and add no visible shape). The result must have at most 64 corners and split into at most 16 convex parts. When it doesn't, **notches are filled, not corners cut**: a closing of 1, 2, 3, 4, 6, then 8 cells fills the narrowest notches first (between rays, then between an arm and a trunk), and the outside of the shape stays exactly as drawn. Only after that does it fall back to a coarser simplification, and finally to the convex hull.
7. **Normalize the scale** (below).
8. **Convex split** with poly-decomp (Bayazit), on the same polygon as the outline, so the outline and its parts cover exactly the same area. The parts make one compound Rapier body. Keeping concave shapes is what lets pieces hook and fit into each other.

The old step 6 simplified harder (cut corners) whenever a shape was too complex. With dashes around a lightbulb, that turned every dash into a thin triangle from its tip back to the bulb: a zigzag. Filling notches first is the fix.

The output also includes the doodle as a bitmap, cropped to the silhouette's bounding box, for rendering.

## Normalizing the scale

Every piece should end up with about the same weight, whether the doodle was tiny in a corner or filled the whole canvas.

```
s = sqrt(A_target / A_silhouette)            # equal area → equal mass for all pieces
s = min(s, L_max / longest_side)             # a long thin line can't become a 20 m pole
s = max(s, t_min / thinnest_part)            # …and a thin part can't shrink below t_min
```

If the last two rules conflict (a very thin, very long doodle), `L_max` wins and the piece ends up smaller than `A_target`. That's fine: a skinny stick is a weak block anyway.

Starting values (world units, the platform is 6 wide): `A_target = 1.0`, `L_max = 3.0`, `t_min = 0.2`. Small pieces leave room on the platform and time to aim. Tune them in the sandbox. Check: about 8–12 average pieces should reach the medium height line.

## Edge cases

| Drawing | Result |
|---|---|
| Blank or nearly blank | No piece. The round still counts as solved. The solver gets "There's nothing to build!" and the drawer gets a hint to draw bigger |
| One dot | Becomes a small disc, scaled up to `A_target`, so a round, slippery ball |
| Several separate objects | Largest blob wins, near ones are bridged, far ones dropped (step 4) |
| A frame drawn around everything | Becomes a solid rectangle: a perfect brick. See the exploit note below |

**The frame exploit**: a drawer could draw a box around every word to make perfect bricks. Counters, in order of preference:

1. It balances itself: bricks are the best thing to steal.
2. Very box-like pieces (silhouette fills more than 92% of its convex hull and has 4 corners) get the **ice** material: almost no friction.
3. If that's not enough, don't fill closed shapes that touch the canvas edges.

Decide after playtesting ([open-questions.md](../planning/open-questions.md)).

## Performance

0.1–6 ms per drawing in Node (the first call is the slowest), so the drawer's live preview can recompute about ten times a second.

## Tests

`packages/doodle-shape/src/piece.test.ts`, on the drawings in `samples.ts`: ball (a circle with a gap), brick, banana, star, stick figure, skateboard, mountain, boot, cactus, house, dot, lightbulb (with detached dashes), balloon.

- **Fidelity**, every sample: every point of the drawn strokes lies inside the piece's outline (give or take a cell). This is what catches corner-cutting.

- Every sample: a valid outline (≤ 32 corners), 1–8 convex counter-clockwise parts whose areas add up to the outline's, centred on its centroid, area = `A_target` unless capped.
- Shapes: the lightbulb keeps all its dashes, with no corner sharper than 60° (no slivers); a circle with a gap fills into one disc; a rectangle outline becomes a solid 2:1 brick; the boot, cactus and star stay concave (several parts); a long line is capped at `L_max`; a balloon keeps its string.
- Normalization: the same drawing at a quarter of the size, somewhere else on the canvas, gives the same piece; output is deterministic.
- Dropped ink: blank, erased and cleared drawings give no piece; a far-away blob is dropped; ink before a clear is ignored.

Drawings saved in the sandbox ("JSON" button) can be pasted into `samples.ts` as new golden cases.
