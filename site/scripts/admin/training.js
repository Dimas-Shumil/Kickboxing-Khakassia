import {mount} from './common.js';
function createPage(ctx){
 const {e,api,btn,tabs,field,area,select,feedback,setDirty,now}=ctx;
 const id=ctx.params.get('id');let original=null,groups=[],saving=false;
 const statuses=[['planned','Запланирована'],['held','Проведена'],['cancelled','Отменена']];
 function renderForm(data){
  const holder=document.querySelector('#training-editor');
  const opts=[['','Общая тренировка'],...groups.filter(g=>g.status==='active'||g.id===data.groupId).map(g=>[g.id,g.name])];
  holder.innerHTML=`<div class="panel"><h2>${id?'Карточка тренировки':'Новая тренировка'}</h2><p class="form-note">Отметки доступны только в статусе «Проведена». После появления посещений сменить группу или отменить занятие нельзя, пока отметки не сняты.</p><form id="training-form"><div class="form-grid">${field('Название','title',data.title,'text',true,'maxlength="180"')}${select('Группа','groupId',opts,data.groupId||'')}${field('Дата','heldOn',data.heldOn,'date',true)}${field('Начало','startsAt',data.startsAt,'time',true)}${field('Окончание','endsAt',data.endsAt,'time',true)}${field('Тренер','trainer',data.trainer,'text',false,'maxlength="120"')}${select('Статус','status',statuses,data.status)}${area('Примечание','note',data.note)}</div><div class="form-actions"><button type="submit" class="btn btn--primary">Сохранить тренировку</button>${id&&data.status==='held'?btn('Отметить посещения','/admin/attendance?id='+encodeURIComponent(id)):''}${btn('К тренировкам','/admin/trainings?month='+data.heldOn.slice(0,7))}</div></form></div>`;
  const form=document.querySelector('#training-form');form.querySelector('[name=note]').maxLength=3000;form.addEventListener('input',()=>setDirty(true));form.addEventListener('change',()=>setDirty(true));
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();if(saving)return;
   const payload=Object.fromEntries(new FormData(form));if(id)payload.version=original.version;
   const button=form.querySelector('button[type=submit]');button.disabled=true;saving=true;
   try{const result=await api('/api/admin/gym/sessions'+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify(payload)});
    setDirty(false);location.assign('/admin/training?id='+encodeURIComponent(result.session.id)+'&saved=1');
   }catch(err){feedback(err.message+(err.status===409?' Введённые данные остались в форме.':''),true);}
   finally{button.disabled=false;saving=false;}
  });
 }
 return {render:()=>`<div class="toolbar">${tabs()}${btn('Назад к тренировкам','/admin/trainings')}</div><div id="training-editor"><p class="muted">Загрузка…</p></div>`,bind:async()=>{
  try{const [groupsRes,sessionRes]=await Promise.all([api('/api/admin/gym/groups'),id?api('/api/admin/gym/sessions/'+encodeURIComponent(id)):Promise.resolve(null)]);
   groups=groupsRes.groups;original=sessionRes?.session||null;
   renderForm(original||{title:'',heldOn:now,startsAt:'18:00',endsAt:'19:30',trainer:'',groupId:'',status:'planned',note:''});
  }catch(err){document.querySelector('#training-editor').innerHTML=`<p class="notice notice--error" role="alert">${e(err.message)}</p>${btn('К списку','/admin/trainings')}`;}
 }};
}
mount('training',createPage);
