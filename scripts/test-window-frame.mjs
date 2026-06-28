import assert from 'node:assert/strict';
import {
  resolveResize,
  clampDragOffset,
  parseStoredGeometry,
} from '../assets/window-frame-geometry.js';

// Window model: (x, y) is the screen-space translate offset of the flex-centered
// window; (w, h) its size in px. Edges are derived relative to the center:
//   left = x - w/2, right = x + w/2, top = y - h/2, bottom = y + h/2.
// A resize anchors the OPPOSITE edge: dragging east keeps the left edge fixed.
const START = { x: 0, y: 0, w: 1000, h: 800 };
const BIG = { minW: 100, minH: 100, maxW: 100000, maxH: 100000 };

const left = (s) => s.x - s.w / 2;
const right = (s) => s.x + s.w / 2;
const top = (s) => s.y - s.h / 2;
const bottom = (s) => s.y + s.h / 2;

// --- east: right edge follows cursor, left edge anchored ---
{
  const out = resolveResize('e', START, { dx: 120, dy: 999 }, BIG);
  assert.equal(out.w, 1120, 'east grows width by dx');
  assert.equal(out.h, 800, 'east leaves height unchanged');
  assert.equal(left(out), left(START), 'east anchors the left edge');
  assert.equal(out.y, START.y, 'east leaves y unchanged');
}

// --- west: left edge follows cursor, right edge anchored ---
{
  const out = resolveResize('w', START, { dx: 120, dy: 0 }, BIG);
  assert.equal(out.w, 880, 'west shrinks width by dx (cursor moves right)');
  assert.equal(right(out), right(START), 'west anchors the right edge');
}

// --- south: bottom edge follows cursor, top edge anchored ---
{
  const out = resolveResize('s', START, { dx: 0, dy: 60 }, BIG);
  assert.equal(out.h, 860, 'south grows height by dy');
  assert.equal(out.w, 1000, 'south leaves width unchanged');
  assert.equal(top(out), top(START), 'south anchors the top edge');
  assert.equal(out.x, START.x, 'south leaves x unchanged');
}

// --- north: top edge follows cursor, bottom edge anchored ---
{
  const out = resolveResize('n', START, { dx: 0, dy: 60 }, BIG);
  assert.equal(out.h, 740, 'north shrinks height by dy (cursor moves down)');
  assert.equal(bottom(out), bottom(START), 'north anchors the bottom edge');
}

// --- se corner: anchors the top-left corner ---
{
  const out = resolveResize('se', START, { dx: 40, dy: 40 }, BIG);
  assert.equal(out.w, 1040);
  assert.equal(out.h, 840);
  assert.equal(left(out), left(START), 'se anchors left');
  assert.equal(top(out), top(START), 'se anchors top');
}

// --- nw corner: anchors the bottom-right corner ---
{
  const out = resolveResize('nw', START, { dx: 40, dy: 40 }, BIG);
  assert.equal(out.w, 960);
  assert.equal(out.h, 760);
  assert.equal(right(out), right(START), 'nw anchors right');
  assert.equal(bottom(out), bottom(START), 'nw anchors bottom');
}

// --- clamp to max: width caps at maxW but the anchored edge stays put ---
{
  const bounds = { minW: 100, minH: 100, maxW: 1100, maxH: 100000 };
  const out = resolveResize('e', START, { dx: 999, dy: 0 }, bounds);
  assert.equal(out.w, 1100, 'east width clamps to maxW');
  assert.equal(left(out), left(START), 'east still anchors left after clamp');
}

// --- clamp to min: width floors at minW, anchored edge stays put ---
{
  const bounds = { minW: 600, minH: 100, maxW: 100000, maxH: 100000 };
  const out = resolveResize('w', START, { dx: 999, dy: 0 }, bounds);
  assert.equal(out.w, 600, 'west width clamps to minW');
  assert.equal(right(out), right(START), 'west still anchors right after clamp');
}

// --- clamp to min height from the north handle ---
{
  const bounds = { minW: 100, minH: 500, maxW: 100000, maxH: 100000 };
  const out = resolveResize('n', START, { dx: 0, dy: 999 }, bounds);
  assert.equal(out.h, 500, 'north height clamps to minH');
  assert.equal(bottom(out), bottom(START), 'north still anchors bottom after clamp');
}

// --- clampDragOffset keeps at least `margin` px of the window on screen ---
// viewport 1000x800, window 400x300, margin 40 →
//   x range [-660, 660], y range [-510, 510].
{
  const geom = { winW: 400, winH: 300, viewW: 1000, viewH: 800, margin: 40 };

  const free = clampDragOffset({ x: 100, y: 50 }, geom);
  assert.deepEqual(free, { x: 100, y: 50 }, 'offset within range is untouched');

  assert.equal(clampDragOffset({ x: 9999, y: 0 }, geom).x, 660, 'clamps far-right drag');
  assert.equal(clampDragOffset({ x: -9999, y: 0 }, geom).x, -660, 'clamps far-left drag');
  assert.equal(clampDragOffset({ x: 0, y: 9999 }, geom).y, 510, 'clamps far-down drag');

  // Upward drag must keep the TOP edge (where the drag handle lives) on screen,
  // not the bottom edge — otherwise the title bar strands off-screen with no
  // way to grab it back.
  const up = clampDragOffset({ x: 0, y: -9999 }, geom);
  assert.equal(up.y, -210, 'far-up clamps to keep the top edge at the margin');
  const topEdge = geom.viewH / 2 + up.y - geom.winH / 2;
  assert.ok(topEdge >= geom.margin - 0.001, 'top/handle edge stays within the viewport');

  // With a known handle height, keep `margin` px of the handle band visible
  // (a little more upward travel than handleH:0 allows).
  const upH = clampDragOffset({ x: 0, y: -9999 }, { ...geom, handleH: 44 });
  const handleBottom = geom.viewH / 2 + upH.y - geom.winH / 2 + 44;
  assert.ok(Math.abs(handleBottom - geom.margin) < 0.001, 'handle bottom rests at the margin');
}

// --- parseStoredGeometry: trust nothing from localStorage ---
{
  assert.deepEqual(
    parseStoredGeometry('{"x":10,"y":-20,"w":900,"h":700}'),
    { x: 10, y: -20, w: 900, h: 700 },
    'valid payload round-trips to numbers',
  );
  assert.equal(parseStoredGeometry('not json'), null, 'invalid JSON → null');
  assert.equal(parseStoredGeometry(null), null, 'null input → null');
  assert.equal(parseStoredGeometry('{"x":1,"y":2,"w":900}'), null, 'missing field → null');
  assert.equal(parseStoredGeometry('{"x":1,"y":2,"w":"big","h":700}'), null, 'non-number → null');
  assert.equal(parseStoredGeometry('{"x":1,"y":2,"w":null,"h":700}'), null, 'null field → null');
  // A stored size below the usable minimum is junk — reject it.
  assert.equal(parseStoredGeometry('{"x":0,"y":0,"w":50,"h":50}'), null, 'sub-minimum size → null');
}

console.log('window-frame geometry tests passed');
