// One document, one shell, isolated page lifetimes. Ordinary URLs remain valid.
const pages=new Map();
const supported=new Set(['dashboard','activity','gym','students','student','groups','group','trainings','training','attendance','payments','payment','finances','access','news','news-edit','news-preview','people','person-edit','competitions','competition-edit','history','history-edit','site-pages','site-page-edit','site-documents','site-document-edit','site-media']);
let started=false,renderer,current=null,controller=null,sequence=0,index=0,ignorePop=null,leavePromise=null,resolveLeave=null;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const hrefFor=url=>url.pathname+url.search+url.hash;
function parse(href){const url=new URL(href,location.href);const name=/^\/admin\/([a-z-]+)$/.exec(url.pathname)?.[1];return url.origin===location.origin&&supported.has(name)?{url,name}:null;}
function activeFor(page){return page==='site-page-edit'?'site-pages':page==='site-document-edit'?'site-documents':page==='history-edit'?'history':page==='competition-edit'?'competitions':page==='person-edit'?'people':page.startsWith('news')?'news':['gym','students','student','groups','group','trainings','training','attendance','payments','payment','finances'].includes(page)?'gym':page;}
function moveIndicator(active,instant=false){
 const nav=document.querySelector('.navigation');if(!nav)return;
 let indicator=nav.querySelector('.navigation__indicator');if(!indicator){indicator=document.createElement('span');indicator.className='navigation__indicator';indicator.setAttribute('aria-hidden','true');nav.prepend(indicator);}
 let target=null;
 for(const link of nav.querySelectorAll('a')){const selected=link.pathname==='/admin/'+active;link.toggleAttribute('data-selected',selected);if(selected){link.setAttribute('aria-current','page');target=link;}else link.removeAttribute('aria-current');}
 if(!target)return;indicator.hidden=false;
 if(instant)nav.classList.add('navigation--instant');
 indicator.style.height=target.offsetHeight+'px';indicator.style.transform=`translateY(${target.offsetTop}px)`;
 if(instant){void indicator.offsetHeight;nav.classList.remove('navigation--instant');}
}
function busy(value,name){
 document.body.classList.toggle('admin--navigating',value);
 const status=document.querySelector('#admin-navigation-status');if(status){status.textContent=value?'Открываем раздел…':'';status.hidden=!value;}
 if(current?.root){current.root.inert=value;current.root.setAttribute('aria-busy',String(value));}
 if(name)moveIndicator(activeFor(name));
}
function message(error){const node=document.querySelector('#feedback');if(node){node.textContent=error;node.classList.add('notice--error');}}
function closeMenu(){const sidebar=document.querySelector('#sidebar');sidebar?.classList.remove('is-open');document.querySelector('#open-menu')?.setAttribute('aria-expanded','false');syncMenu();}
function syncMenu(){const sidebar=document.querySelector('#sidebar');if(sidebar)sidebar.inert=matchMedia('(max-width: 950px)').matches&&!sidebar.classList.contains('is-open');}
function saveScroll(){const saved=history.state?.fedAdmin;if(saved)history.replaceState({...history.state,fedAdmin:{...saved,scroll:window.scrollY}},'');}
function jump(delta){return new Promise(resolve=>{ignorePop=resolve;history.go(delta);});}
function installShell(html){
 if(document.querySelector('#admin-view-slot'))return;
 document.querySelector('#admin-root').innerHTML=html;
 document.querySelector('#workspace').insertAdjacentHTML('afterbegin','<div id="admin-navigation-status" class="admin-navigation-status" role="status" aria-live="polite" hidden></div>');
 const sidebar=document.querySelector('#sidebar'),open=document.querySelector('#open-menu'),close=document.querySelector('#close-menu');
 function menu(show){sidebar.classList.toggle('is-open',show);syncMenu();open.setAttribute('aria-expanded',String(show));if(show)close.focus();else open.focus();}
 open.onclick=()=>menu(true);close.onclick=()=>menu(false);syncMenu();
 window.addEventListener('resize',()=>{syncMenu();moveIndicator(current?.active,true);});
 document.fonts?.ready.then(()=>moveIndicator(current?.active,true));
 document.addEventListener('keydown',event=>{
  if(!sidebar.classList.contains('is-open'))return;
  if(event.key==='Escape')menu(false);
  if(event.key==='Tab'){const items=[...sidebar.querySelectorAll('a,button:not(:disabled)')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 });
 document.addEventListener('click',event=>{if(sidebar.classList.contains('is-open')&&!sidebar.contains(event.target)&&!open.contains(event.target))closeMenu();});
 const dialog=document.querySelector('#leave-dialog');
 const finish=value=>{dialog.close();const resolve=resolveLeave;resolveLeave=null;leavePromise=null;resolve?.(value);};
 document.querySelector('#stay').onclick=()=>finish(false);document.querySelector('#leave').onclick=()=>finish(true);
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 document.querySelector('[data-admin-logout]').onclick=async()=>{if(!await navigation.allowLeave())return;current?.clearDirty();await window.FederationAdminSession.endSession();};
}
export const navigation={
 async allowLeave(){
  if(current?.isSaving()){message('Дождитесь завершения сохранения.');return false;}
  if(!current?.isDirty())return true;
  const dialog=document.querySelector('#leave-dialog');
  if(typeof dialog?.showModal!=='function')return confirm('Покинуть форму и потерять несохранённые изменения?');
  if(!leavePromise){leavePromise=new Promise(resolve=>{resolveLeave=resolve;});dialog.showModal();}
  return leavePromise;
 },
 hard(href){sequence++;controller?.abort();current?.dispose();current?.abort();current?.root.replaceChildren();current?.clearDirty();location.assign(href);},
 async go(href,options={}){
  const target=parse(href);
  if(!target){if(await this.allowLeave())this.hard(href);return false;}
  const ticket=++sequence;
  if(!options.initial&&!await this.allowLeave())return false;
  if(ticket!==sequence)return false;
  controller?.abort();const nextController=new AbortController();controller=nextController;
  // Current reads remain valid until commit; only the next preparation is cancelled.
  busy(true,target.name);closeMenu();
  const timeout=setTimeout(()=>nextController.abort(),20000);
  let prepared;
  try{
   const [response]=await Promise.all([
    fetch(hrefFor(target.url),{credentials:'same-origin',cache:'no-store',signal:nextController.signal}),
    pages.has(target.name)?Promise.resolve():import('./'+target.name+'.js')
   ]);
   if(response.redirected){if(ticket===sequence){if(current&&new URL(response.url).pathname==='/admin/login'){busy(false);moveIndicator(current.active,true);current.feedback('Сессия завершилась. Войдите заново в другой вкладке; введённые данные остались в форме.',true);}else this.hard(response.url);}return false;}
   if(!response.ok)throw new Error(response.status===403?'Этот раздел недоступен вашей учётной записи.':response.status===404?'Запись или раздел не найдены.':'Не удалось открыть раздел.');
   await response.body?.cancel();
   prepared=await renderer(target.name,pages.get(target.name),{url:target.url,signal:nextController.signal});
   if(!prepared)return false;
   if(ticket!==sequence||nextController.signal.aborted){prepared.dispose();return false;}
   if(current&&(prepared.state.user.id!==current.state.user.id||prepared.state.user.role!==current.state.user.role||prepared.state.gymId!==current.state.gymId)){prepared.dispose();this.hard(hrefFor(target.url));return false;}
   const previous=current;
   if(options.popDelta){await jump(options.popDelta);if(ticket!==sequence){prepared.dispose();return false;}index=options.popIndex;}
   else if(!options.initial){saveScroll();index=options.replace?index:index+1;history[options.replace?'replaceState':'pushState']({...history.state,fedAdmin:{index,scroll:0}},'',hrefFor(target.url));}
   installShell(prepared.shellHTML);
   previous?.dispose();previous?.abort();current=prepared;current.abort=()=>nextController.abort();if(controller===nextController)controller=null;
   document.querySelector('#admin-view-slot').replaceChildren(prepared.root);
   document.body.dataset.page=target.name;document.title=prepared.title+' — Федерация';
   moveIndicator(prepared.active,!!options.initial);busy(false);
   const heading=prepared.root.querySelector('h1');heading?.setAttribute('tabindex','-1');if(!options.initial)heading?.focus({preventScroll:true});
   const scrollBehavior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,options.scroll||0);document.documentElement.style.scrollBehavior=scrollBehavior;
   if(!reduced()&&prepared.root.animate)prepared.root.animate([{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'ease-out'});
   return true;
  }catch(error){
   prepared?.dispose();
   if(ticket!==sequence)return false;
   busy(false);moveIndicator(current?.active,true);
   if(error.status===401)return false;
   const explanation=nextController.signal.aborted?'Раздел загружается слишком долго. Повторите переход.':error.message;
   if(current){message(explanation+' Можно повторить переход. ');const link=document.createElement('a');link.href=hrefFor(target.url);link.dataset.adminHard='';link.textContent='Открыть обычным переходом';document.querySelector('#feedback')?.append(link);}
   else{const root=document.querySelector('#admin-root');root.replaceChildren();const box=document.createElement('main');box.className='panel';const p=document.createElement('p');p.textContent=explanation;const retry=document.createElement('a');retry.href=hrefFor(target.url);retry.dataset.adminHard='';retry.textContent='Повторить загрузку';box.append(p,retry);root.append(box);}
   return false;
  }finally{clearTimeout(timeout);}
 }
};
function start(){
 history.scrollRestoration='manual';index=history.state?.fedAdmin?.index||0;
 history.replaceState({...history.state,fedAdmin:{index,scroll:window.scrollY}},'');
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||link.target&&link.target!=='_self')return;
  if(link.hasAttribute('data-admin-hard')){event.preventDefault();void navigation.allowLeave().then(ok=>{if(ok)navigation.hard(link.href);});return;}
  const target=parse(link.href);
  if(target&&target.url.pathname===location.pathname&&target.url.search===location.search&&target.url.hash)return;
  if(target&&target.url.href===location.href&&!document.body.classList.contains('admin--navigating')){event.preventDefault();closeMenu();return;}
  if(target){event.preventDefault();void navigation.go(link.href);}
  else if((current?.isDirty()||current?.isSaving())&&!link.hash){event.preventDefault();void navigation.allowLeave().then(ok=>{if(ok)navigation.hard(link.href);});}
 });
 document.addEventListener('submit',event=>{
  const form=event.target;if(event.defaultPrevented||form.id!=='activity-filters')return;
  event.preventDefault();const url=new URL(form.action);url.search=new URLSearchParams(new FormData(form)).toString();void navigation.go(url.href);
 });
 window.addEventListener('popstate',async event=>{
  if(ignorePop){const resolve=ignorePop;ignorePop=null;resolve();return;}
  const saved=event.state?.fedAdmin;if(!saved){navigation.hard(location.href);return;}
  const target=location.href,delta=saved.index-index;
  if(!delta){navigation.hard(target);return;}
  // Restore the current entry before asking, so Cancel preserves both URL and form.
  await jump(-delta);
  await navigation.go(target,{popDelta:delta,popIndex:saved.index,scroll:saved.scroll||0});
 });
 let scrollFrame=0;window.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;if(!ignorePop)saveScroll();});},{passive:true});
 // Session guard revalidates a restored document before revealing it.
 window.addEventListener('beforeunload',event=>{if(current?.isDirty()||current?.isSaving()){event.preventDefault();event.returnValue='';}});
 document.addEventListener('admin:session-expired',()=>current?.clearDirty());
 void navigation.go(location.href,{initial:true});
}
export function registerPage(page,factory,render){pages.set(page,factory);renderer=render;if(!started){started=true;start();}}
