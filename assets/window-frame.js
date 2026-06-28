// Draggable + resizable adrian-OS window. Moves/resizes the whole .unit while
// keeping its 3D perspective tilt. Pure geometry lives in window-frame-geometry.js
// (unit-tested); this module is the DOM glue: pointer handling, 8 resize handles,
// persistence, reset, and the ≥901px desktop gate. See
// docs/superpowers/specs/2026-06-27-draggable-resizable-window-design.md
import {
  resolveResize,
  clampDragOffset,
  parseStoredGeometry,
  clamp,
  MIN_W,
  MIN_H,
} from './window-frame-geometry.js';

(function () {
  const BREAKPOINT = 901; // matches the @media (max-width: 900px) responsive switch
  const STORAGE_KEY = 'adrianos.window';
  const MARGIN = 40; // px of the window that must stay on-screen
  const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  function init() {
    const stage = document.getElementById('stage');
    const unit = stage && stage.querySelector('.unit');
    const chrome = unit && unit.querySelector('.term-chrome');
    if (!stage || !unit || !chrome) return;

    let state = null; // {x,y,w,h} in px, or null = default centered/sized
    let enabled = false;
    let interacting = false; // single in-progress drag/resize at a time
    // Gate on a fine, hovering pointer too — drag/resize is a mouse/trackpad
    // affordance. This keeps touch tablets >=901px out (per spec) so a swipe on
    // the title bar scrolls instead of dragging.
    const mql = window.matchMedia(`(min-width: ${BREAKPOINT}px) and (hover: hover) and (pointer: fine)`);

    // --- geometry helpers ---
    function bounds() {
      const maxW = window.innerWidth * 0.96;
      const maxH = window.innerHeight * 0.94;
      // Never let the min exceed the max on short/narrow desktop viewports,
      // which would otherwise invert the clamp and render below the minimum.
      return {
        minW: Math.min(MIN_W, maxW),
        minH: Math.min(MIN_H, maxH),
        maxW,
        maxH,
      };
    }

    // Read the window's current layout box. offsetWidth/Height ignore the CSS
    // transform, so they give the true (untilted) size to start an interaction.
    function ensureGeom() {
      if (!state) {
        state = { x: 0, y: 0, w: unit.offsetWidth, h: unit.offsetHeight };
      }
      return state;
    }

    // Keep a geometry within the current viewport (size + on-screen margin).
    function normalize(g) {
      const b = bounds();
      const w = clamp(g.w, b.minW, b.maxW);
      const h = clamp(g.h, b.minH, b.maxH);
      const offset = clampDragOffset(
        { x: g.x, y: g.y },
        { winW: w, winH: h, viewW: window.innerWidth, viewH: window.innerHeight, margin: MARGIN, handleH: chrome.offsetHeight },
      );
      return { x: offset.x, y: offset.y, w, h };
    }

    // --- apply to the DOM ---
    function clearVars() {
      unit.style.removeProperty('--win-x');
      unit.style.removeProperty('--win-y');
      unit.style.removeProperty('--win-w');
      unit.style.removeProperty('--win-h');
    }

    // `state` holds the user's DESIRED geometry; apply() clamps to the current
    // viewport for display only. That way shrinking the viewport (or crossing
    // the mobile breakpoint) and growing it back doesn't permanently shrink the
    // window — the desired size is preserved and re-expands when there's room.
    function apply() {
      if (!enabled || !state) {
        clearVars();
        return;
      }
      const shown = normalize(state);
      unit.style.setProperty('--win-x', `${shown.x}px`);
      unit.style.setProperty('--win-y', `${shown.y}px`);
      unit.style.setProperty('--win-w', `${shown.w}px`);
      unit.style.setProperty('--win-h', `${shown.h}px`);
    }

    // --- persistence ---
    function save() {
      if (!state) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }
    function clearSaved() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }

    // --- shared interaction state (freezes parallax tilt, sets cursor) ---
    function beginInteract(cls) {
      document.body.classList.add('win-interacting');
      unit.classList.add(cls);
    }
    function endInteract(cls) {
      document.body.classList.remove('win-interacting');
      unit.classList.remove(cls);
    }

    // Listeners live on `window` (not the capture element) so teardown still
    // fires if pointer capture silently fails and the release lands elsewhere.
    // Each interaction filters to its own pointerId and end() runs at most once.
    function ignore(e) {
      return !enabled || interacting || e.pointerType === 'touch' || (e.button != null && e.button !== 0);
    }

    // --- drag (terminal chrome bar) ---
    function startDrag(e) {
      if (ignore(e)) return;
      interacting = true;
      const g = ensureGeom();
      const startX = e.clientX;
      const startY = e.clientY;
      const originX = g.x;
      const originY = g.y;
      const w = g.w;
      const h = g.h;
      const pointerId = e.pointerId;
      let moved = false;
      let done = false;
      beginInteract('win-dragging');
      try { chrome.setPointerCapture(pointerId); } catch (_) {}

      function move(ev) {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        const o = clampDragOffset(
          { x: originX + dx, y: originY + dy },
          { winW: w, winH: h, viewW: window.innerWidth, viewH: window.innerHeight, margin: MARGIN, handleH: chrome.offsetHeight },
        );
        state = { x: o.x, y: o.y, w, h };
        apply();
      }
      function end(ev) {
        if (ev && ev.pointerId !== pointerId) return;
        if (done) return;
        done = true;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        try { chrome.releasePointerCapture(pointerId); } catch (_) {}
        endInteract('win-dragging');
        interacting = false;
        if (moved) save();
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      e.preventDefault();
    }

    // --- resize (8 handles) ---
    function startResize(e, dir, handle) {
      if (ignore(e)) return;
      interacting = true;
      const start = { ...ensureGeom() };
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const b = bounds();
      let moved = false;
      let done = false;
      beginInteract('win-resizing');
      try { handle.setPointerCapture(pointerId); } catch (_) {}

      function move(ev) {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        state = resolveResize(dir, start, { dx, dy }, b);
        apply();
      }
      function end(ev) {
        if (ev && ev.pointerId !== pointerId) return;
        if (done) return;
        done = true;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        try { handle.releasePointerCapture(pointerId); } catch (_) {}
        endInteract('win-resizing');
        interacting = false;
        if (moved) save();
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      e.preventDefault();
      e.stopPropagation();
    }

    function buildHandles() {
      DIRS.forEach((dir) => {
        const el = document.createElement('div');
        el.className = `win-handle win-handle-${dir}`;
        el.dataset.dir = dir;
        el.setAttribute('aria-hidden', 'true');
        el.addEventListener('pointerdown', (e) => startResize(e, dir, el));
        unit.appendChild(el);
      });
    }

    // --- reset (double-click the chrome bar) ---
    function reset() {
      state = null;
      clearSaved();
      // Freeze the parallax tilt for the ease — the reset transition animates
      // `transform`, and a live per-frame tilt write would rubber-band against it.
      document.body.classList.add('win-interacting');
      unit.classList.add('win-resetting');
      apply();
      window.setTimeout(() => {
        unit.classList.remove('win-resetting');
        document.body.classList.remove('win-interacting');
      }, 400);
    }

    // --- desktop gate ---
    function setEnabled(on) {
      enabled = on;
      unit.classList.toggle('win-enabled', on);
      apply();
    }

    // --- wire up ---
    const stored = (() => {
      try { return parseStoredGeometry(localStorage.getItem(STORAGE_KEY)); } catch (_) { return null; }
    })();
    if (stored) state = stored;

    buildHandles();
    chrome.addEventListener('pointerdown', startDrag);
    chrome.addEventListener('dblclick', () => { if (enabled) reset(); });

    const floppy = document.getElementById('floppy-btn');
    if (floppy) floppy.addEventListener('click', () => { if (enabled && state) save(); });

    if (mql.addEventListener) {
      mql.addEventListener('change', (e) => setEnabled(e.matches));
    } else if (mql.addListener) {
      mql.addListener((e) => setEnabled(e.matches)); // Safari < 14
    }
    window.addEventListener('resize', () => { if (enabled) apply(); });

    setEnabled(mql.matches);

    // Small surface for headless verification / debugging.
    window.__winFrame = {
      getState: () => (state ? { ...state } : null),
      isEnabled: () => enabled,
      reset,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
