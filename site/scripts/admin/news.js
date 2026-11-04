import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="news";
 const setDirty=ctx.setDirty;
 function news(){return `<div class="toolbar"><p class="muted">Рабочие и опубликованные материалы</p>${btn('Создать новость','/admin/news-edit',true,'plus-lg')}</div><div class="panel"><div class="filters"><label>Поиск новости<input type="search" id="search"></label>${select('Состояние','status-filter',[['','Все'],['draft','Черновики'],['published','Опубликовано'],['archived','Архив']],'')}${select('Категория','category-filter',[['','Все категории'],['Соревнования','Соревнования'],['История','История'],['Федерация','Федерация']],'')}</div><div id="results"></div></div>`;}
 return {render:news,bind(){const form=ctx.form;
function updateResults(){const el=document.querySelector('#results');
if(!el)return;
const q=(document.querySelector('#search')?.value||'').trim().toLocaleLowerCase('ru');
const val=n=>document.querySelector(`[name="${n}"]`)?.value||'';
{const items=state.news.filter(n=>n.title.toLowerCase().includes(q)&&(!val('status-filter')||n.status===val('status-filter'))&&(!val('category-filter')||n.category===val('category-filter')));el.innerHTML=table(['Заголовок','Категория','Дата','Состояние','Действия'],items.map(n=>[`<a href="/admin/news-edit?id=${e(n.id)}">${e(n.title)}</a><br><span class="small muted">${n.hasPublished?(n.hasChanges?'Есть неопубликованные правки':'Версия на сайте'): 'Закрытая версия'}</span>`,e(n.category),date(n.publishedAt),countBadge(newsStatuses[n.status]),`<div class="news-row-actions"><a href="/admin/news-preview?id=${e(n.id)}">Предпросмотр</a>${n.hasPublished?`<a href="/news/${e(n.slug)}">На сайте</a>`:``}</div>`]),'Материалов по этим условиям нет.');}
}
updateResults();
document.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',updateResults));
}};
}
mount("news",createPage);
