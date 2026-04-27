# personal-website

A retro cyberpunk personal terminal — an interactive single-page site with an
animated pixel-art synthwave city background and a CRT-style "OS" UI.

## Run it

It's static. Open `index.html` in any modern browser, or serve the directory:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Layout

- `index.html` — markup, view templates (home / projects / about / experience /
  gallery / contact).
- `assets/styles.css` — full visual system: CRT scanlines, neon glow, pixel
  fonts, panels, timeline, gallery, etc.
- `assets/bg.js` — animated pixel-city canvas (sky gradient, parallax buildings,
  flying cars, drones, walking pedestrians, shooting stars).
- `assets/app.js` — view switching, typewriter prompt, uptime/clock, GitHub
  heatmap and Monkeytype chart, HIDE.UI / SHOW.UI minimize toggle (also `Esc` /
  `B`).
- `assets/avatar.png` — portrait sprite.

## Controls

- Click the left-side `[NN] LABEL` nav entries to switch terminal views.
- Click `HIDE.UI` (top-right) — or press `Esc` / `B` — to fade the terminal and
  reveal the full city background.
