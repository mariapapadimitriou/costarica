/**
 * Auto-loading photo carousel for Costa Rica travel journal.
 *
 * Each .photo-carousel has a data-folder attribute (e.g. "san-jose").
 * The script tries two strategies:
 *   1. GitHub Pages / GitHub API: fetches the file list from the GitHub
 *      Contents API for the repo, then builds <img> tags pointing at the
 *      raw files on the deployed branch.
 *   2. Local fallback: if no GITHUB_REPO meta tag is set, it loads from
 *      a local manifest (images/<folder>/manifest.json) or simply scans
 *      for known extensions via fetch HEAD probing.
 *
 * To add photos: just upload .jpg / .jpeg / .png / .webp files into the
 * matching images/<folder>/ directory. Push to GitHub and the carousel
 * auto-updates on next page load.
 */

(function () {
  'use strict';

  const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;
  const REPO = 'mariapapadimitriou/costarica';
  const BRANCH = 'main';

  function isGitHubPages() {
    return location.hostname.endsWith('.github.io') || location.hostname.endsWith('.github.com');
  }

  /**
   * Fetch image list from GitHub Contents API (works for public repos,
   * no auth needed). Returns an array of raw URLs.
   */
  async function fetchFromGitHub(folder) {
    const apiUrl = `https://api.github.com/repos/${REPO}/contents/images/${folder}?ref=${BRANCH}`;
    const res = await fetch(apiUrl);
    if (!res.ok) return [];
    const files = await res.json();
    if (!Array.isArray(files)) return [];
    return files
      .filter(f => IMAGE_EXTENSIONS.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => f.download_url);
  }

  /**
   * Local development fallback: tries to load a manifest.json listing
   * filenames, then falls back to probing common filenames.
   */
  async function fetchLocal(folder) {
    const basePath = `images/${folder}`;

    // Strategy A: check for a manifest file
    try {
      const res = await fetch(`${basePath}/manifest.json`);
      if (res.ok) {
        const names = await res.json();
        if (Array.isArray(names)) {
          return names.filter(n => IMAGE_EXTENSIONS.test(n)).map(n => `${basePath}/${n}`);
        }
      }
    } catch (_) { /* noop */ }

    // Strategy B: probe numbered files (photo-1.jpg … photo-20.jpg, etc.)
    const found = [];
    const exts = ['jpg', 'jpeg', 'png', 'webp'];
    for (let i = 1; i <= 30; i++) {
      for (const ext of exts) {
        const url = `${basePath}/photo-${i}.${ext}`;
        try {
          const r = await fetch(url, { method: 'HEAD' });
          if (r.ok) { found.push(url); break; }
        } catch (_) { /* noop */ }
      }
    }
    return found;
  }

  /**
   * Build the carousel UI inside a .photo-carousel element.
   */
  function buildCarousel(el, urls) {
    if (!urls.length) {
      el.innerHTML = '<div class="photo-placeholder">📸 No photos yet — upload images to <code>images/' +
        el.dataset.folder + '/</code> and push to GitHub!</div>';
      return;
    }

    const track = el.querySelector('.carousel-track');
    const dotsContainer = el.querySelector('.carousel-dots');

    // Populate images
    urls.forEach((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${el.dataset.folder.replace(/-/g, ' ')} photo ${i + 1}`;
      img.loading = i === 0 ? 'eager' : 'lazy';
      track.appendChild(img);
    });

    // Add count badge
    if (urls.length > 1) {
      const countBadge = document.createElement('span');
      countBadge.className = 'carousel-count';
      countBadge.textContent = `1 / ${urls.length}`;
      el.appendChild(countBadge);
    }

    // Dots
    urls.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Go to photo ${i + 1}`);
      dot.dataset.index = i;
      dotsContainer.appendChild(dot);
    });

    // State
    let current = 0;
    const total = urls.length;

    function goTo(idx) {
      current = ((idx % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;

      dotsContainer.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });

      const countEl = el.querySelector('.carousel-count');
      if (countEl) countEl.textContent = `${current + 1} / ${total}`;
    }

    // Button listeners
    el.querySelector('.carousel-btn.prev').addEventListener('click', () => goTo(current - 1));
    el.querySelector('.carousel-btn.next').addEventListener('click', () => goTo(current + 1));

    // Dot listeners
    dotsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('dot')) {
        goTo(parseInt(e.target.dataset.index, 10));
      }
    });

    // Touch / swipe support
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    track.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        goTo(dx < 0 ? current + 1 : current - 1);
      }
    }, { passive: true });

    // Hide buttons if only 1 image
    if (total <= 1) {
      el.querySelector('.carousel-btn.prev').style.display = 'none';
      el.querySelector('.carousel-btn.next').style.display = 'none';
      dotsContainer.style.display = 'none';
    }
  }

  /**
   * Init all carousels on the page.
   */
  async function init() {
    const carousels = document.querySelectorAll('.photo-carousel[data-folder]');
    const useGitHub = isGitHubPages();

    for (const el of carousels) {
      const folder = el.dataset.folder;
      let urls = [];

      try {
        if (useGitHub) {
          urls = await fetchFromGitHub(folder);
        }
        if (!urls.length) {
          urls = await fetchLocal(folder);
        }
        if (!urls.length && !useGitHub) {
          urls = await fetchFromGitHub(folder);
        }
      } catch (err) {
        console.warn(`Carousel [${folder}]: failed to load images`, err);
      }

      buildCarousel(el, urls);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
