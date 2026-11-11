import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="payments";
 const setDirty=ctx.setDirty;
 function payments(){return gymToolbar()+`<div class="panel"><div class="filters"><label>Поиск по ученику или комментарию<input id="search" type="search"></label>${select('Отбор по месяцу','period-filter',[['received','Дата получения денег'],['period','Оплачиваемый месяц'],['all','Все периоды']],'received')}</div><p class="form-note">Дата получения и оплачиваемый период — разные поля. Несколько платежей за месяц допустимы.</p><div id="results"></div></div>`;}
 return {render:payments,bind(){const form=ctx.form;
function updateResults(){const el=ctx.root.querySelector('#results');
if(!el)return;
const q=(ctx.root.querySelector('#search')?.value||'').trim().toLocaleLowerCase('ru');
const val=n=>ctx.root.querySelector(`[name="${n}"]`)?.value||'';
{const mode=val('period-filter'),items=sortedPayments().filter(p=>(studentName(p.student)+' '+p.comment).toLowerCase().includes(q)&&(mode==='all'||(mode==='period'?p.period===month:p.received.startsWith(month))));el.innerHTML=`<p class="form-note">Найдено: ${items.length}. Сумма в отборе: <strong>${money(items.reduce((s,p)=>s+p.amount,0))}</strong></p>`+table(['Ученик','Сумма','Дата получения','За какой месяц','Действие'],paymentRows(items),'Платежей по этим условиям нет.');}
}
updateResults();
ctx.root.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',updateResults));
}};
}
mount("payments",createPage);
