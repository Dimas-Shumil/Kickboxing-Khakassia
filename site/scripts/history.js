/** Stage 06: undated demo records; replace only after source verification.
 * Gallery behaviour is reused unchanged from athlete.js. */
(() => {
  'use strict';
  const tabs = [...document.querySelectorAll('.history-timeline [role="tab"]')];
  function activate(tab) {
    tabs.forEach(candidate => {
      const active = candidate === tab;
      candidate.setAttribute('aria-selected', String(active));
      candidate.tabIndex = active ? 0 : -1;
      document.getElementById(candidate.getAttribute('aria-controls')).hidden = !active;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault(); activate(tabs[next]); tabs[next].focus();
    });
  });
  const year = document.getElementById('archive-year');
  const kind = document.getElementById('archive-kind');
  const records = [...document.querySelectorAll('[data-event]')];
  function filter() {
    let count = 0;
    records.forEach(record => {
      const match = (year.value === 'all' || record.dataset.year === year.value)
        && (kind.value === 'all' || record.dataset.kind === kind.value);
      record.hidden = !match;
      if (match) count++;
    });
    document.getElementById('archive-count').textContent = `Материалов: ${count}`;
    document.getElementById('archive-empty').hidden = count !== 0;
  }
  if (year && kind) {
    year.addEventListener('change', filter); kind.addEventListener('change', filter);
    document.getElementById('archive-reset').addEventListener('click', () => {
      year.value = kind.value = 'all'; filter();
    });
    filter();
  }
})();
