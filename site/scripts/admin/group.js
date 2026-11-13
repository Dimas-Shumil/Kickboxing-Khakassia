import {mount} from './common.js';
function createPage(ctx){
 const {e,api,btn,tabs,field,area,select,feedback,setDirty,state}=ctx;
 const id=ctx.params.get('id');let original=null,saving=false;
 const renderForm=(group)=>{
  const content=ctx.root.querySelector('#group-editor');if(!content)return;
  content.innerHTML=`<div class="panel"><h2>${id?'Группа':'Новая группа'}</h2><p class="form-note">Группа привязывается к ученику по названию. После создания название не меняется — это защищает уже сохранённые карточки учеников.</p><form id="group-form"><div class="form-grid">${field('Название','name',group.name,'text',true,`${id?'readonly':''} maxlength="120"`)}${field('Тренер','trainer',group.trainer,'text',false,'maxlength="120"')}${select('Статус','status',[['active','Активна'],['archived','В архиве']],group.status)}${area('Описание','description',group.description)}</div><div class="form-actions"><button type="submit" class="btn btn--primary">Сохранить группу</button>${btn('К группам','/admin/groups')}${id?ctx.deleteButton('groups',group):''}</div><p class="form-note">Архивная группа остаётся в истории занятий, но новые тренировки ей не назначаются.</p></form></div>`;
  const form=ctx.root.querySelector('#group-form');form.querySelector('[name=description]').maxLength=3000;form.addEventListener('input',()=>setDirty(true));form.addEventListener('change',()=>setDirty(true));
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();if(saving)return;
   const data=Object.fromEntries(new FormData(form));
   if(id)data.version=original.version;
   const button=form.querySelector('button[type=submit]');button.disabled=true;saving=true;
   try{const result=await api('/api/admin/gym/groups'+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify(data)});
    setDirty(false);ctx.navigate('/admin/group?id='+encodeURIComponent(result.group.id)+'&saved=1');
   }catch(err){feedback(err.message+(err.status===409?' Данные формы сохранены на экране — сверьте с текущей версией перед повтором.':''),true);}
   finally{button.disabled=false;saving=false;}
  });
 };
 return {render:()=>`<div class="toolbar">${tabs()}${btn('Назад к группам','/admin/groups')}</div><div id="group-editor"><p class="muted">Загрузка карточки…</p></div>`,bind:async()=>{
  try{original=id?(await api('/api/admin/gym/groups/'+encodeURIComponent(id))).group:null;
   renderForm(original||{name:'',trainer:'',description:'',status:'active'});
   if(id)ctx.root.querySelector('#group-form').querySelector('[name=name]').setAttribute('readonly','');
  }catch(err){ctx.root.querySelector('#group-editor').innerHTML=`<p class="notice notice--error" role="alert">${e(err.message)}</p>${btn('К списку','/admin/groups')}`;}
 }};
}
mount('group',createPage);
