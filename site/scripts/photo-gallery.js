(() => {
  'use strict';

  function init() {
    const grid = document.querySelector('[data-gallery-grid], [data-coach-gallery]');
    const modal = document.querySelector('[data-lightbox], [data-coach-lightbox]');
    if (!grid || !modal || modal.dataset.galleryReady) return;

    const coach = modal.hasAttribute('data-coach-lightbox');
    const prefix = coach ? 'coach' : 'lightbox';
    const itemSelector = coach ? 'button[data-coach-media]' : '[data-media-type]';
    const filterAttr = coach ? 'data-coach-filter' : 'data-gallery-filter';
    const items = [...grid.querySelectorAll(itemSelector)];
    const filters = [...document.querySelectorAll('[' + filterAttr + ']')];
    const more = document.querySelector(coach ? '[data-coach-more]' : '[data-gallery-more]');
    const moreWrap = more?.closest('[data-coach-more-wrap], .profile-gallery__more-wrap') || more;
    const empty = document.querySelector('[data-coach-empty], [data-gallery-empty]');
    const stage = modal.querySelector('[data-' + prefix + '-stage]');
    const media = stage?.querySelector('[class$="__media"]');
    const caption = modal.querySelector('[data-' + prefix + '-caption]');
    const counter = modal.querySelector(coach ? '[data-coach-count]' : '[data-lightbox-counter]');
    const prev = modal.querySelector('[data-' + prefix + '-prev]');
    const next = modal.querySelector('[data-' + prefix + '-next]');
    const closeButton = modal.querySelector('button[data-' + prefix + '-close]');
    if (!items.length || !media || !caption || !counter || !prev || !next || !closeButton) return;

    modal.dataset.galleryReady = 'true';
    prev.textContent = '‹';
    next.textContent = '›';
    closeButton.textContent = '×';
    let filter = 'all';
    let expanded = false;
    let slides = [];
    let selected = 0;
    let opener;
    let pointer;
    let revision = 0;
    const preloaded = new Map();

    const category = item => coach ? item.dataset.category : item.dataset.galleryCategory;
    const isVideo = item => (item.dataset.mediaType || item.dataset.type) === 'video';
    const source = item => isVideo(item) ? item.dataset.videoSrc || item.dataset.full : item.dataset.full;
    const matching = () => items.filter(item => filter === 'all' || category(item) === filter);

    function refresh() {
      const matches = matching();
      const shown = new Set(!more || expanded || filter !== 'all' ? matches : matches.slice(0, 6));
      items.forEach(item => { item.hidden = !shown.has(item); });
      if (empty) empty.hidden = matches.length > 0;
      if (moreWrap) moreWrap.hidden = filter !== 'all' || expanded || matches.length <= 6;
    }

    function imageFor(url) {
      const image = new Image();
      image.decoding = 'async';
      image.draggable = false;
      image.src = url;
      return image;
    }

    function preloadNeighbors() {
      const nearby = new Set([-1, 1].map(delta => slides[(selected + delta + slides.length) % slides.length])
        .filter(item => item && !isVideo(item)).map(source));
      for (const url of preloaded.keys()) if (!nearby.has(url)) preloaded.delete(url);
      for (const url of nearby) if (!preloaded.has(url)) preloaded.set(url, imageFor(url));
    }

    async function render() {
      const item = slides[selected];
      const ticket = ++revision;
      const url = source(item);
      const alt = item.querySelector('img')?.alt || 'Фотография';
      const label = item.dataset.caption || alt;
      const video = isVideo(item);
      const element = video ? document.createElement('video') : (preloaded.get(url) || imageFor(url));
      media.querySelector('video')?.pause();
      if (video) {
        element.controls = true;
        element.playsInline = true;
        element.preload = 'metadata';
        element.src = url;
        element.setAttribute('aria-label', label);
      } else {
        element.alt = alt;
      }

      preloadNeighbors();
      if (!video && typeof element.decode === 'function') {
        try { await element.decode(); } catch { /* The browser shows the image's alt text if loading failed. */ }
      }
      if (modal.hidden || ticket !== revision) return;
      media.replaceChildren(element);
      element.animate?.([{opacity: 0.55}, {opacity: 1}], {
        duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 160,
        easing: 'ease-out',
      });
      caption.textContent = label;
      const number = value => String(value).padStart(2, '0');
      counter.textContent = number(selected + 1) + ' / ' + number(slides.length);
    }

    function move(delta) {
      if (modal.hidden || slides.length < 2) return;
      selected = (selected + delta + slides.length) % slides.length;
      void render();
    }

    grid.addEventListener('click', event => {
      const item = event.target.closest(itemSelector);
      if (!item || !grid.contains(item) || item.hidden) return;
      slides = matching().filter(source);
      selected = slides.indexOf(item);
      if (selected < 0) return;
      opener = item;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('gallery-viewer-open', 'athlete-lightbox-open');
      prev.disabled = next.disabled = slides.length < 2;
      closeButton.focus({preventScroll: true});
      void render();
    });

    function close() {
      if (modal.hidden) return;
      revision++;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('gallery-viewer-open', 'athlete-lightbox-open');
      media.replaceChildren();
      counter.textContent = caption.textContent = '';
      preloaded.clear();
      pointer = null;
      opener?.focus({preventScroll: true});
    }

    modal.querySelectorAll('[data-' + prefix + '-close]').forEach(button => button.addEventListener('click', close));
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));

    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.target.closest?.('video')) {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Tab') {
        const focusable = [...modal.querySelectorAll('button:not(:disabled), video[controls]')]
          .filter(node => getComputedStyle(node).display !== 'none');
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    });

    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || event.target.closest('button, video')) return;
      pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
      stage.setPointerCapture?.(event.pointerId);
    });
    stage.addEventListener('pointerup', event => {
      if (pointer?.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.25) move(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { pointer = null; });
    stage.addEventListener('lostpointercapture', () => { pointer = null; });

    filters.forEach(button => button.addEventListener('click', () => {
      filter = button.getAttribute(filterAttr);
      expanded = false;
      filters.forEach(candidate => {
        candidate.classList.toggle('is-active', candidate === button);
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      refresh();
    }));
    more?.addEventListener('click', () => {
      expanded = true;
      refresh();
    });
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
