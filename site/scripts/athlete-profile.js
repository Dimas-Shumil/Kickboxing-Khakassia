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

  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
