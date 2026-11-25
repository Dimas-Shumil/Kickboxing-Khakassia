import {e} from './news-render.service.js';
import {consentVersion,shopNotice} from './shop.service.js';

const rub = value => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2,minimumFractionDigits:0}).format(value/100);
const frontTitles = {'/shop':'Каталог','/cart':'Корзина','/shop-policy':'Политика обработки персональных данных','/shop-consent':'Согласие на обработку персональных данных'};
const links = '<a href="/shop-policy">Политика обработки персональных данных</a><a href="/shop-consent">Согласие на обработку данных</a>';
const legal = settings => `<aside class="shop-terms"><p>${shopNotice}</p>${settings.operator?`<p>Оператор каталога: ${e(settings.operator)} · ИНН ${e(settings.inn)}<br>${e(settings.address)} · ${e(settings.contact)}</p>`:''}<div>${links}</div></aside>`;
const image = (item,lazy=true) => item.image?`<img src="${e(item.image)}" alt="${e(item.title)}"${lazy?' loading="lazy"':''} decoding="async">`:'<span class="shop-image-placeholder">Фото пока нет</span>';
const gallery = item => {
 const photos=[...new Set([item.image,...(item.photos||[])].filter(Boolean))].slice(0,12);
 return `<div class="shop-photo-gallery" data-shop-gallery>
 ${photos.length>1?`<div class="shop-photo-thumbs" role="group" aria-label="Фотографии товара">${photos.map((src,i)=>`<button type="button" data-shop-gallery-src="${e(src)}" aria-label="Фото ${i+1}" aria-pressed="${i===0}"><img src="${e(src)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}
 <div class="shop-product__image">${image({...item,image:photos[0]},false)}${photos.length>1?`<span class="shop-image-count" data-shop-image-count>1 / ${photos.length}</span>`:''}</div></div>`;
};

const pricesFor = item => {
 const active = item.variants.filter(v=>v.available);
 return (active.length ? active : item.variants).map(v=>v.price);
};
const from = item => {
 const prices = pricesFor(item);
 return (new Set(prices).size>1?'от ':'')+rub(Math.min(...prices));
};
const itemAction = (item,variant,multiple=false) => {
 const href='/shop/'+encodeURIComponent(item.slug)+'#shop-options';
 return `<div class="shop-buy shop-buy--compact" data-shop-buy data-product="${e(item.id)}" data-code="${e(variant.code)}" data-multiple="${multiple}" data-href="${href}">
 <button type="button" class="shop-quick-trigger" ${multiple?'data-shop-choose="1" aria-expanded="false"':'data-shop-add="'+e(item.id)+'"'} aria-label="${multiple?'Выбрать вариант товара':'Добавить в корзину'}">+</button>
 <div class="shop-quantity" data-shop-quantity hidden><button type="button" ${multiple?'data-shop-choose="-1" aria-expanded="false"':'data-shop-step="-1"'} aria-label="Уменьшить количество">−</button><span data-shop-quantity-value aria-live="polite">0</span><button type="button" ${multiple?'data-shop-choose="1" aria-expanded="false"':'data-shop-step="1"'} aria-label="Увеличить количество">+</button></div></div>`;
};
const cardPicker = item => `<div class="shop-card__picker" data-shop-picker hidden><p data-shop-picker-title>Выберите вариант</p><div class="shop-card__variants">${item.variants.filter(v=>v.available).map(v=>`<button type="button" data-shop-pick="${e(v.code)}"><span>${e(v.label)}</span><span>${e(rub(v.price))}</span></button>`).join('')}</div><button class="shop-picker-cancel" type="button" data-shop-picker-close>Отмена</button></div>`;
function productCard(item) {
 const available = item.variants.filter(v=>v.available);
 const first = available[0];
 const href = '/shop/'+encodeURIComponent(item.slug);
 return `<article class="shop-card" data-shop-card data-shop-href="${href}">
 <a class="shop-card__image" href="${href}" aria-label="Открыть ${e(item.title)}">${image(item)}</a>
 <div class="shop-card__content"><span class="shop-card__category">${e(item.category)}</span><h2><a href="${href}">${e(item.title)}</a></h2>
 <div class="shop-card__bottom"><strong>${from(item)}</strong>${first?itemAction(item,first,available.length>1):''}</div>
 ${available.length>1?cardPicker(item):''}${first?'':'<span class="shop-unavailable">Временно недоступно</span>'}</div></article>`;
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
 <nav class="shop-crumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">/</span><span>Магазин</span></nav>
 <div class="shop-catalog__head"><div><h1 id="shop-catalog-title">Экипировка</h1><p data-shop-result-count aria-live="polite">Товаров: ${count}</p></div>
 <form id="${form}" class="shop-search" action="/shop" method="get"><label for="shop-search">Поиск по каталогу</label>
 <div><input id="shop-search" name="q" type="search" maxlength="100" value="${e(search)}" placeholder="Название товара"><button class="shop-button" type="submit">Найти</button></div></form></div>
 <div class="shop-catalog__layout">
 <div class="shop-filter"><details open><summary>Фильтры</summary><div class="shop-filter__body">
  <fieldset><legend>Категория</legend>${['',...categories].map(value=>`<label><input type="radio" name="category" value="${e(value)}" form="${form}" ${value===category?'checked':''}><span>${e(value||'Все товары')}</span></label>`).join('')}</fieldset>
  <fieldset><legend>Цена, ₽</legend><div class="shop-filter__price">
   <label>От<input name="min" type="number" min="0" step=".01" max="9999999.99" value="${min===null?'':min/100}" form="${form}"></label>
   <label>До<input name="max" type="number" min="0" step=".01" max="9999999.99" value="${max===null?'':max/100}" form="${form}"></label></div></fieldset>
  <button class="shop-button shop-button--plain" type="submit" form="${form}">Применить</button>
  <a class="shop-filter__reset" href="/shop" ${active?'':'hidden'}>Сбросить фильтры</a>
 </div></details></div>
 <div class="shop-catalog__results"><div class="shop-sort"><span class="shop-category-chip">${e(category||'Все товары')}</span>
 <label>Сортировка <select name="sort" form="${form}">${sortOptions.map(([key,label])=>`<option value="${key}" ${key===sort?'selected':''}>${label}</option>`).join('')}</select></label></div>
 <div data-shop-filter-status role="status" hidden></div><div data-shop-results aria-busy="false">${matches.length?`<div class="shop-grid">${matches.map(productCard).join('')}</div>`:`<p class="shop-empty">${products.length?'По выбранным условиям ничего не найдено.':'Товары пока не опубликованы.'}</p>`}</div></div>

 </div></section>`;
}
function detail(product) {
 const available = product.variants.filter(v=>v.available);
 const first=available[0];
 const variants=`<fieldset class="shop-variants" id="shop-options"><legend>${product.variants.length>1?'Выберите вариант':'Вариант'}</legend>${product.variants.map(v=>`<label><input type="radio" name="product-variant" data-shop-variant value="${e(v.code)}" data-price="${e(rub(v.price))}" ${v.available?'':'disabled'} ${v===first?'checked':''}><span>${e(v.label)}</span></label>`).join('')}</fieldset>`;
 const description=product.description||'';
 const summary=description.trim().replace(/\s+/g,' ');
 const lead=summary.length>180?summary.slice(0,177).replace(/\s+\S*$/,'')+'…':summary;
 const buy=first?`<div class="shop-buy shop-buy--detail" data-shop-buy data-product="${e(product.id)}" data-code="${e(first.code)}" data-detail="true">
 <button class="shop-button" type="button" data-shop-add="${e(product.id)}">В корзину</button>
 <div class="shop-quantity" data-shop-quantity><button type="button" data-shop-step="-1" aria-label="Уменьшить количество">−</button><span data-shop-quantity-value aria-live="polite">1</span><button type="button" data-shop-step="1" aria-label="Увеличить количество">+</button></div>
 <a class="shop-button" href="/cart" data-shop-cart-link hidden>Открыть корзину</a></div>`:'<p class="shop-unavailable">Товар временно недоступен.</p>';
 return {PRODUCT_NAME:e(product.title),PRODUCT_CATEGORY:e(product.category),PRODUCT_CATEGORY_URL:'/shop?category='+encodeURIComponent(product.category),PRODUCT_GALLERY:gallery(product),PRODUCT_PRICE:first?rub(first.price):from(product),PRODUCT_LEAD:lead?`<p class="shop-product__lead">${e(lead)}</p>`:'',PRODUCT_VARIANTS:variants,PRODUCT_BUY:buy,PRODUCT_DESCRIPTION:product.description?e(product.description):'Описание пока не добавлено.',PRODUCT_VARIANT_LABELS:e(product.variants.map(v=>v.label).join(', '))};
}
function cartForm(settings) {
 return `${settings.enabled?`<form method="post" action="/api/shop/requests" data-shop-request data-consent-version="${consentVersion(settings)}">
 <label>Ваше имя<input name="name" autocomplete="name" maxlength="100" required></label>
 <label>Телефон<input name="phone" type="tel" autocomplete="tel" maxlength="32" placeholder="+7 900 000-00-00" required></label>
 <label class="shop-checkbox"><input name="consent" type="checkbox" required><span>Даю <a href="/shop-consent" target="_blank" rel="noopener">согласие на обработку персональных данных</a> для связи по этой заявке.</span></label>
 <button type="submit" class="shop-button" disabled>Отправить заявку</button>
 </form>`:'<p>Приём заявок пока закрыт.</p>'}`;
}
export function renderShop(template,{path,query,settings,products,product}) {
 const title = product?.title || frontTitles[path];
 let values={};
 if (product) values=detail(product);
 else if (path==='/shop') values.CONTENT=listing(products,query||{});
 else if (path==='/cart') values.CART_FORM=cartForm(settings);
 else values.CONTENT=`<a class="shop-back" href="/shop">К каталогу</a><div class="shop-heading"><h1>${e(title)}</h1></div>
  <div class="shop-legal-text shop-preline">${e((path==='/shop-policy'?settings.policy:settings.consent)||'Документ пока не опубликован. Приём заявок закрыт.')}</div>`;
 const description = product ? (product.description || product.title).replace(/\s+/g,' ').trim().slice(0,160) : path==='/shop' ? 'Каталог экипировки Федерации кикбоксинга Хакасии.' : title+' — Федерация кикбоксинга Хакасии.';
 const replacements={TITLE:e(title),DESCRIPTION:e(description),LEGAL:legal(settings),...values};
 return template.replace(/\{\{([A-Z_]+)\}\}/g,(match,key)=>Object.hasOwn(replacements,key)?replacements[key]:match);
}
