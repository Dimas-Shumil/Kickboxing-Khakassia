const storageKey = 'fed-shop-cart-v1';
const limit = 20;
let cart = readCart();
const cartPage = document.querySelector('[data-shop-cart]');
const notice = document.querySelector('[data-shop-notice]');
const format = new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2,minimumFractionDigits:0});
const money = cents => format.format(cents/100);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function readCart() {
 try {
  const lines = JSON.parse(localStorage.getItem(storageKey)||'[]');
  if (!Array.isArray(lines)) return [];
  return lines.filter(line=>line && typeof line.id==='string' && typeof line.code==='string' &&
   Number.isInteger(line.quantity) && line.quantity>0 && line.quantity<=limit).slice(0,30);
 } catch {return [];}
}
function storeCart(next) {
 try {localStorage.setItem(storageKey,JSON.stringify(next));}
 catch {return false;}
 cart = next;
 document.dispatchEvent(new Event('shop:cart-change'));
 return true;
}
function updateHeader() {
 const count = cart.reduce((sum,line)=>sum+line.quantity,0);
 for (const badge of document.querySelectorAll('[data-shop-count]')) {
  badge.hidden = !count;
  if(badge.textContent!==String(count))badge.textContent=count;
  badge.closest('a').setAttribute('aria-label',count?'Корзина. Товаров: '+count:'Корзина');
 }
}
updateHeader();
document.addEventListener('shop:cart-change',updateHeader);
document.addEventListener('fed:header-ready',updateHeader);

function syncBuyControls(){
 for(const group of document.querySelectorAll('[data-shop-buy]')){
  const button=group.firstElementChild;
  const multiple=group.dataset.multiple==='true';
  const detail=group.dataset.detail==='true';
  const lines=cart.filter(line=>line.id===group.dataset.product&&(multiple||line.code===group.dataset.code));
  const count=lines.reduce((sum,line)=>sum+line.quantity,0);
  const quantity=group.querySelector('[data-shop-quantity]');
  const minus=quantity.querySelector('button');
  if(multiple){if(lines.length===1){group.dataset.code=lines[0].code;minus.dataset.shopStep='-1';minus.removeAttribute('data-shop-choose');minus.removeAttribute('aria-expanded');}else{delete minus.dataset.shopStep;minus.setAttribute('data-shop-choose','-1');minus.setAttribute('aria-expanded','false');}}
  const displayed=detail&&!count?Number(group.dataset.pending||1):count;
  const value=group.querySelector('[data-shop-quantity-value]');
  if(value.textContent!==String(displayed))value.textContent=displayed;
  quantity.hidden=!detail&&!count;
  const focused=document.activeElement;
  button.hidden=!!count;
  if(!detail&&focused===button&&count)quantity.querySelector('button:last-child')?.focus({preventScroll:true});
  if(!detail&&quantity.contains(focused)&&!count)button.focus({preventScroll:true});
  if(detail){
   const link=group.querySelector('[data-shop-cart-link]');
   link.hidden=!count;
   if(focused===button&&count)link.focus({preventScroll:true});
   if(focused===link&&!count)button.focus({preventScroll:true});
   minus.disabled=!count&&displayed<=1;
   quantity.querySelector('[data-shop-step="1"]').disabled=displayed>=limit;
  }
 }
}
document.addEventListener('shop:cart-change',syncBuyControls);
document.addEventListener('change',event=>{
 const option=event.target;
 if(!option.matches('[data-shop-variant]')||!option.checked||option.disabled)return;
 const price=document.querySelector('[data-shop-price]');
 if(price&&price.textContent!==option.dataset.price)price.textContent=option.dataset.price;
 const group=document.querySelector('.shop-product [data-shop-buy]');
 if(group){group.dataset.code=option.value;group.dataset.pending='1';syncBuyControls();}
});
let toastTimer, toastText;
function notify(message){
 if(!notice)return;
 clearTimeout(toastTimer);
 const hide=()=>{notice.classList.remove('is-visible');notice.inert=true;};
 if(!toastText){
  toastText=document.createElement('strong');
  const link=document.createElement('a');link.href='/cart';link.textContent='Открыть корзину';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрыть уведомление');
  const content=document.createElement('div');content.append(toastText,link);
  notice.replaceChildren(content,close);
  close.addEventListener('click',()=>{clearTimeout(toastTimer);hide();});
 }
 if(toastText.textContent!==message)toastText.textContent=message;
 notice.inert=false;
 notice.classList.add('is-visible');
 toastTimer=setTimeout(hide,3500);
}
function closePicker(card,restoreFocus=false){
 const picker=card?.querySelector('[data-shop-picker]');
 if(!picker||picker.hidden)return;
 picker.hidden=true;
 picker.inert=true;
 card.classList.remove('is-picker-open');
 const trigger=card.querySelector('[data-shop-choose][aria-expanded="true"]');
 card.querySelectorAll('[data-shop-choose]').forEach(button=>button.setAttribute('aria-expanded','false'));
 if(restoreFocus)trigger?.focus({preventScroll:true});
}
function openPicker(button){
 const card=button.closest('[data-shop-card]');
 const picker=card?.querySelector('[data-shop-picker]');
 if(!picker)return;
 const wasOpen=!picker.hidden&&button.getAttribute('aria-expanded')==='true';
 document.querySelectorAll('[data-shop-card]').forEach(other=>closePicker(other));
 if(wasOpen)return;
 const delta=Number(button.dataset.shopChoose);
 const id=card.querySelector('[data-shop-buy]').dataset.product;
 picker.dataset.delta=String(delta);
 picker.querySelector('[data-shop-picker-title]').textContent=delta<0?'Какой вариант убрать?':'Выберите вариант';
 const current=readCart();
 for(const option of picker.querySelectorAll('[data-shop-pick]')){
  const line=current.find(item=>item.id===id&&item.code===option.dataset.shopPick);
  option.hidden=delta<0&&!line;
  option.disabled=delta>0&&((line?.quantity||0)>=limit||(!line&&current.length>=30));
 }
 picker.hidden=false;picker.inert=false;card.classList.add('is-picker-open');button.setAttribute('aria-expanded','true');
 picker.querySelector('[data-shop-pick]:not([hidden]):not(:disabled)')?.focus({preventScroll:true});
}
function changeQuantity(group,code,delta,button){
 const current=readCart();
 const id=group.dataset.product;
 const index=current.findIndex(line=>line.id===id&&line.code===code);
 const present=current[index];
 if(group.dataset.detail==='true'&&!present){
  if(button.hasAttribute('data-shop-step')){group.dataset.pending=String(Math.max(1,Math.min(limit,Number(group.dataset.pending||1)+delta)));syncBuyControls();return false;}
  delta=Number(group.dataset.pending||1);
 }
 if(delta>0&&((present?.quantity||0)+delta>limit||(!present&&current.length>=30))){notify('Достигнут предел количества в корзине.');return false;}
 if(present){present.quantity+=delta;if(present.quantity<=0)current.splice(index,1);}
 else if(delta>0)current.push({id,code,quantity:delta});
 else return false;
 if(group.dataset.detail==='true')group.dataset.pending='1';
 if(!storeCart(current)){notify('Браузер заблокировал сохранение корзины.');return false;}
 notify(delta>0?'Товар добавлен в корзину.':present?.quantity>0?'Количество изменено.':'Товар удалён из корзины.');
 return true;
}
document.addEventListener('click',event=>{
 const target=event.target;
 const close=target.closest('[data-shop-picker-close]');
 if(close){closePicker(close.closest('[data-shop-card]'),true);return;}
 const pick=target.closest('[data-shop-pick]');
 if(pick){
  if(pick.disabled||pick.hidden)return;
  const card=pick.closest('[data-shop-card]');
  const picker=pick.closest('[data-shop-picker]');
  if(picker.hidden)return;
  const group=card.querySelector('[data-shop-buy]');
  if(changeQuantity(group,pick.dataset.shopPick,Number(picker.dataset.delta),pick)){
   closePicker(card);
   const next=group.querySelector('[data-shop-quantity]:not([hidden]) button:last-child')||group.firstElementChild;
   next.focus({preventScroll:true});
  }
  return;
 }
 const choose=target.closest('[data-shop-choose]');
 if(choose){openPicker(choose);return;}
 const button=target.closest('[data-shop-add],[data-shop-step]');
 if(button){
  const group=button.closest('[data-shop-buy]');
  if(group&&!button.disabled){closePicker(group.closest('[data-shop-card]'));changeQuantity(group,group.dataset.code,Number(button.dataset.shopStep||1),button);}
  return;
 }
 if(target.closest('[data-shop-picker]'))return;
 document.querySelectorAll('[data-shop-card]').forEach(card=>closePicker(card));
 const card=target.closest('[data-shop-card]');
 if(!card||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||target.closest('a,button,input,select,textarea,label,[data-shop-buy]'))return;
 location.assign(card.dataset.shopHref);
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')document.querySelectorAll('[data-shop-card]').forEach(card=>closePicker(card,true));
});
syncBuyControls();

const catalogForm = document.querySelector('#shop-catalog-form');
if (catalogForm) {
 const layout = document.querySelector('.shop-catalog__layout');
 const details = layout.querySelector('details');
 const summary = details.querySelector('summary');
 const body = details.querySelector('.shop-filter__body');
 const results = layout.querySelector('[data-shop-results]');
 const status = layout.querySelector('[data-shop-filter-status]');
 const reset = details.querySelector('.shop-filter__reset');
 const count = document.querySelector('[data-shop-result-count]');
 const chip = layout.querySelector('.shop-category-chip');
 const compact = matchMedia('(max-width: 767px)');
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const easing = 'cubic-bezier(.22,.61,.36,1)';
 let foldAnimation, resultAnimation, request, desiredOpen;
 details.dataset.filterEnhanced="";
 function setFilterOpen(open, animate=true) {
  const start = details.getBoundingClientRect().height;
  foldAnimation?.cancel();
  foldAnimation = null;
  details.style.overflow='';
  desiredOpen = open;
  details.classList.toggle('is-expanded',open);
  if (!animate || reduced.matches || !details.animate) {details.open=open;body.inert=!open;return;}
  details.open=true;
  body.inert=!open;
  const end = open ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
  details.style.overflow='hidden';
  const animation = details.animate([{height:start+'px'},{height:end+'px'}],{duration:230,easing});
  foldAnimation=animation;
  animation.onfinish=()=>{if(foldAnimation!==animation)return;details.open=open;details.style.overflow='';foldAnimation=null;};
  animation.oncancel=()=>{if(foldAnimation===animation)details.style.overflow='';};
 }
 const syncFilters = () => setFilterOpen(!compact.matches || !reset.hidden,false);
 syncFilters();
 compact.addEventListener('change',syncFilters);
 summary.addEventListener('click',event=>{event.preventDefault();setFilterOpen(!desiredOpen);});
 // Retain the document, header, filter controls and scroll position. The server remains the source of filtered cards.
 function formUrl(){
  const url=new URL(catalogForm.action,location.href);
  for(const [name,value] of new FormData(catalogForm))if(value!=='')url.searchParams.set(name,value);
  return url;
 }
 function syncFields(incoming){
  for(const field of catalogForm.elements){
   if(!field.name)continue;
   const source=[...incoming.elements].find(el=>el.name===field.name&&(field.type!=='radio'||el.value===field.value));
   if(field.type==='radio')field.checked=!!source?.checked;
   else if(source)field.value=source.value;
  }
 }
 async function updateCatalog(url,{push=true,sync=false}={}){
  request?.abort();
  const controller=new AbortController();request=controller;
  results.setAttribute('aria-busy','true');status.hidden=true;
  try {
   const response=await fetch(url,{signal:controller.signal,cache:'no-store',headers:{Accept:'text/html'}});
   if(!response.ok)throw Error('Catalog request failed');
   const doc=new DOMParser().parseFromString(await response.text(),'text/html');
   const next=doc.querySelector('[data-shop-results]');
   const nextForm=doc.querySelector('#shop-catalog-form');
   const nextCount=doc.querySelector('[data-shop-result-count]');
   const nextChip=doc.querySelector('.shop-category-chip');
   const nextReset=doc.querySelector('.shop-filter__reset');
   if(!next||!nextForm||!nextCount||!nextChip||!nextReset)throw Error('Invalid catalog response');
   if(request!==controller)return;
   const oldHeight=results.getBoundingClientRect().height;
   resultAnimation?.cancel();
   const focused=document.activeElement;
   const focusWasInResults=results.contains(focused);
   results.replaceChildren(...next.childNodes);
   if(focusWasInResults) {count.tabIndex=-1;count.focus({preventScroll:true});}
   count.textContent=nextCount.textContent;chip.textContent=nextChip.textContent;
   if(sync)syncFields(nextForm);
   if(reset===focused&&nextReset.hidden)summary.focus({preventScroll:true});
   reset.hidden=nextReset.hidden;
   syncBuyControls();
   if(!reduced.matches&&results.animate){
    const height=results.getBoundingClientRect().height;
    resultAnimation=results.animate([{height:oldHeight+'px',opacity:.82,overflow:'clip'},{height:height+'px',opacity:1,overflow:'clip'}],{duration:220,easing});
   }
   if(push&&url.href!==location.href)history.pushState(null,'',url);
  } catch(error) {
   if(error.name==='AbortError'||request!==controller)return;
   status.textContent='Не удалось обновить каталог. Попробуйте ещё раз.';
   status.hidden=false;
   const retry=document.createElement('button');retry.type='button';retry.className='shop-filter-retry';retry.textContent='Повторить';
   retry.addEventListener('click',()=>updateCatalog(url,{push,sync}));status.append(' ',retry);
  } finally {
   if(request===controller){request=null;results.setAttribute('aria-busy','false');}
  }
 }
 catalogForm.addEventListener('submit',event=>{event.preventDefault();updateCatalog(formUrl());});
 layout.addEventListener('change',event=>{
  if(event.target.form===catalogForm&&event.target.matches('[name="category"],[name="sort"]'))catalogForm.requestSubmit();
 });
 reset.addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();updateCatalog(new URL(reset.href),{sync:true});
 });
 window.addEventListener('popstate',()=>{if(location.pathname==='/shop')updateCatalog(new URL(location.href),{push:false,sync:true});});
}
let refreshCart = ()=>{};
if (cartPage) {
 const lineBox = cartPage.querySelector('[data-cart-lines]');
 const totalBox = cartPage.querySelector('[data-cart-total]');
 const form = cartPage.querySelector('[data-shop-request]');
 const result = cartPage.querySelector('[data-shop-result]');
 const submit = form?.querySelector('button[type="submit"]');
 let products = null;
 let submitting = false;
 let attempt = null;
 let activeLines = [];
 let renderedRows = new Map();
 const shape = line => {
  const product = products.get(line.id);
  return {product,option:product?.variants.find(v=>v.code===line.code),line};
 };
 const controls = (line,index) => `<div class="shop-cart__actions">
 <button type="button" data-cart-change="-1" data-index="${index}" aria-label="Уменьшить количество">−</button>
 <span data-cart-quantity>${line.quantity}</span>
 <button type="button" data-cart-change="1" data-index="${index}" aria-label="Увеличить количество"${line.quantity>=limit?' disabled':''}>+</button>
 <button class="shop-remove" type="button" data-cart-change="remove" data-index="${index}">Удалить</button></div>`;
 function render() {
  if (!products) return;
  activeLines = [];
  let unavailable = false;
  const nextRows = new Map();
  const previousRows = renderedRows;
  const occurrences = new Map();
  cart.forEach((line,index)=>{
   const {product,option} = shape(line);
   const available = !!option?.available;
   if (available) activeLines.push({...line,price:option.price});
   else unavailable = true;
   const identity=JSON.stringify([line.id,line.code]);
   const occurrence=occurrences.get(identity)||0;
   occurrences.set(identity,occurrence+1);
   const key=JSON.stringify([line.id,line.code,occurrence]);
   const signature=JSON.stringify([product?.title,product?.slug,product?.image,option?.label,option?.price,available]);
   let row=previousRows.get(key);
   if(!row||row.signature!==signature){
    const template=document.createElement('template');
    template.innerHTML=`<article class="shop-line">
    ${product?.image?`<img src="${escape(product.image)}" alt="" width="92" height="92">`:'<span class="shop-line__placeholder" aria-hidden="true"></span>'}
    <div><h2>${product?`<a href="/shop/${encodeURIComponent(product.slug)}">${escape(product.title)}</a>`:'Товар больше недоступен'}</h2>
    ${option?`<p>${escape(option.label)}</p>`:''}${available?`<strong data-cart-line-total>${money(option.price*line.quantity)}</strong>`:'<p class="shop-unavailable">Уберите недоступную позицию, чтобы отправить заявку.</p>'}
    ${controls(line,index)}</div></article>`;
    const node=template.content.firstElementChild;
    row?.node.replaceWith(node);
    row={node,signature};
   }
   const quantity=row.node.querySelector('[data-cart-quantity]');
   if(quantity.textContent!==String(line.quantity))quantity.textContent=line.quantity;
   const lineTotal=row.node.querySelector('[data-cart-line-total]');
   if(lineTotal&&lineTotal.textContent!==money(option.price*line.quantity))lineTotal.textContent=money(option.price*line.quantity);
   for(const control of row.node.querySelectorAll('[data-cart-change]')){
    control.dataset.index=index;
    if(control.dataset.cartChange==='1')control.disabled=line.quantity>=limit;
   }
   nextRows.set(key,row);
  });
  for(const [key,row] of previousRows)if(!nextRows.has(key))row.node.remove();
  if(nextRows.size){
   for(const child of [...lineBox.childNodes])if(child.nodeType!==1||!child.matches('.shop-line'))child.remove();
   // Do not move existing nodes unless their order actually changes.
   let cursor=lineBox.firstElementChild;
   for(const {node} of nextRows.values()){
    if(node!==cursor)lineBox.insertBefore(node,cursor);
    cursor=node.nextElementSibling;
   }
  }else if(!lineBox.querySelector('.shop-empty')){
   lineBox.innerHTML='<p class="shop-empty">Корзина пуста. <a href="/shop">Перейти в каталог</a></p>';
  }
  renderedRows=nextRows;
  const total=money(activeLines.reduce((sum,line)=>sum+line.price*line.quantity,0));
  if(totalBox.textContent!==total)totalBox.textContent=total;
  if (submit) submit.disabled = submitting || unavailable || !activeLines.length;
 }
 refreshCart = render;
 lineBox.addEventListener('click',event=>{
  const button = event.target.closest('[data-cart-change]');
  if (!button || submitting) return;
  const index = Number(button.dataset.index);
  const next = cart.map(line=>({...line}));
  if (!next[index]) return;
  if (button.dataset.cartChange==='remove') next.splice(index,1);
  else {next[index].quantity += Number(button.dataset.cartChange);if(next[index].quantity<=0)next.splice(index,1);}
  if (!storeCart(next)) {result.textContent = 'Браузер заблокировал сохранение корзины.';return;}
  const change = button.dataset.cartChange;
  result.textContent = '';
  render();
  const selector = `[data-index="${Math.min(index,cart.length-1)}"]`;
  if(!button.isConnected||button.disabled)(lineBox.querySelector(`${selector}[data-cart-change="${change}"]:enabled`) || lineBox.querySelector(selector+':enabled') || lineBox.querySelector('a'))?.focus({preventScroll:true});
 });
 async function load() {
  try {
   const response = await fetch('/api/shop/products',{cache:'no-store'});
   if (!response.ok) throw Error();
   const data = await response.json();
   products = new Map(data.products.map(product=>[product.id,product]));
   render();
  } catch {
   products = null;
   renderedRows.clear();
   lineBox.textContent = 'Каталог сейчас недоступен. Обновите страницу, чтобы проверить корзину.';
   if (submit) submit.disabled = true;
  }
 }
 load();
 form?.addEventListener('submit',async event=>{
  event.preventDefault();
  if (submitting || submit.disabled || !form.reportValidity()) return;
  const values = new FormData(form);
  const payload = {name:values.get('name'),phone:values.get('phone'),consent:values.has('consent'),
   consentVersion:form.dataset.consentVersion,items:activeLines};
  const signature = JSON.stringify(payload);
  if (!attempt || attempt.signature!==signature) attempt = {signature,key:crypto.randomUUID()};
  submit.disabled = submitting = true;
  result.dataset.state = 'pending';
  result.textContent = 'Отправляем заявку…';
  try {
   const response = await fetch('/api/shop/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,key:attempt.key})});
   const data = await response.json().catch(()=>null);
   if (response.status>=500 || !data || (response.ok && !data.number)) throw new TypeError();
   if (!response.ok) {
    if (response.status===409) await load();
    throw Error(data.message||'Заявку не удалось отправить.');
   }
   // Keep cart entries added in a different tab while the request was in flight.
   const remaining = readCart().map(line=>{
    const sent = payload.items.find(item=>item.id===line.id && item.code===line.code);
    return sent ? {...line,quantity:line.quantity-sent.quantity} : line;
   }).filter(line=>line.quantity>0);
   storeCart(remaining);
   const receipt = document.querySelector('[data-shop-receipt]');
   receipt.querySelector('[data-shop-request-number]').textContent = data.number;
   cartPage.hidden = true;
   receipt.hidden = false;
   receipt.querySelector('h2').focus();
   attempt = null;
  } catch(error) {
   result.dataset.state = 'error';
   result.textContent = error instanceof TypeError
    ? 'Не удалось проверить, принята ли заявка. Повторите отправку без изменений, чтобы проверить результат.'
    : 'Заявка не отправлена. '+error.message;
  } finally {
   submitting = false;
   render();
  }
 });
}
window.addEventListener('storage',event=>{
 if (event.key!==storageKey && event.key!==null) return;
 cart = readCart();updateHeader();syncBuyControls();refreshCart();
});

window.addEventListener('pageshow',()=>{cart=readCart();updateHeader();syncBuyControls();refreshCart();});
