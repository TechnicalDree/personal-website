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
- `assets/github-history.js` / `.json` — generated GitHub contribution calendar
  data for the home page.
- `assets/monkeytype-history.js` / `.json` — optional generated Monkeytype data
  for the home page. The site falls back to Monkeytype's public profile API when
  no export is present.
- `scripts/fetch-github-history.py` — refreshes the generated GitHub history data
  from github.com.
- `scripts/fetch-monkeytype-history.py` — refreshes Monkeytype data from a public
  username or an authenticated ApeKey export.
- `scripts/update-dashboard-data.py` — refreshes all generated dashboard files in
  one command, including `assets/dashboard-snapshots.json` / `.js`. GitHub and
  Monkeytype can update automatically; Cursor and Wispr Flow are
  private-dashboard snapshots unless you provide updated `CURSOR_*` / `WISPR_*`
  environment values.
- `.github/workflows/update-dashboard-data.yml` — scheduled refresh that runs every
  6 hours and commits generated dashboard data when it changes.
- `assets/avatar.png` — portrait sprite.

## Controls

- Click the left-side `[NN] LABEL` nav entries to switch terminal views.
- Click `HIDE.UI` (top-right) — or press `Esc` / `B` — to fade the terminal and
  reveal the full city background.

## Refresh GitHub history

```bash
python3 scripts/fetch-github-history.py
```

## Refresh Monkeytype history

For public profiles:

```bash
MONKEYTYPE_USER=your_exact_username python3 scripts/fetch-monkeytype-history.py
```

For private/authenticated stats, generate an ApeKey in Monkeytype settings,
activate it with the checkbox next to the key, and run:

```bash
MONKEYTYPE_USER=your_exact_username MONKEYTYPE_APE_KEY=your_key python3 scripts/fetch-monkeytype-history.py
```

## Keep dashboard data fresh

Run the combined updater locally:

```bash
MONKEYTYPE_USER=a3rean MONKEYTYPE_APE_KEY=your_key python3 scripts/update-dashboard-data.py
```

For automatic refreshes on GitHub, add a repository secret named
`MONKEYTYPE_APE_KEY`. Cursor and Wispr Flow do not expose public static-site-safe
history APIs here, so their cards use snapshot values from
`assets/dashboard-snapshots.js`; update them through repository variables like
`CURSOR_AI_LINE_EDITS`, `CURSOR_CURRENT_STREAK`, `WISPR_CURRENT_STREAK`, and
`WISPR_LONGEST_STREAK`.
