import {paymentStatus,nextPaymentDate} from './payment-status.js';
import {navigation,registerPage} from './navigation.js';
async function mountPage(page,createPage,route){
 const root=document.createElement('div');root.className='admin-view';
 let alive=true,writes=0;const pending=new Set();
 const api=async(url,options={})=>{
  if(!alive||route.signal.aborted)throw new DOMException('Экран закрыт','AbortError');
  const mutation=options.method&&!['GET','HEAD'].includes(options.method.toUpperCase());
  if(mutation)writes++;
  const task=window.FederationAdminSession.requestJson(url,{...options,...(!mutation?{signal:route.signal}:{})});
  pending.add(task);
  try{const data=await task;if(!alive||route.signal.aborted)throw new DOMException('Экран закрыт','AbortError');return data;}
  finally{pending.delete(task);if(mutation)writes--;}
 };
'use strict';
const KEY = 'fed-admin-ui-v1';
const uid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const params = new URLSearchParams(route.url.search);
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
try {state=await api('/api/admin/dashboard?view='+encodeURIComponent(page));}
  catch(err){throw err;}
const bufferKey=KEY+'-'+state.user.id+'-preview';
try {const buffer=JSON.parse(sessionStorage.getItem(bufferKey)||'null');if(buffer){state.preview=buffer.news;state.editorBuffer=buffer.news;state.previewReturn=buffer.returnTo;}}catch{}
const canPublish=['OWNER','TRAINER'].includes(state.user.role);
const canGym=['OWNER','TRAINER'].includes(state.user.role);
let dirty=false, saving=false;
const statuses={active:'Занимается',paused:'Приостановил',finished:'Завершил'};
const newsStatuses={draft:'Черновик',published:'Опубликовано',archived:'Архив'};
const studentName=id=>state.students.find(s=>s.id===id)?.name||state.payments.find(p=>p.student===id)?.pupil?.name||'Ученик не найден';
const sortedPayments=()=>[...state.payments].sort((a,b)=>b.received.localeCompare(a.received));
const receiptTotal=()=>state.payments.filter(p=>p.received.slice(0,7)===month).reduce((a,p)=>a+p.amount,0);
const countBadge = (text,kind='quiet')=>`<span class="badge badge--${kind}">${e(text)}</span>`;
function table(head,rows,empty='Записей пока нет') {
    return `<div class="table-wrap"><table class="responsive-table"><thead><tr>${head.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map((cell,i)=>`<td data-label="${e(head[i])}">${cell}</td>`).join('')}</tr>`).join(''):`<tr><td class="empty" colspan="${head.length}">${e(empty)}</td></tr>`}</tbody></table></div>`;
  }
const paymentBadge=student=>{const status=paymentStatus(student,state.payments,now);return countBadge(status.text,status.kind)+(status.due?`<small class="payment-due">Оплата ${date(status.due)}</small>`:'');};
const deleteButton=(kind,item)=>`<button type="button" class="btn btn--danger btn--compact" data-delete-kind="${kind}" data-delete-id="${e(item.id)}" data-delete-version="${item.version}">Удалить</button>`;
function paymentRows(items,edit=true){return items.map(p=>[
    (state.students.some(s=>s.id===p.student)?`<a href="/admin/student?id=${e(p.student)}">${e(studentName(p.student))}</a>`:e(studentName(p.student))+' <small>'+(p.pupil?.deletedAt?'(ученик удалён)':'')+'</small>') ,
    `<span class="amount">${money(p.amount)}</span>`,date(p.received),e(period(p.period))+`<small class="payment-due">Срок: ${date(p.received)} — ${date(nextPaymentDate(p.received))}</small>`,
    ...(edit?[`<div class="row-actions"><a href="/admin/payment?id=${e(p.id)}">Изменить</a>${deleteButton('payments',p)}</div>`]:[])
  ]);}
function stats(items){return `<div class="stats">${items.map(([name,value,i])=>`<div class="stat"><span class="stat__symbol">${icon(i)}</span><div><p>${e(name)}</p><strong>${e(value)}</strong></div></div>`).join('')}</div>`;}
const tabs = () => `<nav class="tabs" aria-label="Управление залом">${[['gym','Обзор'],['students','Ученики'],['groups','Группы'],['trainings','Тренировки'],['payments','Оплаты'],['finances','Доходы и расходы']].map(([id,title])=>`<a href="/admin/${id}?month=${month}" ${page===id?'aria-current="page"':''}>${title}</a>`).join('')}</nav>`;
const monthInput = () => `<label>Период обзора<input id="month" type="month" value="${month}" min="1900-01" max="2100-12"></label>`;
const gymToolbar=()=>`<div class="toolbar">${tabs()}<div class="actions">${monthInput()}${btn('Внести оплату','/admin/payment',true,'plus-lg')}${btn('Добавить ученика','/admin/student',false,'person-plus')}</div></div>`;
const field=(label,name,value='',type='text',required=false,extra='')=>`<label>${label}${required?' *':''}<input name="${name}" type="${type}" value="${e(value)}" ${required?'required':''} ${extra}></label>`;
const area=(label,name,value='',required=false)=>`<label class="span-all">${label}${required?' *':''}<textarea name="${name}" ${required?'required':''} maxlength="30000">${e(value)}</textarea></label>`;
const select=(label,name,options,value)=>`<label>${label}<select name="${name}" aria-label="${e(label)}" ${name==='student'?'required':''}>${options.map(([id,text])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(text)}</option>`).join('')}</select></label>`;
const formMessage = '<div id="form-message" class="notice notice--error" role="alert"></div>';
const saveActions=(back)=>`<div class="form-actions"><button class="btn btn--primary" type="submit">Сохранить</button>${btn('Отмена',back)}</div><p class="form-note">Данные сохраняются в SQLite. Учёт доступен владельцу и тренеру назначенного зала.</p>`;
const notFound=()=>`<div class="panel"><h2>Запись не найдена</h2><p class="form-note">Запись недоступна или не найдена в базе.</p>${btn('Обзор сайта','/admin/dashboard')}</div>`;
const title={finances:'Доходы и расходы',access:'Учётные записи',dashboard:'Аналитика Федерации',activity:'Журнал действий',gym:'Управление залом',students:'Ученики',student:'Карточка ученика',groups:'Группы',group:'Карточка группы',trainings:'Тренировки',training:'Карточка тренировки',attendance:'Посещаемость',payments:'Оплаты',payment:'Внести оплату',news:'Новости','news-edit':'Редактор новости','news-preview':'Предпросмотр новости',competitions:'Соревнования','competition-edit':'Редактор соревнования',history:'История и архив','history-edit':'Редактор истории',people:'Люди', 'person-edit':'Редактор профиля','site-pages':'Страницы Федерации','site-page-edit':'Редактор страницы','site-documents':'Документы Федерации','site-document-edit':'Редактор документа','site-media':'Медиатека'}[page];
const nav=[['dashboard','Аналитика','house-door'],['activity','Журнал действий','clock-history'],['news','Новости','newspaper'],['competitions','Соревнования','trophy'],['people','Люди','people'],['history','История и архив','clock-history'],['site-documents','Документы','file-earmark-text'],['site-media','Медиатека','images'],['site-pages','Страницы','file-earmark-text'],['gym','Управление залом','activity'],['access','Учётные записи','gear']];
const active=page==='site-page-edit'?'site-pages':page==='site-document-edit'?'site-documents':page==='history-edit'?'history':page==='competition-edit'?'competitions':page==='person-edit'?'people':page.startsWith('news')?'news':['groups','group','trainings','training','attendance','students','student','payments','payment','finances'].includes(page)?'gym':page;
const clone=()=>JSON.parse(JSON.stringify(state));
const addChange=(next,text)=>{next.changes.push({text,at:new Date().toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk'})});next.changes=next.changes.slice(-50);};
const readForm=()=>Object.fromEntries(new FormData(form));
const cents=x=>{const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=1000000?Math.round(n*100):NaN;};
let form=null;
const ctx={root,deleteButton,paymentBadge,nextPaymentDate,replace:(href)=>alive&&!route.signal.aborted?navigation.go(href,{replace:true}):Promise.resolve(false),navigate:(href,options)=>alive&&!route.signal.aborted?navigation.go(href,options):Promise.resolve(false),KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,canPublish,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,readForm,cents,get form(){return root.querySelector('form[id$="-form"]');},setDirty(value){dirty=value;}};
const pageModule=createPage(ctx);
root.innerHTML=`<div class="page-head"><h1>${title}</h1><span class="badge badge--green">Рабочая панель</span></div>${storageProblem?`<div class="notice notice--error" role="alert">${e(storageProblem)}</div>`:''}<div id="feedback" class="notice" role="status"></div>${canGym?`<div class="toolbar"><label>Зал ${state.user.role==='OWNER'?`<select id="gym-switch"><option value="unassigned" ${state.gymId===null?'selected':''}>Нераспределённые записи</option>${state.gyms.map(g=>`<option value="${e(g.id)}" ${state.gymId===g.id?'selected':''}>${e(g.name)}</option>`).join('')}</select>`:`<strong>${e(state.gyms[0]?.name||'Зал не назначен')}</strong>`}</label></div>`:''}${pageModule.render()}`;
root.addEventListener('click',async event=>{
 const button=event.target.closest('[data-delete-kind]');if(!button||saving||writes)return;
 const kind=button.dataset.deleteKind;
 const messages={students:'Удалить ученика из списка? Его оплаты и посещения останутся в истории.',groups:'Удалить группу из справочника? Ученики и история тренировок сохранятся.',payments:'Удалить оплату? Она перестанет учитываться в суммах и оплаченном сроке. Запись останется в истории.'};
 if(!messages[kind]||!confirm(messages[kind]))return;
 saving=true;button.disabled=true;
 try{
  await api('/api/admin/'+(kind==='groups'?'gym/groups':kind)+'/'+encodeURIComponent(button.dataset.deleteId),{method:'DELETE',body:JSON.stringify({version:Number(button.dataset.deleteVersion)})});
  dirty=false;saving=false;await ctx.replace('/admin/'+kind+'?month='+month);
 }catch(err){feedback(err.message,true);button.disabled=false;}finally{saving=false;}
});
const shellHTML=`<aside class="sidebar" id="sidebar" aria-label="Боковая панель"><button class="btn sidebar__close" id="close-menu" aria-label="Закрыть меню">${icon('x-lg')}</button><a class="brand" href="/admin/dashboard"><img src="/site/img/logo-fed.png" alt="Логотип Федерации"><span>ФЕДЕРАЦИЯ<br>КИКБОКСИНГА<br>ХАКАСИИ</span></a><nav class="navigation" aria-label="Разделы управления">${nav.filter(([id])=>(canGym||id!=='gym')&&(id!=='access'||state.user.role==='OWNER')).map(([id,label,i])=>id?`<a href="/admin/${id}" >${icon(i)}${label}</a>`:`<button disabled>${icon(i)}${label}<small>Позже</small></button>`).join('')}</nav><div class="sidebar__bottom">Управление Федерацией<br>SQLite · защищённый доступ</div></aside><main class="workspace" id="workspace"><header class="topbar"><button class="btn topbar__menu" id="open-menu" aria-label="Открыть меню" aria-controls="sidebar" aria-expanded="false">${icon('list')}</button><span class="topbar__label">Административная панель</span><div class="topbar__right"><time class="topbar__date">${e(new Date(now+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</time><a href="../">На сайт</a><span>${e(state.user.name)} · ${state.user.role==='OWNER'?'Владелец':state.user.role==='TRAINER'?'Тренер':'Редактор'}</span><button class="btn" type="button" data-admin-logout>Выйти</button></div></header><div id="admin-view-slot"></div></main><dialog id="leave-dialog" aria-labelledby="leave-title"><h2 id="leave-title">Есть несохранённые изменения</h2><p>Покинуть форму и потерять изменения?</p><div class="actions"><button class="btn" id="stay">Остаться</button><button class="btn btn--primary" id="leave">Уйти без сохранения</button></div></dialog>`;
root.querySelector('#gym-switch')?.addEventListener('change',async event=>{
 const target=event.target.value;
 if(!await navigation.allowLeave()){event.target.value=state.gymId||'unassigned';return;}
 if(writes){event.target.value=state.gymId||'unassigned';return;}
 dirty=false;
 document.cookie='fed_gym='+encodeURIComponent(target)+'; Path=/; SameSite=Strict'+(location.protocol==='https:'?'; Secure':'');
 // A hard boundary intentionally clears every old gym view, request and closure.
 navigation.hard('/admin/gym');
});
function feedback(text,error=false){if(!alive||route.signal.aborted)return;const el=root.querySelector('#form-message')||root.querySelector('#feedback');if(!el)return;el.textContent=text;el.classList.toggle('notice--error',error);if(root.isConnected)el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
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
root.querySelector('#month')?.addEventListener('change',ev=>{if(ev.target.checkValidity()&&ev.target.value)void ctx.navigate('/admin/'+page+'?month='+ev.target.value);});
form=ctx.form;
root.addEventListener('input',markDirty);root.addEventListener('change',markDirty);
function markDirty(event){if(event.target.closest('form[id$="-form"]'))dirty=true;}
await pageModule.bind?.();
// Include asynchronous initial readers launched by older page modules.
while(pending.size){await Promise.allSettled([...pending]);await Promise.resolve();}
if(route.signal.aborted)throw new DOMException('Экран закрыт','AbortError');
if(params.get('saved')&&!page.startsWith('news')&&!page.startsWith('competition'))feedback('Запись сохранена в базе.');
return {root,state,title,active,shellHTML,isDirty:()=>dirty,isSaving:()=>writes>0||saving,clearDirty:()=>{dirty=false;},dispose:()=>{alive=false;pageModule.dispose?.();},feedback};
}
function mount(page,createPage){registerPage(page,createPage,mountPage);}
export {mount};
