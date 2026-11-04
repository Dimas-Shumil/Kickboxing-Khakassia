import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="gym";
 const setDirty=ctx.setDirty;
 function gym(){return gymToolbar()+stats([['Действующих учеников',state.students.filter(s=>s.status==='active').length,'people'],['Получено за '+period(month),money(receiptTotal()),'cash-coin'],['Без платежей за период',withoutPayment().length,'person']])+`<div class="two-col"><div class="panel"><h2>Последние оплаты</h2><p class="form-note">Поступления за выбранный месяц, независимо от оплаченного периода.</p>${table(['Ученик','Сумма','Дата платежа','За какой месяц'],paymentRows(sortedPayments().filter(p=>p.received.startsWith(month)).slice(0,8),false),'За этот месяц поступлений нет.')}${btn('Все оплаты','/admin/payments?month='+month)}</div><div class="panel"><h2>Без платежей за период ${countBadge(withoutPayment().length)}</h2><p class="form-note">Нет записи платежа за ${e(period(month))}. Это не расчёт задолженности. Частичные платежи тоже считаются наличием платежа.</p>${withoutPayment().length?`<ul class="list">${withoutPayment().slice(0,8).map(s=>`<li><a href="/admin/student?id=${s.id}">${e(s.name)}</a></li>`).join('')}</ul>`:'<p class="empty">Для каждого действующего ученика есть платёж за период.</p>'}${btn('Открыть список','/admin/students?month='+month+'&unpaid=1')}</div></div>`;}
 return {render:gym,bind(){const form=ctx.form;

}};
}
mount("gym",createPage);
