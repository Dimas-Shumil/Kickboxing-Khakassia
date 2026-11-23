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

  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
