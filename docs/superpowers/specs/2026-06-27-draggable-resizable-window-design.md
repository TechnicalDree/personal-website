# Draggable & Resizable Floating Window — Design

**Date:** 2026-06-27
**Branch:** mobile-responsive-layout-v1
**Status:** Approved, ready for implementation

## Goal

Let the user click-and-drag the `adrian-OS` desktop window around the viewport
and resize it from any edge or corner, while preserving the site's signature 3D
perspective tilt. State persists across reloads.

## Scope decisions (from brainstorming)

- **What moves:** the whole `.unit` (left profile/nav panel + terminal) as a
  single window. The two halves stay joined.
- **Tilt:** kept **always**. The window remains a tilted slab; drag tracking is
  made 1:1 by composing the move as a screen-space translate applied *outside*
  the perspective transform. Resize corners are slightly foreshortened on the
  tilted plane — accepted.
- **Resize affordance:** all **8 handles** (4 corners + 4 edges). Free aspect
  ratio. Min `520×420`, max `96vw × 94vh`.
- **Drag handle:** the **terminal chrome bar** (`.term-chrome`, the
  `adrian-OS v4.2.1` strip with dots + clock) only. No other grab zones, so
  clicks on nav/links/forms can never start a drag.

**Out of scope:** keyboard-driven move/resize, multi-window, snapping/tiling,
touch drag/resize on phones & tablets.

## Architecture

New self-contained module `assets/window-frame.js` — a `DOMContentLoaded` IIFE
following the existing pattern of `bg.js` / `city-3d.js`. Loaded via a
`<script>` tag in `index.html` after `app.js`. It owns all drag/resize state and
touches the DOM only through:

- `#stage` — the centering container (read-only; respects its `minimized` state).
- `.unit` — the window element it moves/resizes (writes CSS vars + injects handles).
- `.term-chrome` — the drag handle (attaches pointer listeners, sets cursor).
- `#floppy-btn` (SAVE.DAT) — optional explicit-save hook (see Persistence).

No rewrite of `app.js`. The modules coexist: while minimized, `.stage` already
gets `pointer-events:none`, so no drag/resize can start when the window is hidden.

### Why a new file (not app.js)

`app.js` is already ~55KB and the codebase splits concerns into focused asset
files. A dedicated module keeps the geometry math isolated and testable.

### Why vanilla (no library)

The whole site is hand-rolled vanilla JS with no UI dependencies. A drag library
(interact.js) would add a dependency and can't cleanly respect the
perspective-tilt math. Native CSS `resize:both` only does a bottom-right grip and
fights `overflow`/tilt. Hand-rolled pointer events give full control.

## Geometry model (tilt-safe core)

State per window: `{ x, y, w, h }` where `x/y` are screen-space translate offsets
(px) from the centered default, and `w/h` are explicit sizes (px). All four are
`null`/unset until the user first drags or resizes; unset falls back to the
current CSS defaults.

### Position

CSS vars on `.unit`, composed as the **outermost** translate so the move applies
to the already-projected 2D result → 1:1 cursor tracking regardless of tilt:

```css
.unit {
  transform:
    translate3d(var(--win-x, 0px), var(--win-y, 0px), 0)
    perspective(1800px)
    rotateX(calc(5deg + var(--tilt-x)))
    rotateY(calc(-7deg + var(--tilt-y)));
}
```

### Size

```css
.unit {
  width:  var(--win-w, min(1320px, 96vw));
  height: var(--win-h, min(820px, 94vh));
}
```

### Edge-anchor compensation

`.unit` is flex-centered in `.stage`, so growing it changes both edges
symmetrically around its center. To make a resize feel like "drag this edge, the
opposite edge stays put", a resize that moves the **top** or **left** edge also
shifts the translate by **half the size delta**:

- East/South edges: grow `w`/`h`; opposite (left/top) edge is the anchor →
  shift center by `+Δ/2` so the anchored edge holds.
- West/North edges: grow `w`/`h`; opposite (right/bottom) edge is the anchor →
  also shift center by `−Δ/2`.

This anchoring + min/max clamping is implemented as a **pure function**
`resolveResize(dir, start, delta)` → `{ x, y, w, h }`, unit-tested in isolation.

## Dragging

- Handle: `.term-chrome`. `cursor: grab`; `grabbing` during an active drag.
- `pointerdown` → `setPointerCapture`, record `{ startX, startY, originX, originY }`,
  add `dragging` class, freeze parallax (see below).
- `pointermove` → `x = originX + (e.clientX − startX)`, same for `y`; write
  `--win-x/--win-y`.
- `pointerup`/`pointercancel` → release capture, drop `dragging`, persist,
  unfreeze parallax.
- **Bounds:** clamp so the chrome bar always keeps ~40px visible on every edge —
  the window can never be lost off-screen.
- Ignore `pointerdown` whose `target` is an interactive child (defensive; the
  chrome currently has none).

### Parallax freeze

The mouse-driven parallax tilt (`--tilt-x/--tilt-y`) is written on `.unit` by
`city-environment.js` `applyParallax()` (a RAF loop). While a drag/resize is
active it must be frozen so the window doesn't wobble under the cursor. The
window-frame module toggles a `body.win-interacting` class on
pointerdown/pointerup; `applyParallax()` gets a one-line guard so it skips
updating the `.unit` tilt vars while that class is present (background parallax
keeps running — only the window tilt freezes).

## Resizing

- 8 handle `<div>`s injected once into `.unit`: `n s e w ne nw se sw`, each with
  `data-dir` and an appropriate resize cursor (`ns-/ew-/nesw-/nwse-resize`).
- Neon-styled to match the frame; corner handles small squares at the corners,
  edge handles thin strips along each side. `z-index` above content, below the
  minimize button. They sit on `.unit` (which has no `overflow:hidden`).
- `pointerdown` on a handle → record start size + start offset + start pointer +
  `dir`; freeze parallax; add `resizing` class.
- `pointermove` → screen-space delta → `resolveResize(dir, start, delta)` →
  write `--win-w/--win-h` and (when anchoring) `--win-x/--win-y`.
- Clamp: min `520×420`, max `96vw × 94vh` (computed in px at interaction start).
- `pointerup` → persist, unfreeze.

## Persistence & reset

- Auto-save `{ x, y, w, h }` to `localStorage["adrianos.window"]` (debounced) at
  the end of every drag/resize; restore and apply on load (only when ≥901px — see
  Mobile). Wrap in try/catch like the existing `crtTheme` storage.
- **SAVE.DAT becomes real:** the floppy button (`#floppy-btn`) is currently a
  cosmetic toast. Its click handler will also write the current geometry to
  storage so its "SAVED ✓" flash means something. (Additive — the existing toast
  + animation stay.)
- **Reset:** double-click the chrome bar → clear the vars + `localStorage` entry,
  ease back to the default centered position/size (the existing
  `transition: transform .5s` on `.unit`'s ancestors covers the ease, or add a
  brief transition on release).

## Mobile / touch

Active only at **≥901px with a fine, hovering pointer**, matching the existing
`@media (max-width: 900px)` responsive switch where `.unit` becomes single-column
`height:auto`, and keeping touch tablets out (drag/resize is a mouse/trackpad
affordance).

- A `matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)')`
  listener gates activation; `startDrag`/`startResize` also ignore
  `pointerType === 'touch'` as defense-in-depth so a title-bar swipe scrolls.
- Below the gate: handles hidden (`display:none` via the `win-enabled` class),
  pointer listeners no-op, and any inline `--win-*` vars are cleared so the
  responsive single-column layout fully governs.
- Toggles live as the viewport/capability crosses the gate.

## Review refinements (post-implementation)

An adversarial review surfaced refinements folded into the final code:

- **Handle-aware drag clamp.** The drag handle lives at the window's *top*, so an
  upward drag clamps the top handle band (not the far/bottom edge) on-screen —
  otherwise the title bar (and dbl-click-reset target) could strand off-screen.
  `clampDragOffset` takes a `handleH` param for this.
- **No accidental persistence.** Resize, like drag, only saves on an actual move
  (a stray click on a handle no longer pins the responsive default into storage).
- **Single interaction at a time.** A re-entrancy guard + per-`pointerId` filter
  prevents a second pointer (multi-touch/pen) from corrupting an in-progress
  drag; pointer listeners live on `window` so teardown fires even if capture
  fails. Reset freezes parallax for its ease. `bounds()` clamps min ≤ max on
  short viewports.

## Testing

- **Unit:** `resolveResize()` pure-function tests — each of the 8 directions
  grows the right dimension, anchors the opposite edge (center shift = half
  delta), and respects min/max clamps. Plus the drag-bounds clamp helper.
  Node `.mjs` test alongside the existing `scripts/test-city-3d-*.mjs`.
- **Integration (headless `browse`):**
  - Drag the chrome bar → `--win-x/--win-y` change and the window's bounding box
    follows the cursor delta.
  - Each of the 8 handles → size changes in the expected dimension and the
    opposite edge's screen position stays within tolerance.
  - Reload → restored to saved geometry.
  - Resize viewport <901px → handles hidden, inline vars cleared, layout reflows
    to single column; back ≥901px → drag/resize re-enabled.
  - Minimize (HIDE) → drag cannot start.

## Files touched

- `assets/window-frame.js` — new module (drag, resize, persistence, geometry).
- `assets/styles.css` — `.unit` transform/size vars, 8 handle styles, cursors,
  `dragging`/`resizing`/breakpoint classes.
- `index.html` — `<script>` tag for the new module.
- `assets/app.js` — extend `#floppy-btn` handler to persist geometry (small,
  additive).
- `assets/city-environment.js` — one-line guard in `applyParallax()` to skip
  `.unit` tilt updates while `body.win-interacting` is set.
- `scripts/test-window-frame.mjs` — new unit tests for the geometry function.
