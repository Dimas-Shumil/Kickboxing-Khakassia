(() => {
  'use strict';

  async function mount(id, url) {
    const target = document.getElementById(id);
    if (!target) return;

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Компонент заменяет mount-point: не оставляем вложенные header/footer и повторяющиеся ID.
      target.insertAdjacentHTML('beforebegin', await response.text());
      target.remove();
    } catch (error) {
      console.warn(`Не удалось загрузить компонент ${url}:`, error);
    }
  }

  // Структура и обработчики меню перенесены из проверенной схемы Landshaft Park.
  function initHeader() {
    const header = document.querySelector('.header');
    const burger = header?.querySelector('.header__burger');
    const menu = header?.querySelector('.mobile-menu');
    if (!header || !burger || !menu) return;

    const closeMenu = () => {
      header.classList.remove('is-active');
      document.body.classList.remove('lock');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
      menu.setAttribute('aria-hidden', 'true');
    };

    burger.addEventListener('click', () => {
      const isActive = header.classList.toggle('is-active');
      if (isActive) header.classList.remove('is-hidden');
      document.body.classList.toggle('lock', isActive);
      burger.setAttribute('aria-expanded', String(isActive));
      burger.setAttribute('aria-label', isActive ? 'Закрыть меню' : 'Открыть меню');
      menu.setAttribute('aria-hidden', String(!isActive));
    });

    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', (event) => {
      if (event.matches) closeMenu();
    });

    // Как в Landshaft Park: вниз — скрываем, вверх — показываем.
    let lastScrollY = Math.max(window.scrollY, 0);
    let ticking = false;
    const updateScroll = () => {
      const y = Math.max(window.scrollY, 0);
      const delta = y - lastScrollY;
      if (header.classList.contains('is-active') || y <= 12) {
        header.classList.remove('is-hidden');
      } else if (Math.abs(delta) >= 6) {
        header.classList.toggle('is-hidden', delta > 0);
      }
      if (Math.abs(delta) >= 6 || y <= 12) lastScrollY = y;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateScroll);
    }, { passive: true });

    // Текущая страница в навигации.
    const current = window.location.pathname;
    header.querySelectorAll('.header__nav a, .mobile-menu__nav a').forEach((link) => {
      const url = new URL(link.href, document.baseURI);
      if (url.pathname === current && !url.hash) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function initCountdown() {
    const timer = document.getElementById('hero-countdown');
    if (!timer) return;

    const targetDate = timer.dataset.target;
    if (!targetDate) return;

    const target = new Date(targetDate).getTime();
    if (!Number.isFinite(target)) return;

    const nodes = Object.fromEntries(
      ['days', 'hours', 'minutes', 'seconds'].map((name) => [
        name,
        timer.querySelector(`[data-time="${name}"]`),
      ]),
    );

    let interval = null;
    function update() {
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const values = {
        days: Math.floor(remaining / 86400),
        hours: Math.floor((remaining % 86400) / 3600),
        minutes: Math.floor((remaining % 3600) / 60),
        seconds: remaining % 60,
      };

      Object.entries(values).forEach(([name, value]) => {
        if (nodes[name]) nodes[name].textContent = String(value).padStart(2, '0');
      });

      if (remaining === 0) {
        timer.setAttribute('aria-label', 'Дата начала соревнований наступила');
        if (interval !== null) clearInterval(interval);
      }
    }

    update();
    if (target > Date.now()) interval = setInterval(update, 1000);
  }


  function initAchievements() {
    const section = document.querySelector('.achievements');
    if (!section) return;
    const values = [...section.querySelectorAll('[data-count]')];
    if (!values.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const animate = (node) => {
      const end = Number(node.dataset.count);
      if (!Number.isFinite(end)) return;
      const suffix = node.dataset.suffix || '';
      const start = performance.now();
      const duration = 1600;
      function frame(time) {
        const progress = Math.min(1, (time - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = `${Math.round(end * eased)}${suffix}`;
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.35 });
    values.forEach((value) => observer.observe(value));
  }


  // Спортсмены: горизонтальная лента IDEAL / Абонементы.
  function initAthletesCarousel() {
    const track = document.querySelector('[data-athletes-track]');
    const prev = document.querySelector('[data-athletes-prev]');
    const next = document.querySelector('[data-athletes-next]');
    const counter = document.querySelector('[data-athletes-counter]');
    if (!track || !prev || !next) return;

    const cards = [...track.querySelectorAll('.athlete-card')];
    if (!cards.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (x, low, high) => Math.min(Math.max(x, low), high);
    const leftFor = index => cards[index].offsetLeft - cards[0].offsetLeft;
    const activeIndex = () => cards.reduce((closest, card, index) =>
      Math.abs(leftFor(index) - track.scrollLeft) < Math.abs(leftFor(closest) - track.scrollLeft) ? index : closest, 0);

    let raf = 0;
    function sync() {
      raf = 0;
      const i = activeIndex();
      if (counter) counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      prev.disabled = track.scrollLeft <= 3;
      next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 3;
    }
    function syncSoon() { if (!raf) raf = requestAnimationFrame(sync); }
    const scrollToCard = i => track.scrollTo({left: leftFor(clamp(i, 0, cards.length - 1)), behavior: reduced.matches ? 'instant' : 'smooth'});
    const step = direction => scrollToCard(activeIndex() + direction);
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    track.addEventListener('scroll', syncSoon, {passive: true});
    track.addEventListener('keydown', event => {
      if (event.target.closest('a, button')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1);
      }
    });

    let drag = null, suppressClick = false, clickTimer = 0;
    function blockDragClick() {
      suppressClick = true;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { suppressClick = false; }, 400);
    }
    track.addEventListener('dragstart', event => event.preventDefault());
    track.addEventListener('pointerdown', event => {
      if (event.isPrimary === false || drag ||
          (event.pointerType === 'mouse' && event.button !== 0) ||
          event.target.closest('button, input, select, textarea')) return;
      clearTimeout(clickTimer);
      suppressClick = false;
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY,
        start: track.scrollLeft, index: activeIndex(), moved: false};
    });
    track.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        // Let the browser handle a vertical page scroll.
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.moved = true;
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
      }
      if (event.cancelable) event.preventDefault();
      track.scrollLeft = drag.start - dx;
    });
    function release(event, cancelled = false) {
      if (!drag || event.pointerId !== drag.id) return;
      const gesture = drag;
      drag = null;
      track.classList.remove('is-dragging');
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      if (!gesture.moved) return;
      blockDragClick();
      let index = activeIndex();
      const dx = event.clientX - gesture.x;
      // A short deliberate swipe still advances a card; a tap opens its profile.
      if (!cancelled && index === gesture.index &&
          Math.abs(dx) > Math.min(45, cards[0].getBoundingClientRect().width * 0.18)) {
        index += dx < 0 ? 1 : -1;
      }
      scrollToCard(index);
    }
    track.addEventListener('pointerup', event => release(event));
    track.addEventListener('pointercancel', event => release(event, true));
    track.addEventListener('lostpointercapture', event => {
      if (event.target === track) release(event, true);
    });
    track.addEventListener('click', event => {
      if (!suppressClick) return;
      event.preventDefault(); event.stopPropagation();
    }, true);
    window.addEventListener('resize', syncSoon);
    sync();
  }

  // Календарь: 3D Coverflow из IDEAL / Спортивное питание.
  // Удалены зависимости от товаров, корзины и карточек магазина.
  function initCompetitionsCoverflow() {
    const section = document.querySelector('.competitions-preview');
    const gallery = section?.querySelector('[data-competitions-gallery]');
    const cards = [...(section?.querySelectorAll('[data-competition-card]') || [])];
    const prev = section?.querySelector('[data-competitions-prev]');
    const next = section?.querySelector('[data-competitions-next]');
    const counter = section?.querySelector('[data-competitions-counter]');
    if (!gallery || !prev || !next) return;
    if(cards.length<2){prev.disabled=next.disabled=true;if(cards[0]){cards[0].classList.add('is-current');cards[0].style.opacity='1';cards[0].style.transform='translate(-50%,-50%)';}return;}

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const count = cards.length;
    const modulo = value => ((value % count) + count) % count;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    let position = 0, target = 0, frame = 0, cardWidth = 0, pointer = null, suppressClick = false;
    const stepWidth = () => cardWidth * (gallery.clientWidth <= 680 ? 0.63 : 0.77);
    const opacityAt = distance => distance <= 1 ? 1 - distance * 0.10 : Math.max(0.26, 0.90 - (distance - 1) * 0.52);

    function render() {
      cards.forEach((card, index) => {
        const offset = modulo(index - position + count / 2) - count / 2;
        const d = Math.abs(offset);
        const spread = d <= 1 ? d : 1 + (d - 1) * 0.75;
        const x = Math.sign(offset) * spread * stepWidth();
        const scale = 1 - Math.min(d, 2.5) * 0.15;
        const angle = -Math.sign(offset) * Math.min(d, 1) * 19;
        card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${(d * 11).toFixed(2)}px, ${(-d * 52).toFixed(2)}px) rotateY(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        card.style.opacity = String(opacityAt(d));
        card.style.zIndex = String(100 - Math.round(d * 30));
        const selected = index === modulo(Math.round(target));
        card.setAttribute('aria-hidden', String(!selected));
        card.querySelectorAll('a').forEach(a=>a.tabIndex=selected?0:-1);
        card.classList.toggle('is-current', selected);
      });
    }
    function sync() {
      const active = modulo(Math.round(target));
      if (counter) counter.textContent = `${String(active + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    }
    function goTo(nextPosition) {
      cancelAnimationFrame(frame);
      const from = position;
      target = nextPosition;
      sync();
      if (reduced.matches) {position = target; render(); return;}
      const start = performance.now();
      function animate(now) {
        const t = Math.min((now - start) / 1080, 1);
        position = from + (target - from) * (1 - Math.pow(1 - t, 4));
        render();
        if (t < 1) frame = requestAnimationFrame(animate);
        else {position = target = modulo(target); frame = 0; render();}
      }
      frame = requestAnimationFrame(animate);
    }
    const step = delta => {if (!pointer) goTo(Math.round(target) + delta);};
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    gallery.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End') goTo(Math.round(position) + (event.key === 'Home' ? -modulo(Math.round(target)) : count - 1 - modulo(Math.round(target))));
      else step(event.key === 'ArrowRight' ? 1 : -1);
    });
    gallery.addEventListener('dragstart', event => event.preventDefault());
    gallery.addEventListener('pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      cancelAnimationFrame(frame);
      pointer = {id:event.pointerId, x:event.clientX, y:event.clientY, origin:position, lastX:event.clientX, lastTime:performance.now(), velocity:0, locked:false};
      suppressClick = false;
    });
    gallery.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      if (!pointer.locked) {
        if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) {release(event,true); return;}
        if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy)) return;
        pointer.locked = true;
        suppressClick = true;
        gallery.setPointerCapture(event.pointerId);
        gallery.classList.add('is-dragging');
      }
      if (event.cancelable) event.preventDefault();
      const now=performance.now(), elapsed=now-pointer.lastTime;
      if (elapsed > 0) pointer.velocity=.35*pointer.velocity+.65*(event.clientX-pointer.lastX)/elapsed;
      pointer.lastX=event.clientX; pointer.lastTime=now;
      position=pointer.origin-dx/stepWidth();
      render();
    }, {passive:false});
    function release(event, cancelled=false) {
      if (!pointer || event.pointerId !== pointer.id) return;
      const drag = pointer; pointer=null;
      gallery.classList.remove('is-dragging');
      if (gallery.hasPointerCapture(event.pointerId)) gallery.releasePointerCapture(event.pointerId);
      if (!drag.locked || cancelled) {goTo(Math.round(target)); return;}
      const dx=event.clientX-drag.x;
      const velocity=performance.now()-drag.lastTime<110?drag.velocity:0;
      let nextIndex=Math.round(position-clamp(velocity*125/stepWidth(),-1,1));
      if (nextIndex===Math.round(drag.origin) && (Math.abs(dx)>cardWidth*.16 || Math.abs(velocity)>.35)) nextIndex+=dx<0?1:-1;
      goTo(nextIndex);
    }
    gallery.addEventListener('pointerup', event=>release(event));
    gallery.addEventListener('pointercancel', event=>release(event,true));
    gallery.addEventListener('lostpointercapture', event=>{if(event.target===gallery&&pointer)release(event,true);});
    gallery.addEventListener('click', event=>{
      if(suppressClick){event.preventDefault();suppressClick=false;return;}
      const card=event.target.closest('[data-competition-card]');
      if(!card)return;
      const offset=modulo(cards.indexOf(card)-position+count/2)-count/2;
      if(Math.abs(offset)>.1){event.preventDefault();goTo(Math.round(position+offset));}
    });
    const resize=()=>{cardWidth=cards[0].offsetWidth;render();};
    if('ResizeObserver' in window)new ResizeObserver(resize).observe(gallery);
    else window.addEventListener('resize',resize,{passive:true});
    reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);position=target;render();});
    resize();sync();
  }


  // Смена цвета ОБЩЕГО фона по принципу Estetic Club.
  // Не используем градиенты или маски поверх соседних секций.
  function initHallOfFameFlow() {
    const wrapper = document.querySelector('[data-hall-flow]');
    const hall = wrapper?.querySelector('.hall-of-fame');
    const calendar = wrapper?.querySelector('.competitions-preview');
    if (!wrapper || !hall || !calendar) return;

    const light = [251, 250, 248];
    const dark = [8, 13, 22];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (value) => Math.max(0, Math.min(1, value));
    const smooth = (value) => value * value * (3 - 2 * value);
    let queued = false;

    function update() {
      const vh = window.innerHeight;
      const hallRect = hall.getBoundingClientRect();
      const calendarRect = calendar.getBoundingClientRect();

      // Светлый -> тёмный перед Залом славы.
      const enter = smooth(clamp((vh * .96 - hallRect.top) / (vh * 1.05)));
      // Тёмный -> светлый при входе в календарь; без маски/градиента на стыке.
      const exit = smooth(clamp((vh * .97 - calendarRect.top) / (vh * .83)));
      const darkness = enter * (1 - exit);
      const rgb = light.map((value, i) => Math.round(value + (dark[i] - value) * darkness));

      wrapper.style.setProperty('--hall-flow-bg', `rgb(${rgb.join(', ')})`);

      // Фото не должно обрываться у нижней границы Зала славы.
      const photoExit = smooth(clamp((vh * .65 - hallRect.bottom) / (vh * .55)));
      wrapper.style.setProperty('--hall-photo-opacity', String(smooth(clamp((enter - .18) / .82)) * (1 - photoExit)));
      wrapper.style.setProperty('--hall-content-opacity', String(smooth(clamp((enter - .36) / .64)) * (1 - photoExit)));
      wrapper.style.setProperty('--calendar-content-opacity', String(smooth(clamp((exit - .28) / .60))));
      queued = false;
    }

    function scheduleUpdate() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    reducedMotion.addEventListener('change', scheduleUpdate);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Header и Footer загружаются независимо: медленный Footer не блокирует меню.
    mount('site-header', '/components/header.html?v=search-fix-3')
      .then(initHeader);
    mount('site-footer', '/components/footer.html');
    initCountdown();
    initAchievements();
    initAthletesCarousel();
    initCompetitionsCoverflow();
    initHallOfFameFlow();
  });
})();
