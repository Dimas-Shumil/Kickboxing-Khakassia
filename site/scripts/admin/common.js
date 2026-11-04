async function mountPage(page,createPage){
 const api=(url,options={})=>window.FederationAdminSession.requestJson(url,options);
'use strict';
const KEY = 'fed-admin-ui-v1';
const uid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const params = new URLSearchParams(location.search);
const now = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Krasnoyarsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const month = params.get('month') && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month')) ? params.get('month') : now.slice(0,7);
const e = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money = amount => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(amount / 100);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') ? new Date(value+'T12:00:00').toLocaleDateString('ru-RU') : 'Не указана';
const period = value => /^\d{4}-\d{2}$/.test(value||'') ? new Date(value+'-01T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}) : 'Не указан';
const icon = name => `<img class="icon" src="/site/img/admin/icons/${name}.svg" alt="">`;
const btn = (label,href,primary=false,i='') => `<a class="btn ${primary?'btn--primary':''}" href="${e(href)}">${i?icon(i):''}${e(label)}</a>`;
let state, storageProblem='';
if(!await window.FederationAdminSession.ready)return;
try {state=await api('/api/admin/dashboard');}
  catch(err){const root=document.querySelector('#admin-root');root.innerHTML=`<main class="panel" style="margin:10vh auto;max-width:600px"><h1>Не удалось загрузить управление</h1><p class="form-note">${e(err.message)}</p><a class="btn" href="/admin/login">К входу</a><a class="btn" href="/admin">Повторить</a></main>`;return;}
const bufferKey=KEY+'-'+state.user.id+'-preview';
try {const buffer=JSON.parse(sessionStorage.getItem(bufferKey)||'null');if(buffer){state.preview=buffer.news;state.editorBuffer=buffer.news;state.previewReturn=buffer.returnTo;}}catch{}
const canGym=state.user.role==='OWNER';
let dirty=false, saving=false;
const statuses={active:'Занимается',paused:'Приостановил',finished:'Завершил'};
const newsStatuses={draft:'Черновик',archived:'Архив'};
const studentName=id=>state.students.find(s=>s.id===id)?.name||'Ученик не найден';
const sortedPayments=()=>[...state.payments].sort((a,b)=>b.received.localeCompare(a.received));
const receiptTotal=()=>state.payments.filter(p=>p.received.slice(0,7)===month).reduce((a,p)=>a+p.amount,0);
const withoutPayment=()=>state.students.filter(s=>s.status==='active'&&!state.payments.some(p=>p.student===s.id&&p.period===month));
const countBadge = (text,kind='quiet')=>`<span class="badge badge--${kind}">${e(text)}</span>`;
function table(head,rows,empty='Записей пока нет') {
    return `<div class="table-wrap"><table class="responsive-table"><thead><tr>${head.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map((cell,i)=>`<td data-label="${e(head[i])}">${cell}</td>`).join('')}</tr>`).join(''):`<tr><td class="empty" colspan="${head.length}">${e(empty)}</td></tr>`}</tbody></table></div>`;
  }
function paymentRows(items,edit=true){return items.map(p=>[
    `<a href="/admin/student?id=${e(p.student)}">${e(studentName(p.student))}</a>`,
    `<span class="amount">${money(p.amount)}</span>`,date(p.received),e(period(p.period)),
    ...(edit?[`<a href="/admin/payment?id=${e(p.id)}">Изменить</a>`]:[])
  ]);}
function stats(items){return `<div class="stats">${items.map(([name,value,i])=>`<div class="stat"><span class="stat__symbol">${icon(i)}</span><div><p>${e(name)}</p><strong>${e(value)}</strong></div></div>`).join('')}</div>`;}
const tabs = () => `<nav class="tabs" aria-label="Управление залом">${[['gym','Обзор'],['students','Ученики'],['payments','Оплаты']].map(([id,title])=>`<a href="/admin/${id}?month=${month}" ${page===id?'aria-current="page"':''}>${title}</a>`).join('')}</nav>`;
const monthInput = () => `<label>Период обзора<input id="month" type="month" value="${month}" min="1900-01" max="2100-12"></label>`;
const gymToolbar=()=>`<div class="toolbar">${tabs()}<div class="actions">${monthInput()}${btn('Внести оплату','/admin/payment',true,'plus-lg')}${btn('Добавить ученика','/admin/student',false,'person-plus')}</div></div>`;
const field=(label,name,value='',type='text',required=false,extra='')=>`<label>${label}${required?' *':''}<input name="${name}" type="${type}" value="${e(value)}" ${required?'required':''} ${extra}></label>`;
const area=(label,name,value='',required=false)=>`<label class="span-all">${label}${required?' *':''}<textarea name="${name}" ${required?'required':''} maxlength="30000">${e(value)}</textarea></label>`;
const select=(label,name,options,value)=>`<label>${label}<select name="${name}" aria-label="${e(label)}" ${name==='student'?'required':''}>${options.map(([id,text])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(text)}</option>`).join('')}</select></label>`;
const formMessage = '<div id="form-message" class="notice notice--error" role="alert"></div>';
const saveActions=(back)=>`<div class="form-actions"><button class="btn btn--primary" type="submit">Сохранить</button>${btn('Отмена',back)}</div><p class="form-note">Данные сохраняются в SQLite. Контакты и оплаты доступны только владельцу.</p>`;
const notFound=()=>`<div class="panel"><h2>Запись не найдена</h2><p class="form-note">Запись недоступна или не найдена в базе.</p>${btn('Обзор сайта','/admin/dashboard')}</div>`;
const title={dashboard:'Обзор сайта',gym:'Управление залом',students:'Ученики',student:'Карточка ученика',payments:'Оплаты',payment:'Внести оплату',news:'Новости','news-edit':'Редактор новости','news-preview':'Предпросмотр новости'}[page];
const nav=[['dashboard','Обзор','house-door'],['news','Новости','newspaper'],['','Соревнования','trophy'],['','Люди','people'],['','История и архив','clock-history'],['','Медиа и документы','images'],['','Страницы','file-earmark-text'],['gym','Управление залом','activity'],['','Настройки и доступ','gear']];
const active=page.startsWith('news')?'news':['students','student','payments','payment'].includes(page)?'gym':page;
const clone=()=>JSON.parse(JSON.stringify(state));
const addChange=(next,text)=>{next.changes.push({text,at:new Date().toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk'})});next.changes=next.changes.slice(-50);};
const readForm=()=>Object.fromEntries(new FormData(form));
const cents=x=>{const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=1000000?Math.round(n*100):NaN;};
let form=null;
const ctx={KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,readForm,cents,get form(){return form;},setDirty(value){dirty=value;}};
const pageModule=createPage(ctx);
document.querySelector('#admin-root').innerHTML=`<aside class="sidebar" id="sidebar" aria-label="Боковая панель"><button class="btn sidebar__close" id="close-menu" aria-label="Закрыть меню">${icon('x-lg')}</button><a class="brand" href="/admin/dashboard"><img src="/site/img/logo-fed.png" alt="Логотип Федерации"><span>ФЕДЕРАЦИЯ<br>КИКБОКСИНГА<br>ХАКАСИИ</span></a><nav class="navigation" aria-label="Разделы управления">${nav.filter(([id])=>canGym||id!=='gym').map(([id,label,i])=>id?`<a href="/admin/${id}" ${id===active?'aria-current="page"':''}>${icon(i)}${label}</a>`:`<button disabled>${icon(i)}${label}<small>Позже</small></button>`).join('')}</nav><div class="sidebar__bottom">Управление Федерацией<br>SQLite · защищённый доступ</div></aside><main class="workspace" id="workspace"><header class="topbar"><button class="btn topbar__menu" id="open-menu" aria-label="Открыть меню" aria-controls="sidebar" aria-expanded="false">${icon('list')}</button><span class="topbar__label">Административная панель</span><div class="topbar__right"><time class="topbar__date">${e(new Date(now+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</time><a href="../">На сайт</a><span>${e(state.user.name)} · ${canGym?'Владелец':'Редактор'}</span><button class="btn" type="button" data-admin-logout>Выйти</button></div></header><div class="page-head"><h1>${title}</h1><span class="badge badge--green">Рабочая панель</span></div>${storageProblem?`<div class="notice notice--error" role="alert">${e(storageProblem)}</div>`:''}<div id="feedback" class="notice" role="status"></div>${pageModule.render()}</main><dialog id="leave-dialog" aria-labelledby="leave-title"><h2 id="leave-title">Есть несохранённые изменения</h2><p>Покинуть форму и потерять изменения?</p><div class="actions"><button class="btn" id="stay">Остаться</button><button class="btn btn--primary" id="leave">Уйти без сохранения</button></div></dialog>`;
function feedback(text,error=false){const el=document.querySelector('#form-message')||document.querySelector('#feedback');el.textContent=text;el.classList.toggle('notice--error',error);el.scrollIntoView({block:'nearest',behavior:'smooth'});}
async function persist(next) {
    if(saving)return null;
    const collection=['students','payments','news'].find(k=>JSON.stringify(state[k])!==JSON.stringify(next[k]));
    if(!collection){feedback('Нет изменений для сохранения.');return null;}
    const item=next[collection].find(n=>JSON.stringify(n)!==JSON.stringify(state[collection].find(o=>o.id===n.id)));
    const old=state[collection].find(n=>n.id===item.id);
    const reason=collection==='payments'&&old?item.history.at(-1)?.reason:undefined;
    let saved; saving=true;
    const controls=[...form.elements].map(el=>[el,el.disabled]);controls.forEach(([el])=>{el.disabled=true;});
    try {
      const data=await api('/api/admin/'+collection+(old?'/'+encodeURIComponent(old.id):''),{method:old?'PATCH':'POST',body:JSON.stringify({...item,version:old?.version,reason})});
      saved=data.entity;
    } catch(err){feedback(err.message+(err.status?'':' Не удалось подтвердить сохранение. Проверьте соединение и перечитайте запись перед повторной отправкой.'),true);return null;}finally{saving=false;controls.forEach(([el,disabled])=>{el.disabled=disabled;});}
    state=next;state[collection]=next[collection].map(n=>n.id===item.id?{...item,...saved}:n);
    dirty=false;
    if(collection==='news'){try{sessionStorage.removeItem(bufferKey);}catch{}}
    feedback('Запись сохранена в базе.');return saved;
  }
document.querySelector('#month')?.addEventListener('change',ev=>{if(ev.target.checkValidity()&&ev.target.value)location.href='/admin/'+page+'?month='+ev.target.value;});
form=document.querySelector('#student-form,#payment-form,#news-form');
pageModule.bind?.();
form?.addEventListener('input',()=>{dirty=true;});
form?.addEventListener('change',()=>{dirty=true;});
if(params.get('saved'))feedback('Запись сохранена в базе.');
const sidebar=document.querySelector('#sidebar'),open=document.querySelector('#open-menu'),close=document.querySelector('#close-menu');
const narrow=matchMedia('(max-width: 950px)');
const syncMenu=()=>{sidebar.inert=narrow.matches&&!sidebar.classList.contains('is-open');};
syncMenu();
narrow.addEventListener('change',syncMenu);
function menu(show){sidebar.classList.toggle('is-open',show);syncMenu();open.setAttribute('aria-expanded',String(show));if(show)close.focus();else open.focus();}
open.addEventListener('click',()=>menu(true));
close.addEventListener('click',()=>menu(false));
document.addEventListener('keydown',ev=>{if(sidebar.classList.contains('is-open')){if(ev.key==='Escape')menu(false);if(ev.key==='Tab'){const items=[...sidebar.querySelectorAll('a,button:not(:disabled)')],first=items[0],last=items.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}}});
document.addEventListener('click',ev=>{if(sidebar.classList.contains('is-open')&&!sidebar.contains(ev.target)&&!open.contains(ev.target))menu(false);});
const leaveDialog=document.querySelector('#leave-dialog');
let nextHref='';
document.addEventListener('click',ev=>{const a=ev.target.closest('a[href]');if(a&&dirty&&!a.hash){ev.preventDefault();nextHref=a.href;leaveDialog.showModal();}});
document.querySelector('#stay').onclick=()=>leaveDialog.close();
document.querySelector('#leave').onclick=()=>{dirty=false;location.href=nextHref;};
window.addEventListener('beforeunload',ev=>{if(dirty){ev.preventDefault();ev.returnValue='';}});
 document.querySelector('[data-admin-logout]')?.addEventListener('click',async()=>{if(dirty&&!confirm('Выйти и потерять несохранённые изменения?'))return;dirty=false;await window.FederationAdminSession.endSession();});
 document.addEventListener('admin:session-expired',()=>feedback('Сессия завершилась. Войдите заново в другой вкладке, затем повторите сохранение. Введённые данные остаются в форме.',true));
}
function mount(page,createPage){return mountPage(page,createPage).catch(error=>{console.error('Ошибка интерфейса управления:',error);const root=document.querySelector('#admin-root');root.textContent='Не удалось загрузить экран управления. Обновите страницу или проверьте соединение.';root.setAttribute('role','alert');});}
export {mount};
