(() => {
  'use strict';

  async function mount(id, url) {
    const target = document.getElementById(id);
    if (!target) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      target.innerHTML = await response.text();
    } catch (error) {
      console.warn(`Не удалось загрузить компонент ${url}:`, error);
    }
  }

  function initMenu() {
    const button = document.querySelector('.header__toggle');
    const nav = document.querySelector('.header__nav');
    if (!button || !nav) return;

    function closeMenu() {
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Открыть меню');
      nav.classList.remove('is-open');
      document.body.classList.remove('menu-open');
    }

    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    window.matchMedia('(min-width: 1051px)').addEventListener('change', (event) => {
      if (event.matches) closeMenu();
    });
  }

  function initCountdown() {
    const timer = document.getElementById('hero-countdown');
    if (!timer) return;

    const targetDate = timer.dataset.target;
    if (!targetDate) return;

    const target = new Date(targetDate).getTime();
    if (!Number.isFinite(target)) return;

    const nodes = Object.fromEntries(
      ['days', 'hours', 'minutes', 'seconds'].map((name) => [
        name,
        timer.querySelector(`[data-time="${name}"]`),
      ]),
    );

    let interval = null;
    function update() {
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const values = {
        days: Math.floor(remaining / 86400),
        hours: Math.floor((remaining % 86400) / 3600),
        minutes: Math.floor((remaining % 3600) / 60),
        seconds: remaining % 60,
      };

      Object.entries(values).forEach(([name, value]) => {
        if (nodes[name]) nodes[name].textContent = String(value).padStart(2, '0');
      });

      if (remaining === 0) {
        timer.setAttribute('aria-label', 'Дата начала соревнований наступила');
        if (interval !== null) clearInterval(interval);
      }
    }

    update();
    if (target > Date.now()) interval = setInterval(update, 1000);
  }


  function initAchievements() {
    const section = document.querySelector('.achievements');
    if (!section) return;
    const values = [...section.querySelectorAll('[data-count]')];
    if (!values.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const animate = (node) => {
      const end = Number(node.dataset.count);
      if (!Number.isFinite(end)) return;
      const suffix = node.dataset.suffix || '';
      const start = performance.now();
      const duration = 1600;
      function frame(time) {
        const progress = Math.min(1, (time - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = `${Math.round(end * eased)}${suffix}`;
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.35 });
    values.forEach((value) => observer.observe(value));
  }


  function initAthletesCarousel() {
    const track = document.querySelector('[data-athletes-track]');
    const prev = document.querySelector('[data-athletes-prev]');
    const next = document.querySelector('[data-athletes-next]');
    if (!track || !prev || !next) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function cardStep() {
      const card = track.querySelector('.athlete-card');
      if (!card) return track.clientWidth;
      const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
      return card.getBoundingClientRect().width + gap;
    }

    function updateControls() {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= maxScroll - 2;
    }

    prev.addEventListener('click', () => {
      track.scrollBy({ left: -cardStep(), behavior: reducedMotion ? 'auto' : 'smooth' });
    });

    next.addEventListener('click', () => {
      track.scrollBy({ left: cardStep(), behavior: reducedMotion ? 'auto' : 'smooth' });
    });

    track.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls);
    updateControls();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
      mount('site-header', '/components/header.html'),
      mount('site-footer', '/components/footer.html'),
    ]);
    initMenu();
    initCountdown();
    initAchievements();
    initAthletesCarousel();
  });
})();
