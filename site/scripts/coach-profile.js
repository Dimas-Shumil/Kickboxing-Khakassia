(() => {
  'use strict';
  const init = () => {
    const story = document.querySelector('[data-coach-story-more]');
    story?.addEventListener('click', () => {
      const target = document.getElementById(story.getAttribute('aria-controls'));
      if (!target) return;
      const expanded = story.getAttribute('aria-expanded') !== 'true';
      target.hidden = !expanded;
      story.setAttribute('aria-expanded', String(expanded));
      story.innerHTML = expanded ? 'Свернуть историю <span aria-hidden="true">−</span>' : 'Читать полностью <span aria-hidden="true">+</span>';
    });

    const grid = document.querySelector('[data-coach-gallery]');
    const modal = document.querySelector('[data-coach-lightbox]');
    if (!grid || !modal) return;
    const cards = [...grid.querySelectorAll('button[data-coach-media]')];
    const filters = [...document.querySelectorAll('[data-coach-filter]')];
    const empty = document.querySelector('[data-coach-empty]');
    const moreWrap = document.querySelector('[data-coach-more-wrap]');
    const more = document.querySelector('[data-coach-more]');
    const media = modal.querySelector('.coach-profile-lightbox__media');
    const caption = modal.querySelector('[data-coach-caption]');
    const count = modal.querySelector('[data-coach-count]');
    const prev = modal.querySelector('[data-coach-prev]');
    const next = modal.querySelector('[data-coach-next]');
    const closeButton = modal.querySelector('.coach-profile-lightbox__close');
    const stage = modal.querySelector('[data-coach-stage]');
    if (!cards.length || !media || !caption || !count || !prev || !next || !closeButton || !stage) return;
    let currentFilter = 'all', expanded = false, displayed = [], activeIndex = -1, opener = null, pointer = null;

    function refresh() {
      const matching = cards.filter(card => currentFilter === 'all' || card.dataset.category === currentFilter);
      const visible = matching.filter((card, index) => currentFilter !== 'all' || expanded || index < 6);
      cards.forEach(card => { card.hidden = !visible.includes(card); });
      if (empty) empty.hidden = matching.length > 0;
      if (moreWrap) moreWrap.hidden = currentFilter !== 'all' || expanded || matching.length <= 6;
    }
    filters.forEach(button => button.addEventListener('click', () => {
      currentFilter = button.dataset.coachFilter;
      expanded = false;
      filters.forEach(item => { const active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
      refresh();
    }));
    more?.addEventListener('click', () => { expanded = true; refresh(); });
    function render() {
      const card = displayed[activeIndex];
      if (!card) return;
      const image = document.createElement('img');
      image.src = card.dataset.full;
      image.alt = card.querySelector('img')?.alt || 'Фото тренировки';
      image.decoding = 'async';
      image.draggable = false;
      media.replaceChildren(image);
      caption.textContent = card.dataset.caption || image.alt;
      count.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(displayed.length).padStart(2, '0')}`;
      prev.disabled = next.disabled = displayed.length < 2;
    }
    function open(card) {
      displayed = cards.filter(item => !item.hidden && item.dataset.full);
      activeIndex = displayed.indexOf(card);
      if (activeIndex < 0) return;
      opener = document.activeElement;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('coach-profile-lightbox-open');
      render();
      closeButton.focus();
    }
    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('coach-profile-lightbox-open');
      media.replaceChildren();
      activeIndex = -1;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      opener = null;
    }
    function move(delta) {
      if (modal.hidden || displayed.length < 2) return;
      activeIndex = (activeIndex + delta + displayed.length) % displayed.length;
      render();
    }
    grid.addEventListener('click', event => {
      const card = event.target.closest('button[data-coach-media]');
      if (card && grid.contains(card) && !card.hidden) open(card);
    });
    modal.querySelectorAll('[data-coach-close]').forEach(el => el.addEventListener('click', close));
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      else if (event.key === 'Tab') {
        const focusable = [closeButton, prev, next].filter(el => !el.disabled);
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
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.35) move(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { pointer = null; });
    refresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
