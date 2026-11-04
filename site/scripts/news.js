(() => {
 'use strict';
 const V=window.FED_NEWS_VIEW; if(!V)return;
 const data=V.sorted();
 const home=document.querySelector('.home-feed__news-list');
 if(home) {
  home.innerHTML=data.slice(0,3).map(x=>`<article class="news-card"><a class="news-card__image" href="${V.href(x)}" aria-label="${V.escape(x.title)}">${x.cover?`<img src="${V.url(x.cover)}" alt="${V.escape(x.alt)}" width="116" height="82" loading="lazy">`:``}</a><div class="news-card__content"><time class="news-card__date" datetime="${V.escape(x.publishedAt)}">${V.date(x.publishedAt)}${x.isDemo?' · демо':''}</time><h3 class="news-card__title">${V.escape(x.title)}</h3><a class="news-card__link" href="${V.href(x)}">Читать материал</a></div></article>`).join('')||'<p>Публикаций пока нет.</p>';
 }
 const form=document.querySelector('#news-filters');if(!form)return;
 const year=document.querySelector('#news-year'),category=document.querySelector('#news-category'),grid=document.querySelector('#news-grid'),more=document.querySelector('#news-more');
 const years=[...new Set(data.map(x=>x.publishedAt.slice(0,4)))].sort().reverse();
 const categories=[...new Set(data.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,'ru'));
 years.forEach(y=>year.add(new Option(y,y)));categories.forEach(c=>category.add(new Option(c,c)));
 const params=new URLSearchParams(location.search);
 if(years.includes(params.get('year')))year.value=params.get('year');
 if(categories.includes(params.get('category')))category.value=params.get('category');
 let limit=3;const batch=3;
 function render(append=false) {
  const rows=data.filter(x=>(year.value==='all'||x.publishedAt.startsWith(year.value))&&(category.value==='all'||x.category===category.value));
  const featured=document.querySelector('#news-featured'),featuredSection=document.querySelector('#featured-section');
  const showFeatured=year.value==='all'&&category.value==='all'&&rows.length>0;
  featuredSection.hidden=!showFeatured;
  featured.innerHTML=showFeatured?V.card(rows[0]):'';
  const rest=showFeatured?rows.slice(1):rows;
  grid.innerHTML=rest.slice(0,limit).map(V.card).join('');
  more.hidden=rest.length<=limit;
  document.querySelector('#news-empty').hidden=rows.length!==0;
  const shown=Math.min(limit,rest.length)+(showFeatured?1:0);
  document.querySelector('#news-count').textContent=`Показано ${shown} из ${rows.length}${rows.some(x=>x.isDemo)?' · демонстрационные материалы':''}`;
  const q=new URLSearchParams();if(year.value!=='all')q.set('year',year.value);if(category.value!=='all')q.set('category',category.value);
  history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);
  if(append) { const firstNew=grid.children[limit-batch]?.querySelector('a');firstNew?.focus(); }
 }
 form.addEventListener('change',()=>{limit=batch;render();});form.addEventListener('submit',e=>e.preventDefault());
 form.addEventListener('reset',()=>{year.value=category.value='all';limit=batch;render();});
 document.querySelector('#news-reset').addEventListener('click',()=>{form.reset();year.focus();});
 more.addEventListener('click',()=>{limit+=batch;render(true);});render();
})();
