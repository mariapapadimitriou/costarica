/**
 * Costa Rica Travel Journal — Interactive Engine
 *
 * - Photo grid display (click any photo to open fullscreen lightbox)
 * - Lightbox carousel: portrait & landscape aware, object-fit: contain
 * - Auto-loading photos (GitHub API + local fallback)
 * - Embedded EXIF / XMP caption extraction (reads iPhone captions)
 * - "Stay tuned!" message when no photos yet
 * - Confetti on lightbox nav & chip clicks
 * - Floating background emoji
 * - Stamp animal cycle
 * - Card tilt on hover
 */

(function () {
  'use strict';

  const MEDIA_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|mp4|mov|webm)$/i;
  const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)$/i;
  const JPEG_EXTENSIONS  = /\.(jpe?g)$/i;
  const REPO = 'mariapapadimitriou/costarica';
  const BRANCH = 'main';

  const CONFETTI_COLORS = ['#e74c3c', '#e67e22', '#f39c12', '#f5b041', '#1abc9c', '#16a085', '#2980b9'];

  // Dot indicators are hidden above this count (just show counter instead)
  const DOTS_MAX = 10;

  /* ======= EMBEDDED CAPTION EXTRACTION (EXIF / XMP) ======= */

  function readUTF8(buf, offset, length) {
    var bytes = new Uint8Array(buf, offset, length);
    // Find null terminator
    var end = 0;
    while (end < bytes.length && bytes[end] !== 0) end++;
    // TextDecoder handles multi-byte UTF-8 correctly (including emojis)
    return new TextDecoder('utf-8').decode(bytes.subarray(0, end));
  }

  function extractEXIFCaption(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    if (view.getUint16(0) !== 0xFFD8) return '';

    var offset = 2;
    while (offset < view.byteLength - 1) {
      var marker = view.getUint16(offset);
      if (marker === 0xFFDA) break;
      if ((marker & 0xFF00) !== 0xFF00) break;
      var segLen = view.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        var caption = parseAPP1(arrayBuffer, offset + 4, segLen - 2);
        if (caption) return caption;
      }
      offset += 2 + segLen;
    }
    return '';
  }

  function parseAPP1(buf, start, length) {
    var view = new DataView(buf, start, length);
    var header = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (header !== 'Exif') return '';
    var tiffOffset = start + 6;
    var tiffView = new DataView(buf, tiffOffset);
    var bigEndian = tiffView.getUint16(0) === 0x4D4D;

    function read16(o) { return bigEndian ? tiffView.getUint16(o) : tiffView.getUint16(o, true); }
    function read32(o) { return bigEndian ? tiffView.getUint32(o) : tiffView.getUint32(o, true); }

    function readIFDString(ifdOffset, targetTag) {
      var count = read16(ifdOffset);
      for (var i = 0; i < count; i++) {
        var entryOff = ifdOffset + 2 + i * 12;
        var tag = read16(entryOff);
        if (tag !== targetTag) continue;
        var type = read16(entryOff + 2);
        var num = read32(entryOff + 4);
        if (type === 2) {
          var strOff = num > 4 ? read32(entryOff + 8) : entryOff + 8 - tiffOffset;
          return readUTF8(buf, tiffOffset + strOff, num).trim();
        }
        if (type === 7 && targetTag === 0x9286) {
          var dataOff = num > 4 ? read32(entryOff + 8) : entryOff + 8 - tiffOffset;
          var raw = new Uint8Array(buf, tiffOffset + dataOff, num);
          var charCode = String.fromCharCode(raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[6], raw[7]);
          var text = '';
          if (charCode === 'ASCII\x00\x00\x00' || charCode === '\x00\x00\x00\x00\x00\x00\x00\x00') {
            for (var j = 8; j < raw.length; j++) {
              if (raw[j] === 0) break;
              text += String.fromCharCode(raw[j]);
            }
          }
          return text.trim();
        }
      }
      return '';
    }

    function findExifIFDOffset(ifd0Offset) {
      var count = read16(ifd0Offset);
      for (var i = 0; i < count; i++) {
        var entryOff = ifd0Offset + 2 + i * 12;
        if (read16(entryOff) === 0x8769) return read32(entryOff + 8);
      }
      return 0;
    }

    var ifd0Offset = read32(4);
    var desc = readIFDString(ifd0Offset, 0x010E);
    if (desc) return desc;

    var exifOffset = findExifIFDOffset(ifd0Offset);
    if (exifOffset) {
      var userComment = readIFDString(exifOffset, 0x9286);
      if (userComment) return userComment;
    }

    return '';
  }

  function extractXMPCaption(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    if (view.getUint16(0) !== 0xFFD8) return '';
    var offset = 2;
    while (offset < view.byteLength - 1) {
      var marker = view.getUint16(offset);
      if (marker === 0xFFDA) break;
      if ((marker & 0xFF00) !== 0xFF00) break;
      var segLen = view.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        var bytes = new Uint8Array(arrayBuffer, offset + 4, Math.min(29, segLen - 2));
        var sig = '';
        for (var i = 0; i < bytes.length; i++) sig += String.fromCharCode(bytes[i]);
        if (sig.indexOf('http://ns.adobe.com/xap/1.0/') === 0) {
          var xmpBytes = new Uint8Array(arrayBuffer, offset + 4 + 29, segLen - 2 - 29);
          var xmp = '';
          for (var j = 0; j < xmpBytes.length; j++) xmp += String.fromCharCode(xmpBytes[j]);
          var m = xmp.match(/<dc:description[^>]*>[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/);
          if (m && m[1].trim()) return m[1].trim();
        }
      }
      offset += 2 + segLen;
    }
    return '';
  }

  async function extractEmbeddedData(imageUrl) {
    try {
      var resp = await fetch(imageUrl);
      if (!resp.ok) return { caption: '', date: '' };
      var buf = await resp.arrayBuffer();
      var caption = extractEXIFCaption(buf);
      if (!caption) caption = extractXMPCaption(buf);
      var date = extractEXIFDate(buf);
      return { caption: caption, date: date };
    } catch (_) {
      return { caption: '', date: '' };
    }
  }

  /* Parse DateTimeOriginal (0x9003) from EXIF — returns "YYYY:MM:DD HH:MM:SS" or '' */

  function extractEXIFDate(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    if (view.getUint16(0) !== 0xFFD8) return '';
    var offset = 2;
    while (offset < view.byteLength - 1) {
      var marker = view.getUint16(offset);
      if (marker === 0xFFDA) break;
      if ((marker & 0xFF00) !== 0xFF00) break;
      var segLen = view.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        var d = parseAPP1Date(arrayBuffer, offset + 4, segLen - 2);
        if (d) return d;
      }
      offset += 2 + segLen;
    }
    return '';
  }

  function parseAPP1Date(buf, start, length) {
    var view = new DataView(buf, start, length);
    var h = '';
    for (var k = 0; k < 4; k++) h += String.fromCharCode(view.getUint8(k));
    if (h !== 'Exif') return '';
    var tiffOff = start + 6;
    var tv = new DataView(buf, tiffOff);
    var be = tv.getUint16(0) === 0x4D4D;
    function r16(o) { return be ? tv.getUint16(o) : tv.getUint16(o, true); }
    function r32(o) { return be ? tv.getUint32(o) : tv.getUint32(o, true); }
    function findStr(ifdOff, tag) {
      var n = r16(ifdOff);
      for (var i = 0; i < n; i++) {
        var e = ifdOff + 2 + i * 12;
        if (r16(e) !== tag) continue;
        var cnt = r32(e + 4);
        var off = cnt > 4 ? r32(e + 8) : (e + 8 - tiffOff);
        return readUTF8(buf, tiffOff + off, cnt).trim();
      }
      return '';
    }
    var ifd0 = r32(4);
    // Find Exif sub-IFD (tag 0x8769)
    var exifOff = 0;
    var n0 = r16(ifd0);
    for (var i = 0; i < n0; i++) {
      var e = ifd0 + 2 + i * 12;
      if (r16(e) === 0x8769) { exifOff = r32(e + 8); break; }
    }
    if (exifOff) {
      var dto = findStr(exifOff, 0x9003); // DateTimeOriginal
      if (dto) return dto;
    }
    return findStr(ifd0, 0x0132); // DateTime fallback
  }

  /* Parse date from filenames like 20260327_105631_... */
  function parseDateFromFilename(name) {
    var m = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (m) return m[1] + ':' + m[2] + ':' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + m[6];
    return '';
  }

  /* Convert "YYYY:MM:DD HH:MM:SS" to a timestamp */
  function exifDateToMs(str) {
    if (!str) return 0;
    var norm = str.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    var t = Date.parse(norm);
    return isNaN(t) ? 0 : t;
  }

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

  /* ======= LIGHTBOX ======= */

  var lbEl = null;

  function initLightbox() {
    lbEl = document.createElement('div');
    lbEl.className = 'lightbox';
    lbEl.setAttribute('role', 'dialog');
    lbEl.setAttribute('aria-modal', 'true');
    lbEl.setAttribute('aria-label', 'Photo viewer');
    lbEl.style.display = 'none';

    lbEl.innerHTML =
      '<button class="lb-close" aria-label="Close">&#x2715;</button>' +
      '<div class="lb-media">' +
        '<img class="lb-img" src="" alt="" />' +
        '<video class="lb-video" controls playsinline></video>' +
      '</div>' +
      '<div class="lb-footer">' +
        '<div class="lb-caption"></div>' +
        '<div class="lb-count"></div>' +
        '<div class="lb-dots"></div>' +
      '</div>' +
      '<button class="lb-btn lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<button class="lb-btn lb-next" aria-label="Next photo">&#8250;</button>';

    document.body.appendChild(lbEl);

    var imgEl     = lbEl.querySelector('.lb-img');
    var videoEl   = lbEl.querySelector('.lb-video');
    var captionEl = lbEl.querySelector('.lb-caption');
    var countEl   = lbEl.querySelector('.lb-count');
    var dotsEl    = lbEl.querySelector('.lb-dots');
    var prevBtn   = lbEl.querySelector('.lb-prev');
    var nextBtn   = lbEl.querySelector('.lb-next');
    var closeBtn  = lbEl.querySelector('.lb-close');

    var lbImages   = [];
    var lbCaptions = [];
    var lbCurrent  = 0;

    function goTo(idx) {
      var total = lbImages.length;
      // Pause any playing video before switching
      videoEl.pause();
      lbCurrent = ((idx % total) + total) % total;
      var item = lbImages[lbCurrent];
      if (VIDEO_EXTENSIONS.test(item.name)) {
        imgEl.style.display = 'none';
        videoEl.style.display = '';
        videoEl.src = item.url;
      } else {
        videoEl.style.display = 'none';
        videoEl.src = '';
        imgEl.style.display = '';
        imgEl.src = item.url;
        imgEl.alt = lbCaptions[lbCurrent] || ('Photo ' + (lbCurrent + 1));
      }
      captionEl.textContent = lbCaptions[lbCurrent] || '';
      captionEl.style.display = lbCaptions[lbCurrent] ? '' : 'none';
      countEl.textContent = (lbCurrent + 1) + ' / ' + total;
      dotsEl.querySelectorAll('.lb-dot').forEach(function (d, i) {
        d.classList.toggle('active', i === lbCurrent);
      });
    }

    function open(images, captions, startIdx) {
      lbImages   = images;
      lbCaptions = captions;

      // Rebuild dots (only when ≤15 photos — more is too crowded)
      dotsEl.innerHTML = '';
      if (images.length > 1 && images.length <= 15) {
        images.forEach(function (_, i) {
          var dot = document.createElement('button');
          dot.className = 'lb-dot' + (i === startIdx ? ' active' : '');
          dot.setAttribute('aria-label', 'Photo ' + (i + 1));
          dot.dataset.index = i;
          dotsEl.appendChild(dot);
        });
      }

      prevBtn.style.display = images.length > 1 ? '' : 'none';
      nextBtn.style.display = images.length > 1 ? '' : 'none';

      lbEl.style.display = 'flex';
      // Double rAF to trigger CSS transition after display:flex
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { lbEl.classList.add('active'); });
      });
      document.body.style.overflow = 'hidden';

      goTo(startIdx);
    }

    function close() {
      videoEl.pause();
      lbEl.classList.remove('active');
      setTimeout(function () {
        lbEl.style.display = 'none';
        document.body.style.overflow = '';
      }, 260);
    }

    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      burstConfetti(e.clientX, e.clientY, CONFETTI_COLORS);
      goTo(lbCurrent - 1);
    });
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      burstConfetti(e.clientX, e.clientY, CONFETTI_COLORS);
      goTo(lbCurrent + 1);
    });

    dotsEl.addEventListener('click', function (e) {
      if (e.target.classList.contains('lb-dot')) {
        goTo(parseInt(e.target.dataset.index, 10));
      }
    });

    closeBtn.addEventListener('click', close);

    // Click on dark backdrop closes lightbox
    lbEl.addEventListener('click', function (e) {
      if (e.target === lbEl) close();
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!lbEl.classList.contains('active')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(lbCurrent + 1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo(lbCurrent - 1);
      if (e.key === 'Escape') close();
    });

    // Touch swipe
    var touchStartX = 0;
    lbEl.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    lbEl.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? lbCurrent + 1 : lbCurrent - 1);
    }, { passive: true });

    lbEl._open = open;
  }

  function openLightbox(images, captions, startIdx) {
    if (!lbEl) initLightbox();
    lbEl._open(images, captions, startIdx);
  }

  /* ======= INLINE CAROUSEL ======= */

  function buildPhotoDisplay(el, images, captions) {
    var folder = el.dataset.folder;
    el.innerHTML = '';

    if (!images.length) {
      el.innerHTML =
        '<div class="photo-placeholder">' +
          '<span class="stay-tuned-icon">📸</span>' +
          '<span class="stay-tuned-text">Stay tuned!</span>' +
        '</div>';
      return;
    }

    var total        = images.length;
    var captionTexts = images.map(function (img) { return captions[img.name] || ''; });
    var current      = 0;

    // Track
    var track = document.createElement('div');
    track.className = 'carousel-track';

    images.forEach(function (img, i) {
      var slide = document.createElement('div');
      slide.className = 'carousel-slide';

      if (VIDEO_EXTENSIONS.test(img.name)) {
        var videoEl = document.createElement('video');
        videoEl.src = img.url;
        videoEl.controls = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.preload = 'metadata';
        slide.appendChild(videoEl);
      } else {
        var imgEl = document.createElement('img');
        imgEl.src = img.url;
        imgEl.alt = captionTexts[i] || (folder.replace(/-/g, ' ') + ' photo ' + (i + 1));
        imgEl.loading = i === 0 ? 'eager' : 'lazy';
        imgEl.style.cursor = 'zoom-in';
        imgEl.addEventListener('click', function () { openLightbox(images, captionTexts, current); });
        slide.appendChild(imgEl);
      }

      track.appendChild(slide);
    });

    el.appendChild(track);

    // Caption
    var hasAnyCaptions = captionTexts.some(function (c) { return c; });
    var captionEl = null;
    if (hasAnyCaptions) {
      captionEl = document.createElement('div');
      captionEl.className = 'carousel-caption';
      captionEl.textContent = captionTexts[0];
      if (!captionTexts[0]) captionEl.style.display = 'none';
      el.appendChild(captionEl);
    }

    // Counter badge
    var countBadge = null;
    if (total > 1) {
      countBadge = document.createElement('span');
      countBadge.className = 'carousel-count';
      countBadge.textContent = '1 / ' + total;
      el.appendChild(countBadge);
    }

    // Prev / Next buttons
    var prevBtn = document.createElement('button');
    prevBtn.className = 'carousel-btn prev';
    prevBtn.setAttribute('aria-label', 'Previous');
    prevBtn.innerHTML = '&#8249;';

    var nextBtn = document.createElement('button');
    nextBtn.className = 'carousel-btn next';
    nextBtn.setAttribute('aria-label', 'Next');
    nextBtn.innerHTML = '&#8250;';

    el.appendChild(prevBtn);
    el.appendChild(nextBtn);

    // Dots (only when not too many photos)
    var dotsContainer = document.createElement('div');
    dotsContainer.className = 'carousel-dots';
    var showDots = total > 1 && total <= DOTS_MAX;
    if (showDots) {
      images.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Photo ' + (i + 1));
        dot.dataset.index = i;
        dotsContainer.appendChild(dot);
      });
    }
    if (showDots) {
      el.appendChild(dotsContainer);
    }

    function goTo(idx, triggerEl) {
      // Pause any video on the slide we're leaving
      var prevSlide = track.children[current];
      var prevVideo = prevSlide && prevSlide.querySelector('video');
      if (prevVideo) prevVideo.pause();

      current = ((idx % total) + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      if (showDots) {
        dotsContainer.querySelectorAll('.dot').forEach(function (d, i) {
          d.classList.toggle('active', i === current);
        });
      }
      if (countBadge) countBadge.textContent = (current + 1) + ' / ' + total;
      if (captionEl) {
        var txt = captionTexts[current];
        captionEl.textContent = txt;
        captionEl.style.display = txt ? '' : 'none';
      }
      if (triggerEl) {
        var r = triggerEl.getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top + r.height / 2, CONFETTI_COLORS);
      }
    }

    prevBtn.addEventListener('click', function () { goTo(current - 1, this); });
    nextBtn.addEventListener('click', function () { goTo(current + 1, this); });

    if (showDots) {
      dotsContainer.addEventListener('click', function (e) {
        if (e.target.classList.contains('dot')) goTo(parseInt(e.target.dataset.index, 10), e.target);
      });
    }

    // Touch swipe on track
    var sx = 0, sy = 0, drag = false;
    track.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; drag = true; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (!drag) return;
      drag = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(dx < 0 ? current + 1 : current - 1);
    }, { passive: true });

    if (total <= 1) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
  }

  /* ======= IMAGE FETCHING ======= */

  function isGitHubPages() {
    return location.hostname.endsWith('.github.io') || location.hostname.endsWith('.github.com');
  }

  async function fetchDates(folder) {
    const base = `images/${folder}`;
    try {
      const res = await fetch(`${base}/dates.json`);
      if (res.ok) return await res.json();
    } catch (_) {}
    if (isGitHubPages()) {
      try {
        const url = `https://api.github.com/repos/${REPO}/contents/images/${folder}/dates.json?ref=${BRANCH}`;
        const res = await fetch(url);
        if (res.ok) {
          const file = await res.json();
          if (file.download_url) {
            const r2 = await fetch(file.download_url);
            if (r2.ok) return await r2.json();
          }
        }
      } catch (_) {}
    }
    return {};
  }

  async function fetchCaptions(folder) {
    const base = `images/${folder}`;
    try {
      const res = await fetch(`${base}/captions.json`);
      if (res.ok) return await res.json();
    } catch (_) {}
    if (isGitHubPages()) {
      try {
        const url = `https://api.github.com/repos/${REPO}/contents/images/${folder}/captions.json?ref=${BRANCH}`;
        const res = await fetch(url);
        if (res.ok) {
          const file = await res.json();
          if (file.download_url) {
            const r2 = await fetch(file.download_url);
            if (r2.ok) return await r2.json();
          }
        }
      } catch (_) {}
    }
    return {};
  }

  async function fetchFromGitHub(folder) {
    const url = `https://api.github.com/repos/${REPO}/contents/images/${folder}?ref=${BRANCH}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const files = await res.json();
    if (!Array.isArray(files)) return [];
    return files.filter(f => MEDIA_EXTENSIONS.test(f.name)).sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ url: f.download_url, name: f.name }));
  }

  async function fetchLocal(folder) {
    const base = `images/${folder}`;
    try {
      const res = await fetch(`${base}/manifest.json`);
      if (res.ok) {
        const names = await res.json();
        if (Array.isArray(names)) return names.filter(n => MEDIA_EXTENSIONS.test(n)).map(n => ({ url: `${base}/${n}`, name: n }));
      }
    } catch (_) {}
    const found = [];
    for (let i = 1; i <= 30; i++) {
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        const name = `photo-${i}.${ext}`;
        try {
          const r = await fetch(`${base}/${name}`, { method: 'HEAD' });
          if (r.ok) { found.push({ url: `${base}/${name}`, name }); break; }
        } catch (_) {}
      }
    }
    return found;
  }

  /* ======= STOPS SCHEDULE ======= */

  const STOPS = [
    { folder: 'san-jose',      name: 'San José',      emoji: '🏙️', startDay: 1,  endDay: 1  },
    { folder: 'coup-san-juan', name: 'Coop San Juan',  emoji: '🏡', startDay: 2,  endDay: 2  },
    { folder: 'la-fortuna',    name: 'La Fortuna',     emoji: '🌋', startDay: 3,  endDay: 4  },
    { folder: 'monteverde',    name: 'Monteverde',     emoji: '☁️', startDay: 5,  endDay: 6  },
    { folder: 'santa-teresa',  name: 'Santa Teresa',   emoji: '🏄', startDay: 7,  endDay: 10 },
  ];

  /* ======= DAY COUNTER ======= */

  function setupDayCounter() {
    const el = document.getElementById('day-counter-text');
    if (!el) return;

    const tripStart = new Date(2026, 2, 26); // Mar 26, 2026
    const tripEnd   = new Date(2026, 3, 5);  // Apr 5, 2026
    const totalDays = 10;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const startMs = tripStart.getTime();
    const endMs   = tripEnd.getTime();
    const nowMs   = now.getTime();

    const progressFill = document.querySelector('.progress-fill');
    const progressLabel = document.querySelector('.progress-label');

    let dayNum = 0;

    if (nowMs < startMs) {
      const daysUntil = Math.ceil((startMs - nowMs) / 86400000);
      el.textContent = daysUntil === 1 ? 'Tomorrow!' : `${daysUntil} days to go!`;
      if (progressFill) progressFill.style.width = '0%';
      if (progressLabel) progressLabel.lastElementChild.textContent = 'Not started yet!';
    } else if (nowMs > endMs) {
      dayNum = totalDays + 1;
      el.innerHTML = 'Trip complete! 🎉';
      if (progressFill) progressFill.style.width = '100%';
      if (progressLabel) progressLabel.lastElementChild.textContent = 'Done!';
    } else {
      dayNum = Math.floor((nowMs - startMs) / 86400000) + 1;
      el.innerHTML = `Day ${dayNum}<span class="day-counter-sub"> / ${totalDays}</span>`;
      const pct = Math.round((dayNum / totalDays) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressLabel) progressLabel.lastElementChild.textContent = `Day ${dayNum} of ${totalDays}`;
    }

    updateTripBadge(dayNum, totalDays);
    updateCardStatuses(dayNum);
  }

  /* ======= DYNAMIC BADGE ======= */

  function updateTripBadge(dayNum, totalDays) {
    const badge = document.getElementById('trip-badge');
    if (!badge) return;

    if (dayNum === 0) {
      badge.className = 'trip-badge departing';
      badge.textContent = '✈️ Departing Soon';
      return;
    }

    if (dayNum > totalDays) {
      badge.className = 'trip-badge done';
      badge.textContent = '🎉 Trip Complete';
      return;
    }

    const current = STOPS.find(s => dayNum >= s.startDay && dayNum <= s.endDay);
    if (current) {
      badge.className = 'trip-badge active';
      badge.textContent = `${current.emoji} Currently in ${current.name}`;
    }
  }

  /* ======= DYNAMIC CARD STATUSES ======= */

  function updateCardStatuses(dayNum) {
    const cards = document.querySelectorAll('.timeline-item');
    cards.forEach((item, i) => {
      if (i >= STOPS.length) return;
      const stop = STOPS[i];
      const tag = item.querySelector('.status-tag');
      if (!tag) return;

      if (dayNum === 0) {
        tag.className = 'status-tag upcoming';
        tag.textContent = 'Upcoming';
        item.className = 'timeline-item upcoming';
      } else if (dayNum > stop.endDay) {
        tag.className = 'status-tag visited';
        tag.textContent = 'Visited';
        item.className = 'timeline-item visited';
      } else if (dayNum >= stop.startDay && dayNum <= stop.endDay) {
        tag.className = 'status-tag current';
        tag.textContent = '📍 Now';
        item.className = 'timeline-item current';
      } else {
        tag.className = 'status-tag upcoming';
        tag.textContent = 'Upcoming';
        item.className = 'timeline-item upcoming';
      }
    });
  }

  /* ======= INIT ======= */

  async function init() {
    spawnFloatingEmoji();
    setupDayCounter();
    setupChipBounce();
    setupCardTilt();
    setupStampClick();
    setupBadgeClick();

    const carousels = document.querySelectorAll('.photo-carousel[data-folder]');
    const useGH = isGitHubPages();
    for (const el of carousels) {
      const folder = el.dataset.folder;
      let images = [];
      try {
        if (useGH) images = await fetchFromGitHub(folder);
        if (!images.length) images = await fetchLocal(folder);
        if (!images.length && !useGH) images = await fetchFromGitHub(folder);
      } catch (err) { console.warn(`Carousel [${folder}]:`, err); }
      let captions = {};
      let dates = {};
      if (images.length) {
        try { captions = await fetchCaptions(folder); } catch (_) {}
        try { dates = await fetchDates(folder); } catch (_) {}
        // Fetch EXIF caption + date in one pass; skip files already in dates.json
        var embeddedResults = await Promise.all(images.map(function (img) {
          if (!JPEG_EXTENSIONS.test(img.name) || VIDEO_EXTENSIONS.test(img.name) || dates[img.name])
            return Promise.resolve({ caption: '', date: '' });
          return extractEmbeddedData(img.url);
        }));
        for (var i = 0; i < images.length; i++) {
          if (!captions[images[i].name] && embeddedResults[i].caption)
            captions[images[i].name] = embeddedResults[i].caption;
          if (!dates[images[i].name] && embeddedResults[i].date)
            dates[images[i].name] = embeddedResults[i].date;
        }
        // Sort newest → oldest; filename date as last-resort fallback
        images = images.map(function (img) {
          var dateStr = dates[img.name] || parseDateFromFilename(img.name);
          return { img: img, ts: exifDateToMs(dateStr) };
        }).sort(function (a, b) { return b.ts - a.ts; }).map(function (d) { return d.img; });
      }
      buildPhotoDisplay(el, images, captions);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
