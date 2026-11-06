import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canGym,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="student";
 const setDirty=ctx.setDirty;
 function student(){const id=params.get('id'),s=id?state.students.find(s=>s.id===id):{status:'active',start:now};if(!s)return notFound();return `<div class="toolbar">${tabs()}${btn('К списку учеников','/admin/students')}</div><div class="two-col"><div class="panel"><h2>${id?'Карточка ученика':'Новый ученик'}</h2><p class="form-note">Внутренняя запись · не публикуется. * Обязательные поля.</p>${formMessage}<form id="student-form"><div class="form-grid">${field('ФИО','name',s.name,'text',true,'maxlength="180"')}${field('Телефон','phone',s.phone,'tel',false,'maxlength="50"')}${field('Контакт родителя','parent',s.parent,'text',false,'maxlength="180"')}${field('Начало занятий','start',s.start,'date',true)}${field('Группа (если используется)','group',s.group,'text',false,'maxlength="120"')}${field('Тренер (если используется)','trainer',s.trainer,'text',false,'maxlength="120"')}${field('Стоимость занятий, ₽','price',(s.price||0)/100,'number',true,'min="0" max="1000000" step="0.01"')}${select('Статус','status',Object.entries(statuses),s.status)}${area('Примечание','note',s.note)}</div>${saveActions('/admin/students')}</form></div><div class="panel"><h2>История оплат</h2>${id?table(['Сумма','Дата','Период'],sortedPayments().filter(p=>p.student===id).map(p=>[money(p.amount),date(p.received),e(period(p.period))])):'<p class="muted">Сначала сохраните карточку ученика.</p>'}${id?btn('Внести оплату','/admin/payment?student='+encodeURIComponent(id),true):''}<p class="form-note">Изменение стоимости не меняет суммы ранее записанных платежей. Приватные ученики не связаны автоматически с публичными профилями Федерации.</p></div></div>${id?'<div class="panel"><h2>Посещения ученика</h2><div id="student-attendance"><p class="muted">Загрузка…</p></div></div>':''}`;}
 return {render:student,bind(){const form=ctx.form;
async function studentSubmit(ev){ev.preventDefault();const d=readForm();if(!d.name.trim()||!Number.isSafeInteger(cents(d.price))||!statuses[d.status])return feedback('Проверьте ФИО, стоимость и статус.',true);const next=clone();let id=params.get('id');const s={...d,name:d.name.trim(),price:cents(d.price),id:id||'s-'+uid()};if(id){const i=next.students.findIndex(s=>s.id===id);next.students[i]=s;}else next.students.push(s);addChange(next,'Карточка ученика: '+s.name);const saved=await persist(next);if(saved){history.replaceState(null,'','/admin/student?id='+saved.id);form.querySelector('button[type="submit"]').disabled=true;setTimeout(()=>location.replace('/admin/student?id='+saved.id+'&saved=1'),150);}}
document.querySelector('#student-form')?.addEventListener('submit',studentSubmit);
(async()=>{
 const id=params.get('id');
 try{
  const response=await api('/api/admin/gym/groups');const groups=response.groups;
  const input=document.querySelector('#student-form input[name=group]');
  if(input&&groups.length){
   const current=input.value;
   const options=[['','Без группы'],...groups.filter(g=>g.status==='active'||g.name===current).map(g=>[g.name,g.name])];
   if(current&&!options.some(x=>x[0]===current))options.push([current,current+' (прежняя запись)']);
   input.outerHTML=`<select name="group" aria-label="Группа">${options.map(([value,label])=>`<option value="${e(value)}" ${value===current?'selected':''}>${e(label)}</option>`).join('')}</select>`;
  }
 }catch(err){feedback('Справочник групп недоступен. Поле группы остаётся текстовым. '+err.message,true);}
 if(!id)return;
 try{
  const result=await api('/api/admin/gym/students/'+encodeURIComponent(id)+'/attendance');
  const rows=result.records||[];
  const box=document.querySelector('#student-attendance');if(!box)return;
  box.innerHTML=table(['Дата','Занятие','Отметка'],rows.map(a=>[date(a.session.heldOn),`<a href="/admin/attendance?id=${encodeURIComponent(a.session.id)}">${e(a.session.title)}</a>`,e({present:'Присутствовал',absent:'Отсутствовал',excused:'Уважительная причина'}[a.status]||a.status)]),'Отметок посещаемости пока нет.');
 }catch(err){const box=document.querySelector('#student-attendance');if(box)box.innerHTML=`<p class="notice notice--error" role="alert">${e(err.message)}</p>`;}
})();
}};
}
mount("student",createPage);
