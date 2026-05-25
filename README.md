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
  heatmap and Monkeytype chart, HIDE / SHOW minimize toggle (also `Esc` /
  `B`).
- `assets/site-content.json` — editable portfolio copy (projects, experience,
  about text, contact channels, sidebar profile).
- `assets/content-admin.js` — loads `site-content.json`, hydrates the page, and
  unlocks inline editing after admin login.
- `assets/admin-config.example.js` — template for your admin password hash.
  Copy to `assets/admin-config.js` (gitignored) before using the editor.
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
- Click `HIDE` (top-right) — or press `Esc` / `B` — to fade the terminal and
  reveal the full city background.

## Edit site content (admin only)

Portfolio text lives in `assets/site-content.json`. Visitors always see the
published JSON. Only you can unlock inline editing from the terminal prompt at
the bottom of the screen.

1. Focus the command line (`/` or click it) and run:

```text
sudo your-password-here
```

The first time you run this in a browser, it saves that password locally and
unlocks edit mode. On later visits, the same command logs you in.

2. Click any highlighted field to edit it. Use **SAVE JSON** (or the floppy
   **SAVE.DAT** button) to download an updated `site-content.json`.

3. Replace `assets/site-content.json` with the downloaded file and commit/push
   so the live site updates.

Other admin commands:

```text
admin logout          end edit session
admin passwd <new>    change password (while logged in)
admin status          show session state
```

Optional: `assets/admin-config.js` can still define a `passwordHash` if you
want a fixed password across browsers (`python3 scripts/hash-admin-password.py`
generates the hash). Terminal setup via `sudo` stores the hash in
`localStorage` for that browser only.

Admin auth runs entirely in the browser on a static site, so treat the password
as a deterrent rather than bank-grade security.

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
