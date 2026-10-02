/* ==========================================================================
   Narne Labs — interactions
   Works without GSAP/Lenis (content simply shows); enhances when they load.
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  if (!hasGSAP || reduceMotion) root.classList.add('no-anim');
  else root.classList.add('anim-ready');

  /* ---------------- Split text into words ---------------- */
  $$('[data-split]').forEach((el) => {
    // background-clip:text breaks on transformed children, so gradient words carry the gradient themselves
    const walk = (node, gradient = false) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'word';
            const inner = document.createElement('span'); inner.className = 'word-inner' + (gradient ? ' gradient-text' : ''); inner.textContent = part;
            w.appendChild(inner); frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          const g = gradient || child.classList.contains('gradient-text');
          child.classList.remove('gradient-text');
          if (g) child.style.fontStyle = 'normal';
          walk(child, g);
        }
      });
    };
    walk(el);
  });

  // Manifesto words
  $$('[data-words]').forEach((el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  });

  /* ---------------- Smooth scroll ---------------- */
  let lenis = null;
  if (typeof window.Lenis !== 'undefined' && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    window.__lenis = lenis;
    if (hasGSAP) {
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollTo = (target) => {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
  };

  // In-page anchor links
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMenu();
      scrollTo(target);
    });
  });

  /* ---------------- Mobile menu ---------------- */
  const toggle = $('.nav__toggle');
  const menu = $('.menu');
  function closeMenu() {
    root.classList.remove('menu-open');
    toggle?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-hidden', 'true');
    lenis?.start();
  }
  toggle?.addEventListener('click', () => {
    const open = !root.classList.contains('menu-open');
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu?.setAttribute('aria-hidden', String(!open));
    open ? lenis?.stop() : lenis?.start();
  });

  /* ---------------- Nav hide on scroll + active link ---------------- */
  const nav = $('.nav');
  let lastY = window.scrollY;
  const navLinks = $$('.nav__links a');
  const onScroll = () => {
    const y = window.scrollY;
    if (nav && !root.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > lastY && y > 300);
    lastY = y;
    let current = null;
    navLinks.forEach((a) => {
      const href = a.getAttribute('href');
      const s = href && href.startsWith('#') ? $(href) : null; // links to other pages (e.g. "/#apps") aren't sections here
      if (s && s.getBoundingClientRect().top < window.innerHeight * 0.4) current = a;
    });
    navLinks.forEach((a) => a.classList.toggle('is-active', a === current));
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- Text scramble ---------------- */
  class Scramble {
    constructor(el) { this.el = el; this.chars = '!<>-_\\/[]{}—=+*^?#01ΔΣΩλ'; this.update = this.update.bind(this); }
    set(text) {
      const old = this.el.textContent; const len = Math.max(old.length, text.length);
      this.queue = [];
      for (let i = 0; i < len; i++) {
        const start = Math.floor(Math.random() * 20); const end = start + Math.floor(Math.random() * 22);
        this.queue.push({ from: old[i] || '', to: text[i] || '', start, end, char: '' });
      }
      cancelAnimationFrame(this.raf); this.frame = 0;
      return new Promise((r) => { this.resolve = r; this.update(); });
    }
    update() {
      let out = ''; let done = 0;
      for (const q of this.queue) {
        if (this.frame >= q.end) { done++; out += q.to; }
        else if (this.frame >= q.start) {
          if (!q.char || Math.random() < 0.28) q.char = this.chars[Math.floor(Math.random() * this.chars.length)];
          out += `<span class="dim">${q.char}</span>`;
        } else out += q.from;
      }
      this.el.innerHTML = out;
      if (done === this.queue.length) this.resolve();
      else { this.raf = requestAnimationFrame(this.update); this.frame++; }
    }
  }
  $$('[data-scramble]').forEach((el) => {
    const words = el.dataset.scramble.split('|');
    if (reduceMotion) return;
    const fx = new Scramble(el); let i = 0;
    const next = () => { i = (i + 1) % words.length; fx.set(words[i]).then(() => setTimeout(next, 2200)); };
    setTimeout(next, 3200);
  });

  /* ---------------- Terminal typing ---------------- */
  const term = $('.js-terminal');
  if (term) {
    const lines = [
      ['$ ', 'narne build --next'],
      ['', '<span class="ok">✔</span> idea validated'],
      ['', '<span class="ok">✔</span> prototype compiled'],
      ['', '<span class="hl">◆</span> training on-device model…'],
      ['', '<span class="hl">◆</span> polishing UI · 87%'],
    ];
    let started = false;
    const run = async () => {
      if (started) return; started = true;
      for (;;) {
        term.innerHTML = '';
        for (const [prefix, text] of lines) {
          const isCmd = prefix === '$ ';
          if (isCmd) {
            term.innerHTML += '<span class="dim">$ </span>';
            for (const ch of text) { term.innerHTML += ch; await wait(45); }
            term.innerHTML += '\n';
          } else {
            await wait(520);
            term.innerHTML += text + '\n';
          }
        }
        term.innerHTML += '<span class="cur"></span>';
        await wait(4200);
      }
    };
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { run(); o.disconnect(); } }, { threshold: 0.3 }).observe(term);
  }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /* ---------------- Live mini-visuals ---------------- */
  const sizeEl = $('.js-size');
  if (sizeEl) {
    // syncs with the CSS "squeeze" keyframes (4.5s loop: shrink 15%→60%, grow back 85%→100%)
    const t0 = performance.now();
    const loop = (now) => {
      const p = ((now - t0) / 4500) % 1;
      let k;
      if (p < 0.15) k = 0; else if (p < 0.6) k = easeOut((p - 0.15) / 0.45); else if (p < 0.85) k = 1; else k = 1 - (p - 0.85) / 0.15;
      sizeEl.textContent = (248 - k * (248 - 15.8)).toFixed(1) + ' MB';
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  $$('.js-rounds').forEach((el) => {
    let n = 0;
    setInterval(() => { n = (n + 1) % 109; el.textContent = n; }, 3200);
  });

  /* ---------------- Copy email ---------------- */
  $$('.js-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied ✓'; }
      catch { btn.textContent = 'Press Ctrl+C'; }
      setTimeout(() => (btn.textContent = 'Copy'), 1800);
    });
  });

  /* ---------------- Footer clock & year ---------------- */
  const clock = $('.js-clock');
  if (clock) { const t = () => (clock.textContent = new Date().toLocaleTimeString([], { hour12: false })); t(); setInterval(t, 1000); }
  $$('.js-year').forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------------- HUD coordinates ---------------- */
  const coords = $('.js-coords');
  if (coords && finePointer) {
    window.addEventListener('pointermove', (e) => {
      coords.textContent = `X ${(e.clientX / innerWidth * 2 - 1).toFixed(3)} · Y ${(-(e.clientY / innerHeight) * 2 + 1).toFixed(3)}`;
    }, { passive: true });
  }

  /* ---------------- Tilt + spotlight ---------------- */
  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
        card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
        setTimeout(() => card.classList.remove('is-tilting'), 150);
      });
    });
  } else {
    // still give the spotlight on touch
    $$('[data-tilt]').forEach((card) => card.addEventListener('pointerdown', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`); card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (finePointer && !reduceMotion) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    });
  }

  /* ---------------- Custom cursor ---------------- */
  if (finePointer && !reduceMotion) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    if (cursor) {
      root.classList.add('has-cursor');
      cursor.style.opacity = '0';
      window.addEventListener('pointermove', () => (cursor.style.opacity = '1'), { once: true });
      let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
      window.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px)`; }, { passive: true });
      const loop = () => { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = `translate(${rx}px, ${ry}px)`; requestAnimationFrame(loop); };
      loop();
      document.addEventListener('pointerover', (e) => {
        const t = e.target.closest('a, button, [data-cursor]');
        if (!t) { cursor.classList.remove('is-hover', 'is-label'); return; }
        const text = t.dataset.cursor;
        if (text) { label.textContent = text; cursor.classList.add('is-label'); cursor.classList.remove('is-hover'); }
        else { cursor.classList.add('is-hover'); cursor.classList.remove('is-label'); }
      });
      document.addEventListener('mouseleave', () => cursor.style.opacity = '0');
      document.addEventListener('mouseenter', () => cursor.style.opacity = '1');
    }
  }

  /* ---------------- Preloader → intro ---------------- */
  const pre = $('.preloader');
  const bar = $('.preloader__bar i');
  const pct = $('.preloader__pct span');
  let progress = 0, sceneReady = false, fontsReady = false, finished = false;
  window.addEventListener('nl:scene-ready', () => (sceneReady = true));
  if (document.fonts?.ready) document.fonts.ready.then(() => (fontsReady = true)); else fontsReady = true;
  const startT = performance.now();

  const step = () => {
    const elapsed = performance.now() - startT;
    const cap = sceneReady && fontsReady ? 100 : 88;
    progress += (cap - progress) * 0.08 + 0.4;
    progress = Math.min(progress, cap);
    if (elapsed > 3000) progress = 100; // never hold the visitor hostage
    if (bar) bar.style.width = progress + '%';
    if (pct) pct.textContent = Math.floor(progress);
    if (progress >= 99.5 && elapsed > 1100) return finish();
    requestAnimationFrame(step);
  };
  if (pre) requestAnimationFrame(step); else finish();
  setTimeout(finish, 3200); // hard cap, independent of rAF (throttled tabs, slow GPUs)

  function finish() {
    if (finished) return; finished = true;
    pre?.classList.add('is-done');
    setTimeout(() => pre?.remove(), 1000);
    intro();
  }

  /* ---------------- Scroll animations ---------------- */
  function intro() {
    if (!hasGSAP || reduceMotion) return;
    gsap.registerPlugin(ScrollTrigger);

    // Hero
    const hero = $('.hero');
    if (hero) {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to($$('.hero__title .word-inner'), { y: 0, duration: 1.4, stagger: 0.08 }, 0.1)
        .to($$('.hero .reveal'), { opacity: 1, y: 0, duration: 1.2, stagger: 0.09 }, 0.35)
        .from($$('.hud'), { opacity: 0, duration: 1.2, stagger: 0.1 }, 0.6);

      // hero content drifts as you scroll away
      gsap.to('.hero__content', {
        yPercent: -18, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
    }

    // Split headings (outside hero)
    $$('[data-split]').forEach((el) => {
      if (el.closest('.hero')) return;
      gsap.to($$('.word-inner', el), {
        y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    // Generic reveals
    $$('.reveal').forEach((el) => {
      if (el.closest('.hero')) return;
      gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    // Cards
    ScrollTrigger.batch('.reveal-card', {
      start: 'top 90%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, overwrite: true }),
    });

    // Manifesto words light up
    const words = $$('.manifesto__text .w');
    if (words.length) {
      gsap.to(words, {
        opacity: 1, stagger: 0.05, ease: 'none',
        scrollTrigger: { trigger: '.manifesto__text', start: 'top 75%', end: 'bottom 45%', scrub: 0.6 },
      });
    }

    // Counters
    $$('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      const dec = Number(el.dataset.decimals || 0);
      const suffix = el.dataset.suffix || '';
      const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (suffix ? `<small>${suffix}</small>` : '');
      const obj = { v: end === 0 ? 1024 : 0 };
      el.innerHTML = fmt(obj.v);
      gsap.to(obj, {
        v: end, duration: 2.2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
        onUpdate: () => (el.innerHTML = fmt(dec ? obj.v : Math.round(obj.v))),
      });
    });

    // Horizontal process (desktop)
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const track = $('.process__track');
      const section = $('.process');
      if (!track || !section) return;
      const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);
      gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.8, invalidateOnRefresh: true },
      });
      gsap.from($$('.step__line'), {
        scaleX: 0, transformOrigin: 'left', stagger: 0.15, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + distance(), scrub: true },
      });
    });

    // Footer giant word parallax
    gsap.from('.footer__giant', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

    // Sub-page generic reveal for .page content
    if (!hero) {
      gsap.to($$('.page [data-split] .word-inner'), { y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
    }

    window.addEventListener('load', () => ScrollTrigger.refresh());
  }
})();
