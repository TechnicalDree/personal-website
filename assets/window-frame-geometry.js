// Pure geometry for the draggable/resizable adrian-OS window.
// No DOM access — imported by window-frame.js and unit-tested in
// scripts/test-window-frame.mjs (mirrors the city-3d-layout.js split).
//
// Window model: (x, y) is the screen-space translate offset applied to the
// flex-centered .unit; (w, h) its size in px. Edges relative to the center:
//   left = x - w/2, right = x + w/2, top = y - h/2, bottom = y + h/2.

// Smallest usable window — keeps the sidebar + terminal legible. Shared by the
// resize bounds (window-frame.js) and the persistence validator below.
export const MIN_W = 520;
export const MIN_H = 420;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Resize a window by dragging handle `dir` (n/s/e/w/ne/nw/se/sw). The edge under
// the cursor follows the pointer delta; the opposite edge stays anchored, even
// when the size hits a min/max bound.
export function resolveResize(dir, start, delta, bounds) {
  const { x, y, w, h } = start;
  const { dx, dy } = delta;
  const { minW, minH, maxW, maxH } = bounds;
  let nw = w;
  let nh = h;
  let nx = x;
  let ny = y;

  if (dir.includes('e')) {
    const anchorLeft = x - w / 2;
    nw = clamp(w + dx, minW, maxW);
    nx = anchorLeft + nw / 2;
  } else if (dir.includes('w')) {
    const anchorRight = x + w / 2;
    nw = clamp(w - dx, minW, maxW);
    nx = anchorRight - nw / 2;
  }

  if (dir.includes('s')) {
    const anchorTop = y - h / 2;
    nh = clamp(h + dy, minH, maxH);
    ny = anchorTop + nh / 2;
  } else if (dir.includes('n')) {
    const anchorBottom = y + h / 2;
    nh = clamp(h - dy, minH, maxH);
    ny = anchorBottom - nh / 2;
  }

  return { x: nx, y: ny, w: nw, h: nh };
}

// Clamp a drag offset so the window can never be flung out of reach. The window
// is flex-centered, so its center sits at (viewW/2 + x, viewH/2 + y).
// Horizontally and downward, at least `margin` px of the window stays visible.
// Upward is special: the drag handle (and the dbl-click-reset target) lives at
// the window's TOP, so an upward drag must keep `margin` px of that top handle
// band on screen — clamping the far/bottom edge instead would strand the title
// bar off-screen with no way to grab it back. `handleH` is the handle band
// height (0 ⇒ keep the very top edge at the margin).
export function clampDragOffset({ x, y }, { winW, winH, viewW, viewH, margin = 40, handleH = 0 }) {
  const xMax = viewW / 2 + winW / 2 - margin;
  const xMin = margin - winW / 2 - viewW / 2;
  const yMax = viewH / 2 + winH / 2 - margin;
  const yMin = margin - handleH - viewH / 2 + winH / 2;
  return {
    x: clamp(x, xMin, xMax),
    y: clamp(y, yMin, yMax),
  };
}

// Validate a raw localStorage string into a trustworthy geometry, or null.
// Rejects malformed JSON, missing/non-finite fields, and sub-minimum sizes.
export function parseStoredGeometry(raw) {
  if (typeof raw !== 'string') return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { x, y, w, h } = data;
  const finite = [x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n));
  if (!finite) return null;
  if (w < MIN_W || h < MIN_H) return null;
  return { x, y, w, h };
}
