(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.site-answers__item').forEach(item => {
    const summary = item.querySelector('summary');
    if (!summary || typeof item.animate !== 'function') return;
    let animation = null;
    let desiredOpen = item.open;

    summary.addEventListener('click', event => {
      event.preventDefault();
      desiredOpen = !desiredOpen;
      const startHeight = item.getBoundingClientRect().height;
      if (animation) {
        animation.cancel();
        animation = null;
      }
      item.style.height = '';
      item.style.overflow = '';
      item.open = desiredOpen;
      const endHeight = item.getBoundingClientRect().height;
      if (reducedMotion.matches || startHeight === endHeight) return;

      // Keep the answer rendered throughout both opening and closing.
      item.open = true;
      item.style.overflow = 'hidden';
      const current = item.animate(
        [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
        { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' }
      );
      animation = current;
      current.onfinish = () => {
        if (animation !== current) return;
        item.open = desiredOpen;
        item.style.overflow = '';
        animation = null;
      };
    });
    reducedMotion.addEventListener?.('change', () => {
      if (!reducedMotion.matches || !animation) return;
      animation.cancel();
      animation = null;
      item.open = desiredOpen;
      item.style.overflow = '';
    });
  });
})();
