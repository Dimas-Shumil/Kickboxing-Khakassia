(() => {
 'use strict';
 const data = window.FED_COMPETITIONS || [];
 const year = document.querySelector('#event-year'), status = document.querySelector('#event-status');
 const groups = document.querySelector('#event-groups'), form = document.querySelector('#event-filters');
 const labels = {upcoming:'Предстоящие', completed:'Завершённые'};
 const date = d => new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
 const years = [...new Set(data.map(x=>x.startDate.slice(0,4)))].sort().reverse();
 years.forEach(y=>year.add(new Option(y,y)));
 const query = new URLSearchParams(location.search);
 if(years.includes(query.get('year'))) year.value=query.get('year');
 if(Object.hasOwn(labels,query.get('status'))) status.value=query.get('status');
 function render() {
  const rows = data.filter(x=>(year.value==='all'||x.startDate.startsWith(year.value))&&(status.value==='all'||x.status===status.value));
  groups.replaceChildren();
  Object.entries(labels).forEach(([key,label])=>{
   const subset = rows.filter(x=>x.status===key).sort((a,b)=> key==='upcoming'?a.startDate.localeCompare(b.startDate):b.startDate.localeCompare(a.startDate));
   if(!subset.length)return;
   const group=document.createElement('div'); group.className='events-group';
   const heading=document.createElement('h3'); heading.textContent=label; group.append(heading);
   const grid=document.createElement('div'); grid.className='stage-grid'; group.append(grid);
   subset.forEach(x=>{
    const a=document.createElement('a'); a.className='event-card'; a.href='/competition?id='+encodeURIComponent(x.id);
    const img=document.createElement('img'); img.className='event-card__image'; img.src=x.image; img.alt=x.imageCaption; img.loading='lazy'; a.append(img);
    const body=document.createElement('div'); body.className='event-card__body';
    for (const [tag,cls,text] of [['span','event-card__demo',x.isDemo?'Демонстрационная запись':'Соревнование Федерации'],['h4','',x.title],['p','',date(x.startDate)+' — '+date(x.endDate)+' · '+(x.isDemo?'условные даты':'')],['p','',x.location],['span','stage-status',key==='upcoming'?'Предстоящее':'Завершено'],['span','event-card__open','Подробнее о соревновании']]) { const el=document.createElement(tag); el.className=cls; el.textContent=text; body.append(el); }
    a.append(body);grid.append(a);
   }); groups.append(group);
  });
  document.querySelector('#event-count').textContent='Найдено: '+rows.length+(rows.some(x=>x.isDemo)?' · демонстрационные записи':'');
  document.querySelector('#event-empty').hidden=rows.length!==0;
  const q=new URLSearchParams(); if(year.value!=='all')q.set('year',year.value); if(status.value!=='all')q.set('status',status.value);
  history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);
 }
 form.addEventListener('change',render); form.addEventListener('submit',e=>e.preventDefault());
 form.addEventListener('reset',()=>{year.value=status.value='all';render();});
 document.querySelector('#event-reset').addEventListener('click',()=>{form.reset();year.focus();}); render();
})();
