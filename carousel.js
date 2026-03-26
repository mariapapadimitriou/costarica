/**
 * Costa Rica Travel Journal — Interactive Engine
 *
 * - Auto-loading photo carousels (GitHub API + local fallback)
 * - "Stay tuned!" message when no photos yet
 * - Confetti on carousel nav & chip clicks
 * - Floating background emoji
 * - Stamp animal cycle
 * - Card tilt on hover
 */

(function () {
  'use strict';

  const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;
  const REPO = 'mariapapadimitriou/costarica';
  const BRANCH = 'main';

  const CONFETTI_COLORS = ['#e74c3c', '#e67e22', '#f39c12', '#f5b041', '#1abc9c', '#16a085', '#2980b9'];

  /* ======= FLOATING EMOJI ======= */

  function spawnFloatingEmoji() {
    const emojis = ['🌴', '🌺', '🦜', '🦋', '🐸', '🌿', '🦥', '🐢', '🌊', '🍍', '🥥', '☀️'];
    const count = Math.min(6, Math.floor(window.innerWidth / 200));
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'floating-emoji';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = (Math.random() * 90 + 5) + '%';
      el.style.animationDuration = (8 + Math.random() * 6) + 's';
      el.style.animationDelay = (Math.random() * 12) + 's';
      el.style.fontSize = (1.1 + Math.random() * 1) + 'rem';
      document.body.appendChild(el);
    }
  }

  /* ======= CONFETTI ======= */

  function burstConfetti(x, y, colors) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = x + 'px';
      piece.style.top = y + 'px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const angle = (Math.PI * 2 * i) / count + (Math.random() - .5) * .5;
      const dist = 50 + Math.random() * 80;
      piece.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      piece.style.setProperty('--dy', Math.sin(angle) * dist - 30 + 'px');
      const size = 5 + Math.random() * 7;
      piece.style.width = size + 'px';
      piece.style.height = size + 'px';
      piece.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
    }
  }

  /* ======= CHIP BOUNCE ======= */

  function setupChipBounce() {
    document.querySelectorAll('.highlights span').forEach(chip => {
      chip.addEventListener('click', function () {
        this.style.animation = 'none';
        void this.offsetHeight;
        this.style.animation = 'chipBounce .4s ease';
        const rect = this.getBoundingClientRect();
        burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFETTI_COLORS);
      });
    });
    const s = document.createElement('style');
    s.textContent = '@keyframes chipBounce{0%{transform:scale(1)}30%{transform:scale(1.2) rotate(-3deg)}60%{transform:scale(.92) rotate(2deg)}100%{transform:scale(1) rotate(0)}}';
    document.head.appendChild(s);
  }

  /* ======= CARD TILT ======= */

  function setupCardTilt() {
    if (window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('.day-card').forEach(card => {
      card.addEventListener('mousemove', function (e) {
        const r = this.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        this.style.transform = `perspective(600px) rotateY(${x * 5}deg) rotateX(${-y * 3}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', function () { this.style.transform = ''; });
    });
  }

  /* ======= STAMP CLICK ======= */

  function setupStampClick() {
    const stamp = document.querySelector('.postcard-stamp');
    if (!stamp) return;
    const animals = ['🐸', '🦜', '🦋', '🦥', '🐢', '🐒', '🦎', '🐆', '🦅', '🦩'];
    let idx = 0;
    stamp.addEventListener('click', function () {
      idx = (idx + 1) % animals.length;
      this.querySelector('.stamp-icon').textContent = animals[idx];
      const r = this.getBoundingClientRect();
      burstConfetti(r.left + r.width / 2, r.top + r.height / 2, CONFETTI_COLORS);
      this.style.animation = 'none';
      void this.offsetHeight;
      this.style.animation = 'stampWiggle .4s ease';
    });
    const s = document.createElement('style');
    s.textContent = '@keyframes stampWiggle{0%{transform:rotate(5deg) scale(1)}25%{transform:rotate(-8deg) scale(1.12)}50%{transform:rotate(8deg) scale(1.08)}75%{transform:rotate(-3deg) scale(1.04)}100%{transform:rotate(5deg) scale(1)}}';
    document.head.appendChild(s);
  }

  /* ======= BADGE CLICK ======= */

  function setupBadgeClick() {
    const badge = document.querySelector('.trip-badge');
    if (!badge) return;
    badge.addEventListener('click', function () {
      const r = this.getBoundingClientRect();
      burstConfetti(r.left + r.width / 2, r.top + r.height / 2, ['#f5b041', '#fff', '#e67e22']);
    });
  }

  /* ======= CAROUSEL ENGINE ======= */

  function isGitHubPages() {
    return location.hostname.endsWith('.github.io') || location.hostname.endsWith('.github.com');
  }

  async function fetchFromGitHub(folder) {
    const url = `https://api.github.com/repos/${REPO}/contents/images/${folder}?ref=${BRANCH}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const files = await res.json();
    if (!Array.isArray(files)) return [];
    return files.filter(f => IMAGE_EXTENSIONS.test(f.name)).sort((a, b) => a.name.localeCompare(b.name)).map(f => f.download_url);
  }

  async function fetchLocal(folder) {
    const base = `images/${folder}`;
    try {
      const res = await fetch(`${base}/manifest.json`);
      if (res.ok) {
        const names = await res.json();
        if (Array.isArray(names)) return names.filter(n => IMAGE_EXTENSIONS.test(n)).map(n => `${base}/${n}`);
      }
    } catch (_) {}
    const found = [];
    for (let i = 1; i <= 30; i++) {
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        try {
          const r = await fetch(`${base}/photo-${i}.${ext}`, { method: 'HEAD' });
          if (r.ok) { found.push(`${base}/photo-${i}.${ext}`); break; }
        } catch (_) {}
      }
    }
    return found;
  }

  function buildCarousel(el, urls) {
    const folder = el.dataset.folder;

    if (!urls.length) {
      el.innerHTML =
        '<div class="photo-placeholder">' +
          '<span class="stay-tuned-icon">📸</span>' +
          '<span class="stay-tuned-text">Stay tuned!</span>' +
        '</div>';
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
      const badge = document.createElement('span');
      badge.className = 'carousel-count';
      badge.textContent = `1 / ${urls.length}`;
      el.appendChild(badge);
    }

    urls.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Photo ${i + 1}`);
      dot.dataset.index = i;
      dotsContainer.appendChild(dot);
    });

    let current = 0;
    const total = urls.length;

    function goTo(idx, triggerEl) {
      current = ((idx % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      dotsContainer.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === current));
      const c = el.querySelector('.carousel-count');
      if (c) c.textContent = `${current + 1} / ${total}`;
      if (triggerEl) {
        const r = triggerEl.getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top + r.height / 2, CONFETTI_COLORS);
      }
    }

    el.querySelector('.carousel-btn.prev').addEventListener('click', function () { goTo(current - 1, this); });
    el.querySelector('.carousel-btn.next').addEventListener('click', function () { goTo(current + 1, this); });
    dotsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('dot')) goTo(parseInt(e.target.dataset.index, 10), e.target);
    });

    let sx = 0, sy = 0, drag = false;
    track.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; drag = true; }, { passive: true });
    track.addEventListener('touchend', (e) => {
      if (!drag) return;
      drag = false;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(dx < 0 ? current + 1 : current - 1);
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
    const useGH = isGitHubPages();
    for (const el of carousels) {
      const folder = el.dataset.folder;
      let urls = [];
      try {
        if (useGH) urls = await fetchFromGitHub(folder);
        if (!urls.length) urls = await fetchLocal(folder);
        if (!urls.length && !useGH) urls = await fetchFromGitHub(folder);
      } catch (err) { console.warn(`Carousel [${folder}]:`, err); }
      buildCarousel(el, urls);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
