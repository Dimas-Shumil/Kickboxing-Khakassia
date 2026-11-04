import {mount} from './common.js';
mount('history',ctx=>{
 const {state,e,btn,table,select,newsStatuses}=ctx;
 const labels={story:'История',chronology:'Хронология',competitions:'Соревнования',photos:'Фотоархив',documents:'Документы',people:'Люди'};
 return {render:()=>`<div class="toolbar"><p>Исторические материалы, подтверждённые источники и архивные фотографии. Публикацию подтверждает владелец.</p>${btn('Создать материал','/admin/history-edit',true)}</div><div class="panel"><div class="filters"><label>Поиск по названию или периоду<input type="search" id="history-search"></label>${select('Статус','workflow',[['','Все'],...Object.entries(newsStatuses)],'')}${select('Раздел','section',[['','Все'],...Object.entries(labels)],'')}</div><div id="history-results"></div></div>`,bind(){
  const render=()=>{const q=document.querySelector('#history-search').value.trim().toLocaleLowerCase('ru'),status=document.querySelector('[name=workflow]').value,section=document.querySelector('[name=section]').value;
   const rows=state.history.filter(x=>(x.title+' '+x.period+' '+x.lead).toLocaleLowerCase('ru').includes(q)&&(!status||x.status===status)&&(!section||x.section===section));
   document.querySelector('#history-results').innerHTML=table(['Материал','Раздел / дата','Состояние','Действия'],rows.map(x=>[`<a href="/admin/history-edit?id=${e(x.id)}">${e(x.title)}</a>`,`${e(labels[x.section]||'')} · ${e(x.date||x.period||'Дата не установлена')}`,`${e(newsStatuses[x.status])}${x.hasChanges?'<br>Есть неопубликованные правки':''}`,`<div class="news-row-actions"><a href="/admin/history-preview?id=${e(x.id)}">Предпросмотр</a>${x.hasPublished?`<a href="/history/${e(x.slug)}">На сайте</a>`:''}</div>`]),'Исторических материалов по этим условиям нет.');};
  render();document.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',render));
 }};
});
