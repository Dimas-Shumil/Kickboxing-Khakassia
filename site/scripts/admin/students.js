import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="students";
 const setDirty=ctx.setDirty;
 function students(){return gymToolbar()+`<div class="panel"><div class="filters"><label>Поиск ученика<input id="search" type="search" placeholder="ФИО, телефон или группа"></label>${select('Статус','status-filter',[['','Все статусы'],...Object.entries(statuses)],'')}${select('Платежи за '+period(month),'paid-filter',[['','Все ученики'],['none','Без платежей за период']],params.get('unpaid')?'none':'')}</div><div id="results"></div></div>`;}
 return {render:students,bind(){const form=ctx.form;
function updateResults(){const el=document.querySelector('#results');
if(!el)return;
const q=(document.querySelector('#search')?.value||'').trim().toLocaleLowerCase('ru');
const val=n=>document.querySelector(`[name="${n}"]`)?.value||'';
{const items=state.students.filter(s=>(s.name+' '+s.phone+' '+s.group).toLowerCase().includes(q)&&(!val('status-filter')||s.status===val('status-filter'))&&(!val('paid-filter')||withoutPayment().some(x=>x.id===s.id)));el.innerHTML=table(['Ученик','Группа','Стоимость','Статус','Платёж за период'],items.map(s=>[`<a href="/admin/student?id=${s.id}">${e(s.name)}</a>`,e(s.group||'Не указана'),money(s.price),countBadge(statuses[s.status],s.status==='active'?'green':'quiet'),state.payments.some(p=>p.student===s.id&&p.period===month)?'Есть запись':'Нет записи']),'По этим условиям учеников нет.');}
}
updateResults();
document.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',updateResults));
}};
}
mount("students",createPage);
