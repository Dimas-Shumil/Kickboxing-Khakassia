import {mount} from './common.js';
function createPage(ctx){
 const {e,api,month,table,btn,tabs,monthInput,stats,date,state}=ctx;
 let sessions=[],groups=[];
 const statusName={planned:'Запланирована',held:'Проведена',cancelled:'Отменена'};
 function draw(){
  const q=(ctx.root.querySelector('#training-search')?.value||'').trim().toLocaleLowerCase('ru');
  const status=ctx.root.querySelector('#training-status')?.value||'';
  const groupId=ctx.root.querySelector('#training-group')?.value||'';
  const items=sessions.filter(s=>(s.title+' '+s.trainer+' '+(s.group?.name||'')).toLocaleLowerCase('ru').includes(q)&&(!status||s.status===status)&&(!groupId||s.groupId===groupId));
  ctx.root.querySelector('#training-results').innerHTML=table(['Дата и время','Тренировка','Группа','Статус','Присутствовали','Действие'],items.map(s=>[
   `${date(s.heldOn)}<small class="gym-subline">${e(s.startsAt)}–${e(s.endsAt)}</small>`,
   `<a href="/admin/training?id=${encodeURIComponent(s.id)}">${e(s.title)}</a><small class="gym-subline">${e(s.trainer)}</small>`,
   e(s.group?.name||'Общая'),e(statusName[s.status]||s.status),
   String(s.attendance.filter(a=>a.status==='present').length),
   s.status==='held'?`<a href="/admin/attendance?id=${encodeURIComponent(s.id)}">Посещения</a>`:`<a href="/admin/training?id=${encodeURIComponent(s.id)}">Изменить</a>`
  ]),'В выбранном месяце тренировок нет.');
 }
 return {render:()=>`<div class="toolbar">${tabs()}<div class="actions">${monthInput()}${btn('Добавить тренировку','/admin/training',true)}</div></div><div class="panel"><p class="form-note">Тренировки и посещения одного зала. Данные не публикуются на сайте.</p><div class="filters"><label>Поиск<input id="training-search" type="search" placeholder="Название, тренер"></label><label>Группа<select id="training-group"><option value="">Все группы</option></select></label><label>Статус<select id="training-status"><option value="">Все статусы</option>${Object.entries(statusName).map(([key,value])=>`<option value="${key}">${value}</option>`).join('')}</select></label></div><div id="training-results"><p class="muted">Загрузка тренировок…</p></div></div>`,bind:async()=>{
  try{const [sessionsRes,groupsRes]=await Promise.all([api('/api/admin/gym/sessions?month='+encodeURIComponent(month)),api('/api/admin/gym/groups')]);sessions=sessionsRes.sessions;groups=groupsRes.groups;
   ctx.root.querySelector('#training-group').insertAdjacentHTML('beforeend',groups.map(g=>`<option value="${e(g.id)}">${e(g.name)}</option>`).join(''));
   for(const id of ['training-search','training-group','training-status'])ctx.root.querySelector('#'+id).addEventListener('input',draw);
   draw();
  }catch(err){ctx.root.querySelector('#training-results').innerHTML=`<p class="notice notice--error" role="alert">${e(err.message)}. <a href="/admin/trainings?month=${month}">Повторить</a></p>`;}
 }};
}
mount('trainings',createPage);
