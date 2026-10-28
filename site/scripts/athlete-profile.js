(() => {
  'use strict';

  const ready = () => {
    const storyButton = document.querySelector('[data-story-toggle]');
    const storyMore = document.getElementById('athlete-detail-story-more');
    if (storyButton && storyMore) {
      storyButton.addEventListener('click', () => {
        const expanded = storyButton.getAttribute('aria-expanded') === 'true';
        storyMore.hidden = expanded;
        storyButton.setAttribute('aria-expanded', String(!expanded));
        storyButton.firstChild.textContent = expanded ? 'Читать полностью ' : 'Свернуть историю ';
        const sign = storyButton.querySelector('span');
        if (sign) sign.textContent = expanded ? '+' : '−';
      });
    }

    const gallery = document.querySelector('[data-gallery-grid]');
    const lightbox = document.querySelector('[data-lightbox]');
    if (!gallery || !lightbox) return;

    const items = [...gallery.querySelectorAll('[data-media-type]')];
    const filters = [...document.querySelectorAll('[data-gallery-filter]')];
    const moreButton = document.querySelector('[data-gallery-more]');
    const moreWrap = moreButton?.closest('.profile-gallery__more-wrap');
    const emptyState = document.querySelector('[data-gallery-empty]');
    const stage = lightbox.querySelector('[data-lightbox-stage]');
    const media = lightbox.querySelector('[data-lightbox-media]');
    const caption = lightbox.querySelector('[data-lightbox-caption]');
    const counter = lightbox.querySelector('[data-lightbox-counter]');
    const prev = lightbox.querySelector('[data-lightbox-prev]');
    const next = lightbox.querySelector('[data-lightbox-next]');
    const closeButton = lightbox.querySelector('.profile-lightbox__close');
    if (!items.length || !stage || !media || !caption || !counter || !prev || !next || !closeButton) return;

    let activeFilter = 'all';
    let expanded = false;
    let visible = [];
    let position = -1;
    let opener = null;
    let touchStart = null;

    function refreshGallery() {
      const matching = items.filter(item => activeFilter === 'all' || item.dataset.galleryCategory === activeFilter);
      visible = matching.filter((item, index) => expanded || activeFilter !== 'all' || index < 6);
      items.forEach(item => { item.hidden = !visible.includes(item); });
      if (emptyState) emptyState.hidden = matching.length !== 0;
      if (moreWrap) moreWrap.hidden = activeFilter !== 'all' || matching.length <= 6 || expanded;
    }

    filters.forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.galleryFilter;
        expanded = false;
        filters.forEach(candidate => {
          const active = candidate === button;
          candidate.classList.toggle('is-active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        refreshGallery();
      });
    });

    moreButton?.addEventListener('click', () => {
      expanded = true;
      refreshGallery();
    });

    function render() {
      const item = visible[position];
      if (!item) return;
      const type = item.dataset.mediaType;
      const source = type === 'video' ? item.dataset.videoSrc : item.dataset.full;
      const alternative = item.querySelector('img')?.alt || 'Фотография спортсмена';
      let node;

      if (type === 'video' && source) {
        node = document.createElement('video');
        node.controls = true;
        node.playsInline = true;
        node.preload = 'metadata';
        node.src = source;
        node.setAttribute('aria-label', item.dataset.caption || 'Видеозапись спортсмена');
      } else if (type === 'image' && source) {
        node = document.createElement('img');
        node.src = source;
        node.alt = alternative;
        node.decoding = 'async';
        node.draggable = false;
      } else {
        return;
      }

      // Removing the previous <video> also stops playback when navigating.
      media.replaceChildren(node);
      counter.textContent = `${String(position + 1).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}`;
      caption.textContent = item.dataset.caption || alternative;
      prev.disabled = next.disabled = visible.length < 2;
    }

    function open(item) {
      visible = items.filter(candidate => !candidate.hidden && (candidate.dataset.full || candidate.dataset.videoSrc));
      position = visible.indexOf(item);
      if (position < 0) return;
      opener = document.activeElement;
      lightbox.hidden = false;
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('athlete-lightbox-open');
      render();
      closeButton.focus();
    }

    function close() {
      if (lightbox.hidden) return;
      lightbox.hidden = true;
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('athlete-lightbox-open');
      media.replaceChildren();
      position = -1;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      opener = null;
    }

    function move(delta) {
      if (lightbox.hidden || visible.length <= 1) return;
      position = (position + delta + visible.length) % visible.length;
      render();
    }

    gallery.addEventListener('click', event => {
      const item = event.target.closest('[data-media-type]');
      if (item && gallery.contains(item) && !item.hidden) open(item);
    });

    lightbox.querySelectorAll('[data-lightbox-close]').forEach(el => el.addEventListener('click', close));
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));

    document.addEventListener('keydown', event => {
      if (lightbox.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Tab') {
        // Keep keyboard focus inside the modal while it is open.
        const focusable = [...lightbox.querySelectorAll('button:not([disabled]), video[controls]')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });

    // Pointer events support mouse dragging and touch; normal vertical scrolling is untouched.
    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.target.closest('button,video')) return;
      touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    stage.addEventListener('pointerup', event => {
      if (!touchStart || touchStart.id !== event.pointerId) return;
      const deltaX = event.clientX - touchStart.x;
      const deltaY = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) move(deltaX < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { touchStart = null; });

    refreshGallery();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
