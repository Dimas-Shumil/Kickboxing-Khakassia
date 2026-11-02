(() => {
  'use strict';
  function init() {
    const grid = document.querySelector('[data-coach-gallery]');
    const modal = document.querySelector('[data-coach-lightbox]');
    if (!grid || !modal) return;
    const cards = [...grid.querySelectorAll('[data-coach-media]')];
    const filters = [...document.querySelectorAll('[data-coach-filter]')];
    const empty = document.querySelector('[data-coach-empty]');
    const moreWrap = document.querySelector('[data-coach-more-wrap]');
    const more = document.querySelector('[data-coach-more]');
    const media = modal.querySelector('[data-coach-media]');
    const caption = modal.querySelector('[data-coach-caption]');
    const count = modal.querySelector('[data-coach-count]');
    const prev = modal.querySelector('[data-coach-prev]');
    const next = modal.querySelector('[data-coach-next]');
    const closeButton = modal.querySelector('.coach-lightbox__close');
    const stage = modal.querySelector('[data-coach-stage]');
    if (!cards.length || !media || !caption || !count || !prev || !next || !closeButton || !stage) return;
    let currentFilter = 'all';
    let expanded = false;
    let visible = [];
    let displayedMedia = [];
    let currentIndex = -1;
    let opener = null;
    let pointer = null;

    function refresh() {
      const matching = cards.filter(card => currentFilter === 'all' || card.dataset.category === currentFilter);
      visible = matching.filter((card, index) => currentFilter !== 'all' || expanded || index < 6);
      cards.forEach(card => { card.hidden = !visible.includes(card); });
      if (empty) empty.hidden = matching.length !== 0;
      if (moreWrap) moreWrap.hidden = currentFilter !== 'all' || expanded || matching.length <= 6;
    }
    filters.forEach(button => button.addEventListener('click', () => {
      currentFilter = button.dataset.coachFilter;
      expanded = false;
      filters.forEach(other => {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      refresh();
    }));
    more?.addEventListener('click', () => { expanded = true; refresh(); });

    function render() {
      const item = displayedMedia[currentIndex];
      if (!item) return;
      const img = document.createElement('img');
      img.src = item.dataset.full;
      img.alt = item.querySelector('img')?.alt || 'Иллюстрация';
      img.decoding = 'async';
      img.draggable = false;
      media.replaceChildren(img);
      caption.textContent = item.dataset.caption || img.alt;
      count.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(displayedMedia.length).padStart(2, '0')}`;
      prev.disabled = next.disabled = displayedMedia.length < 2;
    }
    function open(card) {
      displayedMedia = cards.filter(item => !item.hidden && item.dataset.full);
      currentIndex = displayedMedia.indexOf(card);
      if (currentIndex < 0) return;
      opener = document.activeElement;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('coach-legend-lightbox-open');
      render();
      closeButton.focus();
    }
    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('coach-legend-lightbox-open');
      media.replaceChildren();
      currentIndex = -1;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      opener = null;
    }
    function move(delta) {
      if (modal.hidden || displayedMedia.length < 2) return;
      currentIndex = (currentIndex + delta + displayedMedia.length) % displayedMedia.length;
      render();
    }
    grid.addEventListener('click', event => {
      const card = event.target.closest('[data-coach-media]');
      if (card && grid.contains(card) && !card.hidden) open(card);
    });
    modal.querySelectorAll('[data-coach-close]').forEach(element => element.addEventListener('click', close));
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      else if (event.key === 'Tab') {
        const focusable = [closeButton, prev, next].filter(element => !element.disabled);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.target.closest('button')) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    stage.addEventListener('pointerup', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.35) move(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { pointer = null; });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
