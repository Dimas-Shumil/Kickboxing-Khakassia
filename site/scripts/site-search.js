/**
 * Поиск по разделам и опубликованным материалам Федерации.
 * Не зависит от загрузки Footer и не требует прямого импорта из main.js.
 * Делегирование клика работает с Header, который вставляется через fetch.
 */
(() => {
  'use strict';

  const ITEMS = [
{"title": "Соревнования", "href": "/competitions", "keywords": "календарь турниры предстоящие прошедшие результаты", "description": "Опубликованные соревнования, программа, документы и результаты.", "category": "Раздел Федерации", "popular": true},
{"title": "О Федерации", "href": "/federation", "keywords": "руководство деятельность клубы секции", "description": "Направления работы, руководство и клубы Федерации.", "category": "Раздел Федерации", "popular": true},
{"title": "Контакты", "href": "/contacts", "keywords": "телефон почта адрес связь контакты", "description": "Телефон, почта, адрес и проверенные каналы связи.", "category": "Раздел Федерации", "popular": true},
{"title": "Документы", "href": "/documents", "keywords": "устав положение правила разряды протоколы документы", "description": "Опубликованные документы Федерации в PDF.", "category": "Раздел Федерации", "popular": true},
    { title: 'Зал славы', category: 'Раздел Федерации',
      description: 'Легенды кикбоксинга Хакасии и спортивное наследие региона.',
      href: '/hall-of-fame#legends',
      keywords: 'легенды легенда зал славы награды чемпионы', popular: true },
    { title: 'Архив спортсменов', category: 'Зал славы',
      description: 'Исторические сведения о спортсменах Федерации.',
      href: '/hall-of-fame#athletes',
      keywords: 'архивные спортсмены спортсмен история участники', popular: true },
    { title: 'Тренеры Федерации', category: 'Тренерский состав',
      description: 'Тренеры и наставники Федерации кикбоксинга Хакасии.',
      href: '/coaches',
      keywords: 'тренер тренеры наставник наставники клуб', popular: true },
    { title: 'История и архив', category: 'Раздел Федерации',
      description: 'Фотографии и материалы о развитии кикбоксинга в Хакасии.',
      href: '/history',
      keywords: 'архив фото фотография история фотоколлаж хронология документы протоколы прошлое', popular: true },
    { title: 'Новости Федерации', category: 'Главная страница',
      description: 'Опубликованные новости Федерации.',
      href: '/news', keywords: 'новость новости события публикации' },
    { title: 'Федерация кикбоксинга Республики Хакасия', category: 'Главная страница',
      description: 'Официальный сайт Федерации.',
      href: '/', keywords: 'федерация хакасия абакан главная кикбоксинг' },
  ];

  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');

  // Резервная разметка на случай старого/неполного закешированного header.html.
  // Если в header.html всё на месте — этот шаблон НЕ используется.
  const markup = `
    <div class="site-search" id="site-search" hidden>
      <div class="site-search__backdrop" data-search-close></div>
      <section class="site-search__dialog" role="dialog" aria-modal="true" aria-labelledby="site-search-title">
        <div class="site-search__top">
          <div>
            <span class="site-search__eyebrow">Федерация кикбоксинга Хакасии</span>
            <h2 class="site-search__title" id="site-search-title">Поиск по сайту</h2>
          </div>
          <button class="site-search__close" type="button" data-search-close aria-label="Закрыть поиск">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>
          </button>
        </div>
        <form class="site-search__form" role="search" autocomplete="off">
          <label class="site-search__label" for="site-search-input">Имя, фамилия или раздел</label>
          <div class="site-search__field">
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/></svg>
            <input id="site-search-input" name="q" type="search" inputmode="search" placeholder="Например, Шумилов" maxlength="100" enterkeyhint="search" autocomplete="off" />
          </div>
        </form>
        <div class="site-search__summary" id="site-search-summary" aria-live="polite"></div>
        <div class="site-search__results" id="site-search-results" aria-label="Результаты поиска"></div>
        <p class="site-search__hint">Поиск по опубликованным страницам и подготовленным материалам.</p>
      </section>
    </div>`;

  const ready = overlay => Boolean(
    overlay?.querySelector('#site-search-input') &&
    overlay.querySelector('.site-search__form') &&
    overlay.querySelector('#site-search-results') &&
    overlay.querySelector('#site-search-summary') &&
    overlay.querySelector('[data-search-close]')
  );

  function getOverlay() {
    let overlay = document.getElementById('site-search');
    if (ready(overlay)) {
      // Модальное окно не должно быть внутри трансформируемого fixed Header.
      if (overlay.parentElement !== document.body) document.body.append(overlay);
      return overlay;
    }
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    const replacement = template.content.firstElementChild;
    if (overlay) overlay.remove();
    document.body.append(replacement);
    return replacement;
  }

  function matches(query,news=[]) {
    const q = normalize(query);
    if (!q) return ITEMS.filter(item => item.popular);
    const parts = q.split(' ');
    return [...news,...ITEMS.filter(item=>!news.some(x=>x.href===item.href))].map((item, i) => {
      const title = normalize(item.title);
      const haystack = normalize([item.title, item.category, item.description, item.keywords].join(' '));
      if (!news.includes(item)&&!parts.every(part => haystack.includes(part))) return null;
      const rank = title === q ? 100 : title.startsWith(q) ? 70 : title.includes(q) ? 50 : 0;
      return { item, i, rank };
    }).filter(Boolean)
      .sort((a, b) => b.rank - a.rank || a.i - b.i)
      .map(entry => entry.item);
  }

  function resultNode(item) {
    const el = document.createElement(item.href ? 'a' : 'div');
    el.className = 'site-search__result' + (item.pending ? ' site-search__result--pending' : '');
    if (item.href) el.setAttribute('href', item.href);
    const text = document.createElement('span');
    text.className = 'site-search__result-text';
    const category = document.createElement('span');
    category.className = 'site-search__result-category';
    category.textContent = item.category;
    const title = document.createElement('strong');
    title.className = 'site-search__result-title';
    title.textContent = item.title;
    const description = document.createElement('span');
    description.className = 'site-search__result-description';
    description.textContent = item.description;
    text.append(category, title, description);
    const action = document.createElement('span');
    action.className = 'site-search__result-action';
    action.textContent = item.pending ? 'Готовится' : 'Открыть';
    el.append(text, action);
    return el;
  }

  let previousFocus = null;
  let activeTrigger = null;

  let searchSerial=0, searchTimer;
  function render() {
    clearTimeout(searchTimer); const serial=++searchSerial;
    searchTimer=setTimeout(()=>renderSearch(serial),180);
  }
  async function renderSearch(serial) {
    const overlay = getOverlay();
    const input = overlay.querySelector('#site-search-input');
    const results = overlay.querySelector('#site-search-results');
    const summary = overlay.querySelector('#site-search-summary');
    const query=input.value;
    let news=[];
    summary.textContent='Поиск…';results.replaceChildren();
    try{const responses=await Promise.all(['/api/news/search','/api/people/search','/api/competitions/search','/api/history/search','/api/site/search'].map(url=>fetch(url+'?q='+encodeURIComponent(query),{cache:'no-store'})));if(responses.some(r=>!r.ok))throw Error();const data=await Promise.all(responses.map(r=>r.json()));news=data.flatMap(d=>d.items);}catch{if(serial!==searchSerial)return;summary.textContent='Не удалось загрузить материалы. Повторите поиск.';results.replaceChildren(...matches(query).map(resultNode));return;}
    if(serial!==searchSerial)return;
    const found = matches(query,news);
    summary.textContent = !normalize(input.value) ? 'Популярные разделы'
      : found.length ? `Найдено: ${found.length}` : 'Ничего не найдено';
    if (!found.length) {
      const empty = document.createElement('p');
      empty.className = 'site-search__empty';
      empty.textContent = 'Ничего не найдено. Попробуйте другую фамилию или название раздела.';
      results.replaceChildren(empty);
    } else {
      results.replaceChildren(...found.map(resultNode));
    }
  }

  function open(trigger) {
    const overlay = getOverlay();
    if (!overlay.hidden) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    activeTrigger = trigger || document.querySelector('.header__search');
    const header = document.querySelector('.header');
    if (header) {
      header.classList.remove('is-hidden', 'is-active');
      const burger = header.querySelector('.header__burger');
      const menu = header.querySelector('.mobile-menu');
      burger?.setAttribute('aria-expanded', 'false');
      burger?.setAttribute('aria-label', 'Открыть меню');
      menu?.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('lock');
    overlay.hidden = false;
    document.body.classList.add('site-search-open');
    activeTrigger?.setAttribute('aria-expanded', 'true');
    const input = overlay.querySelector('#site-search-input');
    input.value = '';
    render();
    input.focus();
  }

  function close() {
    const overlay = document.getElementById('site-search');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('site-search-open');
    activeTrigger?.setAttribute('aria-expanded', 'false');
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  // Обработчики вешаем ОДИН раз на документ, а не на динамический Header.
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('.header__search');
    if (trigger) {
      event.preventDefault();
      open(trigger);
      return;
    }
    if (event.target.closest('#site-search [data-search-close]')) close();
  });

  document.addEventListener('input', event => {
    if (event.target instanceof Element && event.target.matches('#site-search-input')) render();
  });

  document.addEventListener('submit', event => {
    if (!(event.target instanceof Element) || !event.target.matches('#site-search .site-search__form')) return;
    event.preventDefault();
    const first = getOverlay().querySelector('a.site-search__result');
    if (first) window.location.assign(first.href);
  });

  document.addEventListener('keydown', event => {
    const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (shortcut) {
      event.preventDefault();
      if (document.getElementById('site-search')?.hidden === false) {
        document.getElementById('site-search-input')?.focus();
      } else {
        open(document.querySelector('.header__search'));
      }
      return;
    }
    const overlay = document.getElementById('site-search');
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')]
        .filter(node => node.getClientRects().length > 0);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    } else if (event.key === 'ArrowDown' && document.activeElement?.id === 'site-search-input') {
      const link = overlay.querySelector('a.site-search__result');
      if (link) { event.preventDefault(); link.focus(); }
    }
  });
})();
