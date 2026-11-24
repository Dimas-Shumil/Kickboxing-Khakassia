import {e} from './news-render.service.js';
import {consentVersion,shopNotice} from './shop.service.js';

const rub = value => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2,minimumFractionDigits:0}).format(value/100);
const frontTitles = {'/shop':'Каталог','/cart':'Корзина','/shop-policy':'Политика обработки персональных данных','/shop-consent':'Согласие на обработку персональных данных'};
const links = '<a href="/shop-policy">Политика обработки персональных данных</a><a href="/shop-consent">Согласие на обработку данных</a>';
const legal = settings => `<aside class="shop-terms"><p>${shopNotice}</p>${settings.operator?`<p>Оператор каталога: ${e(settings.operator)} · ИНН ${e(settings.inn)}<br>${e(settings.address)} · ${e(settings.contact)}</p>`:''}<div>${links}</div></aside>`;
const image = (item,lazy=true) => item.image?`<img src="${e(item.image)}" alt="${e(item.title)}"${lazy?' loading="lazy"':''} decoding="async">`:'<span class="shop-image-placeholder">Фото пока нет</span>';
const pricesFor = item => {
 const active = item.variants.filter(v=>v.available);
 return (active.length ? active : item.variants).map(v=>v.price);
};
const from = item => {
 const prices = pricesFor(item);
 return (new Set(prices).size>1?'от ':'')+rub(Math.min(...prices));
};
const itemAction = (item,variant) => `<button type="button" class="shop-button" data-shop-add="${e(item.id)}" data-variant="${e(variant.code)}">В корзину</button>`;
function productCard(item) {
 const available = item.variants.filter(v=>v.available);
 const first = available[0];
 const href = '/shop/'+encodeURIComponent(item.slug);
 return `<article class="shop-card" data-shop-card>
 <a class="shop-card__image" href="${href}" data-quick-open>${image(item)}</a>
 <div class="shop-card__content"><h2><a href="${href}" data-quick-open>${e(item.title)}</a></h2>
 <div class="shop-card__bottom"><strong>${from(item)}</strong><a class="shop-quick-trigger" href="${href}" data-quick-open aria-label="Быстрый просмотр: ${e(item.title)}">+</a></div>
 ${first?'':'<span class="shop-unavailable">Временно недоступно</span>'}</div>
 <template data-quick-template>
  <div class="shop-quick__image">${image(item,false)}</div>
  <h2 data-quick-title tabindex="-1">${e(item.title)}</h2>
  ${first?`<fieldset class="shop-variants"><legend>Вариант</legend>${item.variants.map(v=>`<label title="${v.available?'':'Недоступен'}"><input type="radio" name="quick-variant" value="${e(v.code)}" data-price="${e(rub(v.price))}" ${v.available?'':'disabled'} ${v===first?'checked':''}><span>${e(v.label)}</span></label>`).join('')}</fieldset>
   <strong class="shop-quick__price" data-quick-price>${rub(first.price)}</strong>${itemAction(item,first)}`:
   '<p class="shop-unavailable">Товар временно недоступен.</p>'}
  <a class="shop-button shop-button--plain" href="${href}">Подробнее о товаре</a>
 </template></article>`;
}
function priceQuery(value) {
 if(typeof value!=='string'||!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value))return null;
 return Math.round(Number(value.replace(',','.'))*100);
}
const sortOptions = [['','По умолчанию'],['price-asc','Сначала дешевле'],['price-desc','Сначала дороже'],['name','По названию']];
function listing(products,query) {
 const category = typeof query.category==='string'?query.category:'';
 const search = typeof query.q==='string'?query.q.trim().slice(0,100):'';
 const min = priceQuery(query.min), max = priceQuery(query.max);
 const sort = sortOptions.some(([key])=>key===query.sort)?query.sort:'';
 const categories = [...new Set(products.map(item=>item.category))];
 const matches = products.filter(item=>(!category||item.category===category)&&
  [item.title,item.category,item.description].join(' ').toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))&&
  pricesFor(item).some(price=>(min===null||price>=min)&&(max===null||price<=max)));
 if(sort==='name') matches.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
 if(sort==='price-asc'||sort==='price-desc') matches.sort((a,b)=>
  (Math.min(...pricesFor(a))-Math.min(...pricesFor(b)))*(sort==='price-asc'?1:-1));
 const count=matches.length;
 const form='shop-catalog-form';
 const active=category||search||min!==null||max!==null||sort;
 return `<section class="shop-catalog" aria-labelledby="shop-catalog-title">
 <nav class="shop-crumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">/</span><span>Каталог</span></nav>
 <div class="shop-catalog__head"><div><h1 id="shop-catalog-title">Экипировка</h1><p>Товаров: ${count}</p></div>
 ${products.length?`<form id="${form}" class="shop-search" action="/shop" method="get"><label for="shop-search">Поиск по каталогу</label>
 <div><input id="shop-search" name="q" type="search" maxlength="100" value="${e(search)}" placeholder="Название товара"><button class="shop-button" type="submit">Найти</button></div></form>`:''}</div>
 ${products.length?`<div class="shop-catalog__layout">
 <div class="shop-filter"><details open><summary>Фильтры</summary>
  <fieldset><legend>Категория</legend>${['',...categories].map(value=>`<label><input type="radio" name="category" value="${e(value)}" form="${form}" ${value===category?'checked':''}><span>${e(value||'Все товары')}</span></label>`).join('')}</fieldset>
  <fieldset><legend>Цена, ₽</legend><div class="shop-filter__price">
   <label>От<input name="min" type="number" min="0" step=".01" max="9999999.99" value="${min===null?'':min/100}" form="${form}"></label>
   <label>До<input name="max" type="number" min="0" step=".01" max="9999999.99" value="${max===null?'':max/100}" form="${form}"></label></div></fieldset>
  <button class="shop-button shop-button--plain" type="submit" form="${form}">Применить</button>
  ${active?'<a class="shop-filter__reset" href="/shop">Сбросить фильтры</a>':''}
 </details></div>
 <div class="shop-catalog__results"><div class="shop-sort"><span class="shop-category-chip">${e(category||'Все товары')}</span>
 <label>Сортировка <select name="sort" form="${form}">${sortOptions.map(([key,label])=>`<option value="${key}" ${key===sort?'selected':''}>${label}</option>`).join('')}</select></label></div>
 ${matches.length?`<div class="shop-grid">${matches.map(productCard).join('')}</div>`:'<p class="shop-empty">По выбранным условиям ничего не найдено.</p>'}</div>
 ${matches.length?`<aside class="shop-quick" aria-label="Быстрый просмотр" data-quick-panel hidden></aside>
 <dialog class="shop-quick-dialog" aria-label="Быстрый просмотр" data-quick-dialog><button type="button" class="shop-quick-close" aria-label="Закрыть" data-quick-close>×</button><div data-quick-mobile></div></dialog>`:''}
 </div>`:'<p class="shop-empty">Товары пока не опубликованы.</p>'}</section>`;
}
function detail(product) {
 const available = product.variants.filter(v=>v.available);
 return `<a class="shop-back" href="/shop">В каталог</a><div class="shop-product">
 <div class="shop-product__image">${image(product,false)}</div><div class="shop-product__info">
 <span class="shop-card__category">${e(product.category)}</span><h1>${e(product.title)}</h1>
 <strong class="shop-product__price" data-shop-price>${from(product)}</strong>
 ${product.description?`<p class="shop-preline">${e(product.description)}</p>`:''}
 ${product.variants.length>1?`<label>Вариант<select data-shop-variant>${product.variants.map(v=>`<option value="${e(v.code)}" data-price="${e(rub(v.price))}"${v.available?'':' disabled'}>${e(v.label)}${v.available?'':' · недоступно'}</option>`).join('')}</select></label>`:`<p>${e(product.variants[0].label)}</p>`}
 ${available.length?itemAction(product,available[0]):'<p class="shop-unavailable">Товар временно недоступен.</p>'}
 </div></div>`;
}
function cart(settings) {
 return `<a class="shop-back" href="/shop">Продолжить выбор</a><div class="shop-heading"><h1>Корзина</h1></div>
 <div class="shop-cart" data-shop-cart><section aria-label="Товары в корзине" data-cart-lines><p>Загружаем корзину…</p></section>
 <section class="shop-summary" aria-labelledby="shop-summary-title"><h2 id="shop-summary-title">По каталогу</h2><strong data-cart-total>—</strong>
 <p>Окончательную стоимость и способ получения согласуем после заявки.</p>
 ${settings.enabled?`<form method="post" action="/api/shop/requests" data-shop-request data-consent-version="${consentVersion(settings)}">
 <label>Ваше имя<input name="name" autocomplete="name" maxlength="100" required></label>
 <label>Телефон<input name="phone" type="tel" autocomplete="tel" maxlength="32" placeholder="+7 900 000-00-00" required></label>
 <label class="shop-checkbox"><input name="consent" type="checkbox" required><span>Даю <a href="/shop-consent" target="_blank" rel="noopener">согласие на обработку персональных данных</a> для связи по этой заявке.</span></label>
 <button type="submit" class="shop-button" disabled>Отправить заявку</button>
 </form>`:'<p>Приём заявок пока закрыт.</p>'}
 <p class="shop-message" data-shop-result role="status"></p>
 </section></div>
 <section class="shop-receipt" data-shop-receipt aria-labelledby="shop-receipt-title" hidden>
 <h2 id="shop-receipt-title" tabindex="-1">Заявка принята</h2>
 <p>Номер заявки: <strong data-shop-request-number></strong></p>
 <p>Свяжемся с вами, чтобы согласовать наличие, стоимость и получение.</p>
 <a class="shop-button shop-button--plain" href="/shop">Вернуться в каталог</a>
 </section><noscript>Для корзины и отправки заявки включите JavaScript.</noscript>`;
}
export function renderShop(template,{path,query,settings,products,product}) {
 const title = product?.title || frontTitles[path];
 let body;
 if (product) body = detail(product);
 else if (path==='/shop') body = listing(products,query);
 else if (path==='/cart') body = cart(settings);
 else body = `<a class="shop-back" href="/shop">К каталогу</a><div class="shop-heading"><h1>${e(title)}</h1></div>
  <div class="shop-legal-text shop-preline">${e((path==='/shop-policy'?settings.policy:settings.consent)||'Документ пока не опубликован. Приём заявок закрыт.')}</div>`;
 return template.replace('{{TITLE}}',()=>e(title)).replace('{{CONTENT}}',()=>`<div class="container shop-container">${body}${legal(settings)}
 <p class="shop-message shop-notification" data-shop-notice role="status"></p></div>`);
}
