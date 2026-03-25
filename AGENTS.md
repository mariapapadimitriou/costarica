# AGENTS.md

## Cursor Cloud specific instructions

This is a **static HTML/CSS website** with zero build tooling, no package manager, and no dependencies to install.

### Running locally

Serve the site with any static file server from the repository root:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

### Key files

- `index.html` — Single-page travel itinerary
- `style.css` — All styling (CSS custom properties, grid, flexbox, animations)
- `.nojekyll` — Disables Jekyll processing for GitHub Pages deployment

### Notes

- There are no lint, test, or build steps — the project is pure HTML + CSS.
- Google Fonts (Playfair Display, Inter) are loaded via CDN; an internet connection is needed for correct font rendering.
- The site is designed for GitHub Pages deployment (static hosting).
