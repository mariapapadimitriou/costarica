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

- `index.html` — Single-page travel itinerary with carousel containers
- `style.css` — All styling (vintage postcard aesthetic, CSS custom properties, grid, flexbox, animations)
- `carousel.js` — Auto-loading photo carousel script (reads from local files or GitHub Contents API)
- `images/<location>/` — Photo folders per destination; drop images here and push to GitHub
- `.nojekyll` — Disables Jekyll processing for GitHub Pages deployment

### How photos auto-update

Each location card has a `data-folder` attribute (e.g. `san-jose`). The `carousel.js` script:
1. On GitHub Pages: fetches the file list via the GitHub Contents API
2. Locally: probes for `photo-1.jpg`, `photo-2.jpg`, etc. or reads a `manifest.json`
3. Loads `captions.json` from the same folder (if it exists) to display captions
4. Builds a swipeable carousel with prev/next buttons, dot navigation, and captions

To add photos: upload `.jpg`/`.png`/`.webp` files to `images/<location>/` and push. The carousel updates automatically on next page load.

To add captions: create a `captions.json` file in the same folder mapping filenames to caption text:
```json
{
  "photo-1.jpg": "Exploring Mercado Central — best gallo pinto ever!",
  "photo-2.jpg": "Golden hour at Barrio Amón"
}
```
Images without a caption entry simply won't show a caption bar for that slide.

### Embedded EXIF captions

The carousel reads captions from two sources (in priority order):
1. `captions.json` in the image folder (explicit override)
2. Embedded EXIF/XMP metadata in the JPEG file (iPhone `ImageDescription`, `UserComment`, or XMP `dc:description`)

When a user adds a caption to a photo in iOS Photos, the caption is stored in the EXIF `ImageDescription` tag. The carousel automatically reads this and displays it below the photo. If `captions.json` also has an entry for that filename, the JSON value takes precedence.

### Notes

- There are no lint, test, or build steps — the project is pure HTML, CSS, and vanilla JS.
- Google Fonts (Playfair Display, Inter) are loaded via CDN; an internet connection is needed for correct font rendering.
- The site is designed for GitHub Pages deployment (static hosting).
- The GitHub API has rate limits for unauthenticated requests (60/hr). For local dev, the script falls back to HEAD-probing numbered files.
- For local development, add a `manifest.json` listing image filenames in each `images/<location>/` folder so the carousel can discover images without GitHub API access. The `san-jose` folder already has one.
