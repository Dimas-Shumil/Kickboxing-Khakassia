/* Shared installer; state and registration are separate for the two applications. */
(() => {
 const mode=document.currentScript?.dataset.fedPwa||'public';
 const admin=mode!=='public',eligible=mode==='public'||mode==='admin';
 const key=`fkh19:${admin?'admin':'public'}:install`,week=7*86400000;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 let deferred=null,banner=null,elapsed=false,installed=false;
 const read=suffix=>{try{return localStorage.getItem(key+suffix);}catch{return null;}};
 const write=(suffix,value)=>{try{localStorage.setItem(key+suffix,value);}catch{}};
 const installedHere=read(':installed')==='yes';
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 // Safari is the conservative supported instruction path; embedded/other browsers get no dead button.
 const safari=ios&&/Version\/[\d.]+.*Safari\//.test(navigator.userAgent)&&!/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(navigator.userAgent);
 function blocked(){
  return [...document.querySelectorAll('dialog[open], [aria-modal="true"], .mobile-menu[aria-hidden="false"], #sidebar.is-open')].some(el=>{
   if(el.closest('[hidden], [aria-hidden="true"]')||el.matches('dialog:not([open])'))return false;
   for(let node=el;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;}
   return true;
  });
 }
 const remove=()=>{banner?.remove();banner=null;};
 function later(){write(':later',String(Date.now()));remove();}
 function offer(){
  if(!eligible||!elapsed||installed||standalone()||installedHere||banner||document.hidden||(!deferred&&!safari))return;
  if(Date.now()-Number(read(':later')||0)<week)return;
  if(blocked()||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;
  banner=document.createElement('aside');banner.className='pwa-install';banner.setAttribute('aria-label','Установка приложения');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Krasnoyarsk',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(':','.'));
  banner.dataset.pwaPhase=hour<7.45||hour>=20.15?'night':'day';
  banner.innerHTML=`<div class="pwa-install__content"><p class="pwa-install__title"><img class="pwa-install__logo" src="/pwa/assets/${admin?'admin':'public'}-192.png" width="34" height="34" alt=""><strong>${admin?'ФКХ · Управление':'Кикбоксинг Хакасии'}</strong></p><p class="pwa-install__text">${admin?'Ученики, оплаты и управление сайтом — в приложении.':'Новости, соревнования и тренеры — в приложении.'}</p><p class="pwa-install__hint" data-instructions role="status" hidden></p></div><div class="pwa-install__actions"><button class="pwa-install__button" type="button" data-install>Установить</button><button class="pwa-install__button pwa-install__button--later" type="button" data-later>Позже</button></div><button class="pwa-install__close" type="button" data-close aria-label="Закрыть предложение установки">×</button>`;
  document.body.append(banner);banner.querySelector('[data-later]').onclick=later;banner.querySelector('[data-close]').onclick=later;
  banner.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();later();}});
  let touch=null;
  banner.addEventListener('touchstart',event=>{touch=null;if(event.touches.length!==1||event.target.closest('button,a'))return;const p=event.touches[0];touch={x:p.clientX,y:p.clientY};},{passive:true});
  banner.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  banner.addEventListener('touchmove',event=>{if(event.touches.length!==1)touch=null;},{passive:true});
  banner.addEventListener('touchend',event=>{const start=touch;touch=null;if(!start||event.touches.length||event.changedTouches.length!==1)return;const p=event.changedTouches[0],dx=p.clientX-start.x,dy=p.clientY-start.y;
   if(Math.abs(dx)>=56&&Math.abs(dx)>Math.abs(dy)*1.2||dy<=-56&&Math.abs(dy)>Math.abs(dx)*1.2&&banner.scrollHeight<=banner.clientHeight+1)later();
  },{passive:true});
  banner.querySelector('[data-install]').onclick=async()=>{
   if(safari&&!deferred){const note=banner.querySelector('[data-instructions]');note.hidden=false;note.textContent='В Safari нажмите «Поделиться», затем «На экран Домой» → «Добавить». Если есть «Открывать как веб-приложение», включите его.';return;}
   const prompt=deferred;deferred=null;if(!prompt){remove();return;}
   remove();try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted'){installed=true;write(':installed','yes');}else later();}catch{/* Browser withdrew the offer. */}
  };
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;offer();});
 window.addEventListener('appinstalled',()=>{installed=true;write(':installed','yes');remove();});
 if(standalone())write(':installed','yes');
 // Do not overwrite an unrelated registration at the same scope.
 async function register(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  const scope=admin?'/admin/':'/',script=admin?'/admin/sw.js':'/sw.js';
  try{
   const regs=await navigator.serviceWorker.getRegistrations(),existing=regs.find(r=>r.scope===new URL(scope,location.origin).href);
   if(existing&&[existing.active,existing.waiting,existing.installing].some(w=>w&&new URL(w.scriptURL).pathname!==script))return;
   const reg=await navigator.serviceWorker.register(script,{scope,updateViaCache:'none'});
   const waiting=()=>{if(reg.waiting){const el=document.createElement('p');el.className='pwa-update';el.textContent='Новая версия готова. Сохраните изменения и закройте все окна приложения. Версия обновится при следующем открытии.';if(!document.querySelector('.pwa-update'))document.body.append(el);}};
   waiting();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',waiting));
  }catch{/* Website remains usable without service workers. */}
 }
 if(mode==='private'){
  const lock=()=>document.documentElement.classList.add('admin-locked');
  window.addEventListener('pagehide',lock);
  window.addEventListener('pageshow',event=>{if(event.persisted){lock();location.replace('/admin/login');}});
  window.addEventListener('offline',()=>{lock();location.replace('/admin/offline');});
 }
 void register();
 async function begin(){
  if(!eligible)return;
  if(admin){if(!window.FederationAdminSession||!await window.FederationAdminSession.ready)return;}
  setTimeout(()=>{elapsed=true;offer();},10000);
 }
 void begin();document.addEventListener('visibilitychange',offer);document.addEventListener('focusout',()=>setTimeout(offer,0));
 // A dismissed search/menu/dialog must release the delayed offer without a reload.
 const overlayObserver=new MutationObserver(()=>{if(!window.document)return;if(blocked())remove();else offer();});
 overlayObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','open','class','style']});
 const net=document.createElement('div');net.className='pwa-network';net.setAttribute('role','status');net.hidden=true;
 const network=()=>{net.hidden=navigator.onLine;net.textContent=admin?'Нет сети. Для управления нужно подключение. Проверьте результат действия перед повторной отправкой.':'Нет сети. Для просмотра страниц нужно подключение.';if(!net.isConnected)document.body.append(net);if(!navigator.onLine)remove();else offer();};
 window.addEventListener('offline',network);window.addEventListener('online',network);network();
 document.addEventListener('admin:session-expired',()=>{installed=true;remove();});
})();
