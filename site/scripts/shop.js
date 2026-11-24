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
 updateHeader();
 return true;
}
function updateHeader() {
 const count = cart.reduce((sum,line)=>sum+line.quantity,0);
 for (const badge of document.querySelectorAll('[data-shop-count]')) {
  badge.hidden = !count;
  badge.textContent = count;
  badge.closest('a').setAttribute('aria-label',count?'Корзина. Товаров: '+count:'Корзина');
 }
}
updateHeader();
document.addEventListener('fed:header-ready',updateHeader);

const variantSelect = document.querySelector('[data-shop-variant]');
if (variantSelect) {
 const syncPrice = () => {
  const option = variantSelect.selectedOptions[0];
  if (option && !option.disabled) document.querySelector('[data-shop-price]').textContent = option.dataset.price;
 };
 variantSelect.addEventListener('change',syncPrice);
 syncPrice();
}
document.addEventListener('click',event=>{
 const button = event.target.closest('[data-shop-add]');
 if(!button)return;
 let current = readCart();
 const code = variantSelect?.value || button.dataset.variant;
 const id = button.dataset.shopAdd;
 const present = current.find(line=>line.id===id && line.code===code);
 if (present?.quantity===limit || (!present && current.length===30)) {
  notice.textContent = 'Достигнут предел количества в корзине.';
  return;
 }
 if (present) present.quantity++;
 else current.push({id,code,quantity:1});
 if (!storeCart(current)) {
  notice.textContent = 'Браузер заблокировал сохранение корзины.';
  return;
 }
 notice.replaceChildren('Добавлено в корзину. ');
 const link = document.createElement('a');
 link.href = '/cart'; link.textContent = 'Открыть корзину'; notice.append(link);
 const feedback = button.closest('[data-quick-mobile]')?.querySelector('[data-quick-feedback]');
 if(feedback)feedback.replaceChildren('Добавлено. ',link.cloneNode(true));
});

const catalogForm = document.querySelector('#shop-catalog-form');
const smallCatalog = matchMedia('(max-width: 1099px)');
// Category and sort controls are associated to the form but live in the catalog layout.
document.querySelector('.shop-catalog__layout')?.addEventListener('change',event=>{
 if(event.target.form===catalogForm && event.target.matches('[name="category"],[name="sort"]'))catalogForm.requestSubmit();
});
const quickPanel = document.querySelector('[data-quick-panel]');
const quickDialog = document.querySelector('[data-quick-dialog]');
if(quickPanel && quickDialog){
 const mobilePanel = quickDialog.querySelector('[data-quick-mobile]');
 let selected = document.querySelector('[data-shop-card]');
 let trigger;
 function fillQuick(target,card){
  target.replaceChildren(card.querySelector('template').content.cloneNode(true));
  if(target===mobilePanel){
   const feedback=document.createElement('p');
   feedback.dataset.quickFeedback='';
   feedback.setAttribute('role','status');
   target.append(feedback);
  }
 }
 function showDesktop(){
  quickPanel.hidden=smallCatalog.matches;
  if(smallCatalog.matches){quickPanel.replaceChildren();selected?.removeAttribute('data-selected');return;}
  if(quickDialog.open)quickDialog.close();
  selected?.setAttribute('data-selected','');
  fillQuick(quickPanel,selected);
 }
 document.querySelector('.shop-grid').addEventListener('click',event=>{
  const link = event.target.closest('[data-quick-open]');
  if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  selected?.removeAttribute('data-selected');
  selected=link.closest('[data-shop-card]');
  if(smallCatalog.matches){
   trigger=link;
   fillQuick(mobilePanel,selected);
   quickDialog.showModal();
   mobilePanel.querySelector('[data-quick-title]').focus();
  } else {
   showDesktop();
   quickPanel.querySelector('[data-quick-title]').focus({preventScroll:true});
  }
 });
 document.addEventListener('change',event=>{
  const option=event.target;
  if(!option.matches('[name="quick-variant"]'))return;
  const target=option.closest('[data-quick-panel],[data-quick-mobile]');
  target.querySelector('[data-quick-price]').textContent=option.dataset.price;
  target.querySelector('[data-shop-add]').dataset.variant=option.value;
 });
 quickDialog.querySelector('[data-quick-close]').addEventListener('click',()=>quickDialog.close());
 quickDialog.addEventListener('click',event=>{if(event.target===quickDialog)quickDialog.close();});
 quickDialog.addEventListener('close',()=>{mobilePanel.replaceChildren();trigger?.focus();});
 smallCatalog.addEventListener('change',showDesktop);
 showDesktop();
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
 const shape = line => {
  const product = products.get(line.id);
  return {product,option:product?.variants.find(v=>v.code===line.code),line};
 };
 const controls = (line,index) => `<div class="shop-cart__actions">
 <button type="button" data-cart-change="-1" data-index="${index}" aria-label="Уменьшить количество"${line.quantity<=1?' disabled':''}>−</button>
 <span>${line.quantity}</span>
 <button type="button" data-cart-change="1" data-index="${index}" aria-label="Увеличить количество"${line.quantity>=limit?' disabled':''}>+</button>
 <button class="shop-remove" type="button" data-cart-change="remove" data-index="${index}">Удалить</button></div>`;
 function render() {
  if (!products) return;
  activeLines = [];
  let unavailable = false;
  lineBox.innerHTML = cart.map((line,index)=>{
   const {product,option} = shape(line);
   const available = !!option?.available;
   if (available) activeLines.push({...line,price:option.price});
   else unavailable = true;
   return `<article class="shop-line">
    ${product?.image?`<img src="${escape(product.image)}" alt="" width="92" height="92">`:'<span class="shop-line__placeholder" aria-hidden="true"></span>'}
    <div><h2>${product?`<a href="/shop/${encodeURIComponent(product.slug)}">${escape(product.title)}</a>`:'Товар больше недоступен'}</h2>
    ${option?`<p>${escape(option.label)}</p>`:''}${available?`<strong>${money(option.price*line.quantity)}</strong>`:'<p class="shop-unavailable">Уберите недоступную позицию, чтобы отправить заявку.</p>'}
    ${controls(line,index)}</div></article>`;
  }).join('')||'<p class="shop-empty">Корзина пуста. <a href="/shop">Перейти в каталог</a></p>';
  totalBox.textContent = money(activeLines.reduce((sum,line)=>sum+line.price*line.quantity,0));
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
  else next[index].quantity += Number(button.dataset.cartChange);
  if (!storeCart(next)) {result.textContent = 'Браузер заблокировал сохранение корзины.';return;}
  const change = button.dataset.cartChange;
  result.textContent = '';
  render();
  const selector = `[data-index="${Math.min(index,cart.length-1)}"]`;
  (lineBox.querySelector(`${selector}[data-cart-change="${change}"]:enabled`) || lineBox.querySelector(selector+':enabled') || lineBox.querySelector('a'))?.focus();
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
 cart = readCart();updateHeader();refreshCart();
});
