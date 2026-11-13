import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="payments";
 const setDirty=ctx.setDirty;
 function payments(){return gymToolbar()+`<div class="panel"><div class="filters"><label>Поиск по ученику или комментарию<input id="search" type="search"></label>${select('Отбор по месяцу','period-filter',[['received','Дата получения денег'],['period','Оплачиваемый месяц'],['all','Все периоды']],'received')}</div><p class="form-note">Дата получения и оплачиваемый период — разные поля. Оплаченный срок — месяц с даты получения денег. Ниже показаны текущие сроки всех занимающихся учеников, независимо от периода отчёта.</p><div id="results"></div></div><div class="panel"><h2>Сроки оплаты учеников</h2><p class="form-note">Жёлтый — за 3 дня до срока и в течение 3 дней ожидания; красный — через 3 дня после срока. Например: оплачено 15 ноября → срок 15 декабря → жёлтый с 12 декабря, красный с 18 декабря.</p><div id="payment-statuses"></div></div>`;}
 return {render:payments,bind(){const form=ctx.form;
function updateResults(){const el=ctx.root.querySelector('#results');
if(!el)return;
const q=(ctx.root.querySelector('#search')?.value||'').trim().toLocaleLowerCase('ru');
const val=n=>ctx.root.querySelector(`[name="${n}"]`)?.value||'';
{const mode=val('period-filter'),items=sortedPayments().filter(p=>(studentName(p.student)+' '+p.comment).toLowerCase().includes(q)&&(mode==='all'||(mode==='period'?p.period===month:p.received.startsWith(month))));el.innerHTML=`<p class="form-note">Найдено: ${items.length}. Сумма в отборе: <strong>${money(items.reduce((s,p)=>s+p.amount,0))}</strong></p>`+table(['Ученик','Сумма','Дата получения','За какой месяц','Действие'],paymentRows(items),'Платежей по этим условиям нет.');}
}
updateResults();
ctx.root.querySelector('#payment-statuses').innerHTML=table(['Ученик','Оплата','Действие'],state.students.filter(s=>s.status==='active').map(s=>[`<a href="/admin/student?id=${encodeURIComponent(s.id)}">${e(s.name)}</a>`,ctx.paymentBadge(s),btn('Внести оплату','/admin/payment?student='+encodeURIComponent(s.id))]),'Занимающихся учеников пока нет.');
ctx.root.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',updateResults));
}};
}
mount("payments",createPage);
