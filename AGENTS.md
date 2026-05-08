# AGENTS.md

## Cursor Cloud specific instructions

This is a static HTML/CSS/vanilla-JS portfolio site with zero build tools, package managers, or backend services. See `README.md` for layout and controls.

### Running the site

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. There is no build step, no linting tool, and no test framework configured in this repo.

### Key notes

- All assets are committed and self-contained; no `npm install` or `pip install` is needed.
- `scripts/fetch-github-history.py` is an optional data-refresh script (requires `curl` + Python 3 stdlib only). It hits GitHub's public API and may be rate-limited without a token.
- The `claude_design/` directory contains an earlier prototype and is independent of the main site.
- Google Fonts are loaded from CDN at runtime; if the VM has no internet, fallback system fonts will render instead.
