(() => {
  'use strict';
  const init = () => {
    const button = document.querySelector('.site-call');
    if (!button || button.dataset.scrollReady) return;
    button.dataset.scrollReady = 'true';
    document.documentElement.classList.add('site-call-ready');
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const footer = document.querySelector('footer.footer, footer, .footer');
      const rect = footer?.getBoundingClientRect();
      const height = window.innerHeight || document.documentElement.clientHeight;
      const footerVisible = !!rect && rect.top < height && rect.bottom > 0;
      const visible = Math.max(window.scrollY || window.pageYOffset || 0, 0) >= 120 && !footerVisible;
      button.classList.toggle('is-visible', visible);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    window.addEventListener('pageshow', schedule);
    window.addEventListener('load', schedule, {once: true});
    // main.js inserts the shared footer asynchronously; also handle changing page height.
    if (window.MutationObserver) new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true});
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
