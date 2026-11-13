import {mount} from './common.js';
function createPage(ctx){
 const {e,api,state,month,money,date,period,btn,table,gymToolbar,stats}=ctx;
 function renderOverview(summary,sessions){
  const recent=[...sessions].filter(s=>s.status!=='cancelled').sort((a,b)=>(a.heldOn+a.startsAt).localeCompare(b.heldOn+b.startsAt)).slice(-10).reverse();
  ctx.root.querySelector('#gym-data').innerHTML=stats([
   ['Действующие ученики',summary.activeStudents,'people'],
   ['Активные группы',summary.activeGroups,'people'],
   ['Проведено тренировок',summary.held,'activity'],
   ['Присутствий за месяц',summary.present,'calendar3'],
   ['Поступления за '+period(month),money(summary.receivedCents),'cash-coin'],
   ['Доходы всего',money(summary.incomeCents),'cash-coin'],
   ['Расходы',money(summary.expenseCents),'cash-coin'],
   ['Разница',money(summary.balanceCents),'cash-coin']
  ])+`<div class="two-col"><div class="panel"><h2>Тренировки за ${e(period(month))}</h2><p class="form-note">Запланировано: ${summary.scheduled} · проведено: ${summary.held} · отменено: ${summary.cancelled}. Учитываются только сохранённые отметки присутствия.</p>${table(['Дата','Тренировка','Группа','Присутствовали'],recent.map(s=>[date(s.heldOn)+' '+e(s.startsAt),`<a href="/admin/training?id=${encodeURIComponent(s.id)}">${e(s.title)}</a>`,e(s.group?.name||'Общая'),`<a href="/admin/attendance?id=${encodeURIComponent(s.id)}">${s.attendance.filter(a=>a.status==='present').length}</a>`]),'На этот месяц тренировок пока нет.')}${btn('Все тренировки','/admin/trainings?month='+month)}</div><div class="panel"><h2>Последние поступления</h2><p class="form-note">Только фактически полученные деньги за выбранный месяц. Оплачиваемый период хранится отдельно. Сроки следующей оплаты и просрочки показаны в разделе «Оплаты».</p>${table(['Ученик','Сумма','Дата'],[...state.payments].filter(p=>p.received.startsWith(month)).sort((a,b)=>b.received.localeCompare(a.received)).slice(0,8).map(p=>[`<a href="/admin/student?id=${encodeURIComponent(p.student)}">${e(state.students.find(s=>s.id===p.student)?.name||'Ученик')}</a>`,money(p.amount),date(p.received)]),'Поступлений за месяц нет.')}${btn('Все оплаты','/admin/payments?month='+month)}</div></div>`;
 }
 return {render:()=>gymToolbar()+`<div class="gym-shortcuts">${btn('Новая тренировка','/admin/training',true)}${btn('Новая группа','/admin/group')}${btn('Группы','/admin/groups')}</div><div id="gym-data"><p class="muted">Загрузка обзора зала…</p></div>`,bind:async()=>{
  try{const [a,b]=await Promise.all([api('/api/admin/gym/summary?month='+encodeURIComponent(month)),api('/api/admin/gym/sessions?month='+encodeURIComponent(month))]);renderOverview(a.summary,b.sessions);}
  catch(err){ctx.root.querySelector('#gym-data').innerHTML=`<p class="notice notice--error" role="alert">${e(err.message)}. <a href="/admin/gym?month=${month}">Повторить загрузку</a></p>`;}
 }};
}
mount('gym',createPage);
