import {mount} from './common.js';
function createPage(ctx){
 const {e,api,btn,tabs,table,feedback,setDirty,state,date}=ctx;
 const id=ctx.params.get('id');let current=null,saving=false;
 const statuses=[['','Не отмечено'],['present','Присутствовал'],['absent','Отсутствовал'],['excused','Уважительная причина']];
 function render(){
  const holder=document.querySelector('#attendance-editor');
  const recorded=new Map(current.attendance.map(r=>[r.studentId,r]));
  const students=state.students.filter(s=>recorded.has(s.id)||((!current.group||s.group===current.group.name)&&s.status==='active'));
  if(students.length>250){holder.innerHTML='<p class="notice notice--error">На этой тренировке более 250 учеников. Отметки одним действием недоступны — требуется разделение на занятия.</p>';return;}
  holder.innerHTML=`<div class="panel"><h2>${e(current.title)} · ${e(date(current.heldOn))}</h2><p class="form-note">${e(current.startsAt)}–${e(current.endsAt)} · ${e(current.group?.name||'Общая тренировка')} · ${e(current.status==='held'?'Проведена':'Пока не проведена')}</p><p class="form-note">Пустая отметка не считается отсутствием. Записи посещаемости закрыты для посетителей и редакторов.</p>${current.status!=='held'?`<p class="notice notice--error">Сначала укажите в карточке тренировки статус «Проведена».</p>${btn('Открыть тренировку','/admin/training?id='+encodeURIComponent(id))}`:''}<form id="attendance-form"><div class="table-wrap"><table class="responsive-table"><thead><tr><th>Ученик</th><th>Отметка</th><th>Комментарий</th></tr></thead><tbody>${students.length?students.map(s=>{
   const a=recorded.get(s.id)||{status:'',note:''};return `<tr data-student-id="${e(s.id)}"><td data-label="Ученик"><a href="/admin/student?id=${encodeURIComponent(s.id)}">${e(s.name)}</a></td><td data-label="Отметка"><select name="status" aria-label="Отметка: ${e(s.name)}">${statuses.map(([v,t])=>`<option value="${v}" ${a.status===v?'selected':''}>${t}</option>`).join('')}</select></td><td data-label="Комментарий"><input name="note" maxlength="500" value="${e(a.note)}" aria-label="Комментарий: ${e(s.name)}"></td></tr>`;
  }).join(''):`<tr><td colspan="3" class="empty">Нет действующих учеников этой группы. Добавьте ученика и укажите группу в его карточке.</td></tr>`}</tbody></table></div><div class="form-actions"><button type="submit" class="btn btn--primary" ${current.status!=='held'?'disabled':''}>Сохранить посещения</button>${btn('К тренировке','/admin/training?id='+encodeURIComponent(id))}</div></form></div>`;
  const form=document.querySelector('#attendance-form');form.addEventListener('input',()=>setDirty(true));form.addEventListener('change',()=>setDirty(true));
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();if(saving)return;
   const marks=[...form.querySelectorAll('tr[data-student-id]')].map(row=>({studentId:row.dataset.studentId,status:row.querySelector('[name=status]').value,note:row.querySelector('[name=note]').value}));
   const button=form.querySelector('button[type=submit]');button.disabled=true;saving=true;
   try{const result=await api('/api/admin/gym/sessions/'+encodeURIComponent(id)+'/attendance',{method:'PATCH',body:JSON.stringify({version:current.version,marks})});
    current=result.session;setDirty(false);feedback('Посещаемость сохранена. Версия занятия обновлена.');
   }catch(err){feedback(err.message+(err.status===409?' Отметки остались в форме. Не перезагружайте страницу до сверки изменений.':''),true);}
   finally{button.disabled=false;saving=false;}
  });
 }
 return {render:()=>`<div class="toolbar">${tabs()}${btn('К тренировкам','/admin/trainings')}</div><div id="attendance-editor"><p class="muted">Загрузка посещений…</p></div>`,bind:async()=>{
  try{current=(await api('/api/admin/gym/sessions/'+encodeURIComponent(id))).session;render();}
  catch(err){document.querySelector('#attendance-editor').innerHTML=`<p class="notice notice--error" role="alert">${e(err.message)}</p>${btn('К тренировкам','/admin/trainings')}`;}
 }};
}
mount('attendance',createPage);
