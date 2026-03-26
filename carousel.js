/**
 * Costa Rica Travel Journal — Fun Interactive Engine
 *
 * Features:
 *   - Auto-loading photo carousels (GitHub API + local fallback)
 *   - Confetti bursts on carousel navigation
 *   - Floating background emoji
 *   - Bounce effects on highlight chips
 *   - Card tilt on hover
 */

(function () {
  'use strict';

  const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;
  const REPO = 'mariapapadimitriou/costarica';
  const BRANCH = 'main';

  const LOCATION_COLORS = {
    'san-jose':      ['#ff6b6b', '#ff8c42', '#ffb347'],
    'coup-san-juan': ['#4fc3f7', '#00d4ff', '#81d4fa'],
    'la-fortuna':    ['#ff8c42', '#ffb347', '#ff6b6b'],
    'monteverde':    ['#2ecc71', '#a8e06c', '#00bfa5'],
    'santa-teresa':  ['#a855f7', '#c084fc', '#6c5ce7'],
  };

  const CONFETTI_COLORS = ['#ff6b6b', '#ff8c42', '#ffe066', '#2ecc71', '#00d4ff', '#a855f7', '#ff2d7b', '#4fc3f7'];

  /* ======= FLOATING EMOJI ======= */

  function spawnFloatingEmoji() {
    const emojis = ['🌴', '🌺', '🦜', '🦋', '🐸', '🌿', '🦥', '🐢', '🌊', '🌻', '🍍', '🥥', '🏄', '☀️', '🌈'];
    const count = Math.min(8, Math.floor(window.innerWidth / 160));

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'floating-emoji';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = (Math.random() * 90 + 5) + '%';
      el.style.animationDuration = (6 + Math.random() * 6) + 's';
      el.style.animationDelay = (Math.random() * 10) + 's';
      el.style.fontSize = (1.2 + Math.random() * 1.2) + 'rem';
      document.body.appendChild(el);
    }
  }

  /* ======= CONFETTI ======= */

  function burstConfetti(x, y, colors) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = x + 'px';
      piece.style.top = y + 'px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];

      const angle = (Math.PI * 2 * i) / count + (Math.random() - .5) * .5;
      const dist = 60 + Math.random() * 100;
      piece.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      piece.style.setProperty('--dy', Math.sin(angle) * dist - 40 + 'px');

      const size = 6 + Math.random() * 8;
      piece.style.width = size + 'px';
      piece.style.height = size + 'px';
      piece.style.borderRadius = Math.random() > .5 ? '50%' : '2px';

      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
    }
  }

  /* ======= HIGHLIGHT CHIP BOUNCE ======= */

  function setupChipBounce() {
    document.querySelectorAll('.highlights span').forEach(chip => {
      chip.addEventListener('click', function () {
        this.style.animation = 'none';
        void this.offsetHeight;
        this.style.animation = 'chipBounce .5s ease';

        const rect = this.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const item = this.closest('.timeline-item');
        const color = item ? item.dataset.color : 'coral';
        const colorMap = {
          coral: ['#ff6b6b', '#ff8c42'],
          sky: ['#4fc3f7', '#00d4ff'],
          orange: ['#ff8c42', '#ffb347'],
          green: ['#2ecc71', '#a8e06c'],
          purple: ['#a855f7', '#c084fc'],
        };
        burstConfetti(x, y, colorMap[color] || CONFETTI_COLORS);
      });
    });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes chipBounce {
        0%   { transform: scale(1); }
        30%  { transform: scale(1.25) rotate(-4deg); }
        50%  { transform: scale(.9) rotate(3deg); }
        70%  { transform: scale(1.08) rotate(-1deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ======= CARD TILT (subtle 3D) ======= */

  function setupCardTilt() {
    if (window.matchMedia('(hover: none)').matches) return;

    document.querySelectorAll('.day-card').forEach(card => {
      card.addEventListener('mousemove', function (e) {
        const rect = this.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - .5;
        const y = (e.clientY - rect.top) / rect.height - .5;
        this.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 4}deg) translateY(-4px)`;
      });

      card.addEventListener('mouseleave', function () {
        this.style.transform = '';
      });
    });
  }

  /* ======= STAMP CLICK FUN ======= */

  function setupStampClick() {
    const stamp = document.querySelector('.postcard-stamp');
    if (!stamp) return;

    const animals = ['🐸', '🦜', '🦋', '🦥', '🐢', '🐒', '🦎', '🐆', '🦅', '🦩'];
    let idx = 0;

    stamp.style.cursor = 'pointer';
    stamp.addEventListener('click', function (e) {
      idx = (idx + 1) % animals.length;
      this.querySelector('.stamp-icon').textContent = animals[idx];

      const rect = this.getBoundingClientRect();
      burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFETTI_COLORS);

      this.style.animation = 'none';
      void this.offsetHeight;
      this.style.animation = 'stampWiggle .5s ease';
    });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes stampWiggle {
        0%   { transform: rotate(6deg) scale(1); }
        25%  { transform: rotate(-8deg) scale(1.15); }
        50%  { transform: rotate(10deg) scale(1.1); }
        75%  { transform: rotate(-4deg) scale(1.05); }
        100% { transform: rotate(6deg) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ======= BADGE CLICK ======= */

  function setupBadgeClick() {
    const badge = document.querySelector('.trip-badge');
    if (!badge) return;
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#ffe066', '#fff', '#ffb347']);
    });
  }

  /* ======= CAROUSEL ENGINE ======= */

  function isGitHubPages() {
    return location.hostname.endsWith('.github.io') || location.hostname.endsWith('.github.com');
  }

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

  async function fetchLocal(folder) {
    const basePath = `images/${folder}`;
    try {
      const res = await fetch(`${basePath}/manifest.json`);
      if (res.ok) {
        const names = await res.json();
        if (Array.isArray(names)) {
          return names.filter(n => IMAGE_EXTENSIONS.test(n)).map(n => `${basePath}/${n}`);
        }
      }
    } catch (_) { /* noop */ }

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

  function buildCarousel(el, urls) {
    const folder = el.dataset.folder;
    const colors = LOCATION_COLORS[folder] || CONFETTI_COLORS;

    if (!urls.length) {
      el.innerHTML = '<div class="photo-placeholder">📸 No photos yet — upload images to <code>images/' +
        folder + '/</code> and push to GitHub!</div>';
      return;
    }

    const track = el.querySelector('.carousel-track');
    const dotsContainer = el.querySelector('.carousel-dots');

    urls.forEach((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${folder.replace(/-/g, ' ')} photo ${i + 1}`;
      img.loading = i === 0 ? 'eager' : 'lazy';
      track.appendChild(img);
    });

    if (urls.length > 1) {
      const countBadge = document.createElement('span');
      countBadge.className = 'carousel-count';
      countBadge.textContent = `1 / ${urls.length}`;
      el.appendChild(countBadge);
    }

    urls.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Go to photo ${i + 1}`);
      dot.dataset.index = i;
      dotsContainer.appendChild(dot);
    });

    let current = 0;
    const total = urls.length;

    function goTo(idx, triggerEl) {
      current = ((idx % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;

      dotsContainer.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });

      const countEl = el.querySelector('.carousel-count');
      if (countEl) countEl.textContent = `${current + 1} / ${total}`;

      if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, colors);
      }
    }

    el.querySelector('.carousel-btn.prev').addEventListener('click', function () { goTo(current - 1, this); });
    el.querySelector('.carousel-btn.next').addEventListener('click', function () { goTo(current + 1, this); });

    dotsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('dot')) {
        goTo(parseInt(e.target.dataset.index, 10), e.target);
      }
    });

    let startX = 0, startY = 0, isDragging = false;

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

    if (total <= 1) {
      el.querySelector('.carousel-btn.prev').style.display = 'none';
      el.querySelector('.carousel-btn.next').style.display = 'none';
      dotsContainer.style.display = 'none';
    }
  }

  /* ======= INIT ======= */

  async function init() {
    spawnFloatingEmoji();
    setupChipBounce();
    setupCardTilt();
    setupStampClick();
    setupBadgeClick();

    const carousels = document.querySelectorAll('.photo-carousel[data-folder]');
    const useGitHub = isGitHubPages();

    for (const el of carousels) {
      const folder = el.dataset.folder;
      let urls = [];
      try {
        if (useGitHub) urls = await fetchFromGitHub(folder);
        if (!urls.length) urls = await fetchLocal(folder);
        if (!urls.length && !useGitHub) urls = await fetchFromGitHub(folder);
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
