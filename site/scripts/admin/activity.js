import {mount} from './common.js';

function createPage(ctx){
 const {e,api,params,month,table,btn,canGym}=ctx;
 const contentScopes=[['news','Новости'],['people','Люди'],['competitions','Соревнования'],['history','История'],['site-page','Страницы'],['site-document','Документы'],['site-media','Медиатека']];
 const privateScopes=[['students','Ученики'],['payments','Оплаты'],['gym-groups','Группы'],['gym-sessions','Тренировки'],['gym-attendance','Посещаемость'],['gym-finances','Доходы и расходы']];
 const actions=[['create','Создание'],['save','Сохранение'],['update','Изменение'],['publish','Публикация'],['unpublish','Снятие публикации'],['archive','Архив'],['restore','Восстановление'],['delete','Удаление'],['delete-file','Удаление файла'],['delete-photo','Удаление фото']];
 const scopes=[...contentScopes,...(canGym?privateScopes:[])];
 const scope=scopes.some(([k])=>k===params.get('scope'))?params.get('scope'):'all';
 const action=actions.some(([k])=>k===params.get('action'))?params.get('action'):'all';
 const page=/^(?:0|[1-9]\d{0,2})$/.test(params.get('page')||'0')?Math.min(100,Number(params.get('page')||0)):0;
 const options=(values,selected)=>values.map(([value,label])=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(label)}</option>`).join('');
 const query=n=>new URLSearchParams({month,scope,action,page:String(n)}).toString();
 function display(a){
  const results=ctx.root.querySelector('#activity-results');
  if(!a.entries.length){results.innerHTML=`<div class="panel"><p class="muted">По выбранным фильтрам событий нет.</p>${a.page?btn('К первой странице','/admin/activity?'+query(0)):''}</div>`;return;}
  results.innerHTML=`<p class="form-note">Записей: ${a.total}. Показаны события журнала; названия и данные, не зафиксированные в журнале, не восстанавливаются задним числом. ${a.limited?'Доступны первые 2020 событий; уточните месяц или фильтр для остальных.':''}</p><div class="panel">${table(['Дата (Хакасия)','Раздел','Действие','Кто выполнил','Запись'],a.entries.map(x=>[
   e(new Date(x.at).toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk',dateStyle:'short',timeStyle:'short'})),e(x.scopeLabel),e(x.actionLabel),e(x.actor),x.href?`<a href="${e(x.href)}">Открыть запись</a>`:'<span class="muted">Недоступна</span>'
  ]))}</div><nav class="analytics-pagination" aria-label="Страницы журнала">${a.page>0?btn('Назад','/admin/activity?'+query(a.page-1)):''}<span>Страница ${a.page+1} из ${a.pages}</span>${a.page+1<a.pages?btn('Далее','/admin/activity?'+query(a.page+1)):''}</nav>`;
 }
 return {render:()=>`<div class="panel analytics-filters"><h2>Журнал изменений</h2><p class="form-note">Здесь только зарегистрированные действия пользователей. Содержимое старых версий, IP-адреса и статистика посещений сайта не собираются. Ученики и финансы доступны владельцу и тренеру назначенного зала.</p><form method="get" action="/admin/activity" class="filters" id="activity-filters"><label>Месяц<input type="month" name="month" value="${e(month)}" min="1900-01" max="2100-12" required></label><label>Раздел<select name="scope">${options([['all','Все разделы'],...scopes],scope)}</select></label><label>Действие<select name="action">${options([['all','Все действия'],...actions],action)}</select></label><button class="btn btn--primary" type="submit">Применить</button>${btn('Сбросить','/admin/activity?month='+month)}</form></div><div id="activity-results" aria-live="polite"><p class="panel">Загрузка журнала…</p></div>`,bind:async()=>{
  try{const response=await api('/api/admin/analytics/activity?'+query(page));display(response.activity);}
  catch(err){ctx.root.querySelector('#activity-results').innerHTML=`<div class="notice notice--error" role="alert">${e(err.message)}. ${btn('Повторить','/admin/activity?'+query(page))}</div>`;}
 }};
}
mount('activity',createPage);
