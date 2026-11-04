import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="dashboard";
 const setDirty=ctx.setDirty;
 function dashboard(){return stats([['Новостей в базе',state.news.length,'newspaper'],['Черновиков',state.news.filter(n=>n.status==='draft').length,'file-earmark-text'],['Демоматериалов',state.news.filter(n=>n.isDemo).length,'images']])+`<div class="two-col"><div class="panel"><h2>Нуждается в проверке</h2><ul class="list"><li>Проверка материалов<small>Перед публикацией подтвердить факты, даты, источники и права на изображения.</small></li><li>Публичные контакты и документы<small>Ожидают подключения к формам управления и подтверждения источников.</small></li><li>Публикация ещё не подключена<small>Черновики в базе не меняют публичный сайт.</small></li></ul>${btn('Открыть новости','/admin/news')}</div><div class="panel"><h2>Быстрые действия</h2><div class="actions">${btn('Создать новость','/admin/news-edit',true)}${canGym?btn('Обзор зала','/admin/gym'):''}</div></div></div><div class="panel"><h2>Журнал изменений</h2>${state.changes.length?`<ul class="list">${state.changes.slice(-8).reverse().map(c=>`<li>${e(c.text)}<small>${e(c.at)}</small></li>`).join('')}</ul>`:'<p class="muted">Изменений пока нет.</p>'}</div>`;}
 return {render:dashboard,bind(){const form=ctx.form;

}};
}
mount("dashboard",createPage);
