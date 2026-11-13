import {mount} from './common.js';
function createPage(ctx){
 const {e,state,month,period,money,table,countBadge,statuses,select,gymToolbar,btn}=ctx;
 function students(){return gymToolbar()+`<div class="panel"><div class="filters"><label>Поиск ученика<input id="search" type="search" placeholder="ФИО, телефон или группа"></label>${select('Статус','status-filter',[['','Все статусы'],...Object.entries(statuses)],'')}${select('Группа','group-filter',[['','Все группы'],...[...new Set(state.students.map(s=>s.group).filter(Boolean))].sort().map(g=>[g,g])],'')}</div><div id="results"></div><p class="form-note">Список приватный, доступен владельцу и тренеру своего зала. Срок оплаты считается от последнего поступления: один календарный месяц.</p>${btn('Управление группами','/admin/groups')}</div>`;}
 function bind(){
  function update(){const q=(ctx.root.querySelector('#search')?.value||'').trim().toLocaleLowerCase('ru');const status=ctx.root.querySelector('[name="status-filter"]').value;const group=ctx.root.querySelector('[name="group-filter"]').value;
   const rows=state.students.filter(s=>(s.name+' '+s.phone+' '+s.group).toLocaleLowerCase('ru').includes(q)&&(!status||s.status===status)&&(!group||s.group===group));
   ctx.root.querySelector('#results').innerHTML=table(['Ученик','Группа','Тренер','Стоимость','Статус','Оплата','Действие'],rows.map(s=>[
    `<a href="/admin/student?id=${encodeURIComponent(s.id)}">${e(s.name)}</a>`,e(s.group||'Не указана'),e(s.trainer||'Не указан'),money(s.price),countBadge(statuses[s.status],s.status==='active'?'green':'quiet'),ctx.paymentBadge(s),ctx.deleteButton('students',s)
   ]),'По этим условиям учеников нет.');
  }
  update();ctx.root.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',update));
 }
 return {render:students,bind};
}
mount('students',createPage);
