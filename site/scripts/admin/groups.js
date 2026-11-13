import {mount} from './common.js';
function createPage(ctx){
 const {e,api,state,table,btn,stats,tabs,month}=ctx;
 let groups=[];
 function draw(){
  const q=(ctx.root.querySelector('#group-search')?.value||'').trim().toLocaleLowerCase('ru');
  const status=ctx.root.querySelector('#group-status')?.value||'';
  const items=groups.filter(g=>(g.name+' '+g.trainer).toLocaleLowerCase('ru').includes(q)&&(!status||g.status===status));
  ctx.root.querySelector('#group-results').innerHTML=table(['Группа','Тренер','Ученики','Статус','Действие'],items.map(g=>[
   e(g.name),e(g.trainer||'Не указан'),String(state.students.filter(s=>s.group===g.name).length),g.status==='active'?'Активна':'В архиве',`<div class="row-actions"><a href="/admin/group?id=${encodeURIComponent(g.id)}">Изменить</a>${ctx.deleteButton('groups',g)}</div>`
  ]),'Групп с такими параметрами нет.');
 }
 return {render:()=>`<div class="toolbar">${tabs()}<div class="actions">${btn('Новая группа','/admin/group',true)}${btn('Тренировки','/admin/trainings?month='+month)}</div></div><div class="panel"><p class="form-note">Справочник одного зала. Состав группы — ученики, у которых в карточке указано это же название. Название существующей группы неизменно.</p><div class="filters"><label>Поиск<input type="search" id="group-search" placeholder="Группа или тренер"></label><label>Статус<select id="group-status"><option value="">Все группы</option><option value="active">Активные</option><option value="archived">Архив</option></select></label></div><div id="group-results"><p class="muted">Загрузка групп…</p></div></div>`,bind:async()=>{
  try {groups=(await api('/api/admin/gym/groups')).groups;draw();ctx.root.querySelector('#group-search').addEventListener('input',draw);ctx.root.querySelector('#group-status').addEventListener('change',draw);}
  catch(error){ctx.root.querySelector('#group-results').innerHTML=`<p class="notice notice--error" role="alert">${e(error.message)}. <a href="/admin/groups">Повторить</a></p>`;}
 }};
}
mount('groups',createPage);
