// Initial HTML and no-JavaScript view of the same public snapshots used by filters.
import {e} from './news-render.service.js';
const date=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'Дата уточняется';
const newsCard=n=>`<article class="publication-card"><a class="publication-card__link" href="/news/${e(encodeURIComponent(n.slug))}"><div class="publication-card__visual">${n.cover?`<img src="${e(n.cover)}" alt="${e(n.alt||n.title)}" loading="lazy" width="1000" height="650">`:''}</div><div class="publication-card__body"><div class="publication-meta"><span>${e(n.category)}</span><time datetime="${e(n.publishedAt)}">${e(date(n.publishedAt))}</time></div><h3>${e(n.title)}</h3><p>${e(n.lead)}</p><span class="publication-card__read">Читать материал</span></div></a></article>`;
export function renderNewsCatalog(html,rows,query={}){
 const selected=rows.filter(n=>(!query.year||query.year==='all'||n.publishedAt.startsWith(String(query.year)))&&(!query.category||query.category==='all'||n.category===query.category));
 const featured=!query.year&&!query.category&&selected.length>0,rest=featured?selected.slice(1):selected;
 html=html.replace(/(<section\b[^>]*id="featured-section"[^>]*)(>)/,(_m,a,b)=>(featured?a.replace(/\s+hidden\b/,''):a)+b)
  .replace('<div id="news-featured"></div>',()=>'<div id="news-featured">'+(featured?newsCard(selected[0]):'')+'</div>')
  .replace('<div class="news-grid" id="news-grid"></div>',()=>'<div class="news-grid" id="news-grid">'+rest.map(newsCard).join('')+'</div>')
  .replace('<p id="news-count" role="status"></p>',()=>`<p id="news-count" role="status">Опубликовано: ${selected.length}</p>`)
  .replace(/(<div\b[^>]*id="news-empty") hidden/,(_m,a)=>selected.length?a+' hidden':a)
  .replace('Для просмотра ленты и фильтров включите JavaScript.','Лента доступна без JavaScript. Для фильтрации включите JavaScript.');
 return html;
}
export function renderHomeNews(html,rows){
 const cards=rows.slice(0,3).map(n=>`<article class="news-card"><a class="news-card__image" href="/news/${e(encodeURIComponent(n.slug))}" aria-label="${e(n.title)}">${n.cover?`<img src="${e(n.cover)}" alt="${e(n.alt||n.title)}" width="116" height="82" loading="lazy">`:''}</a><div class="news-card__content"><time class="news-card__date" datetime="${e(n.publishedAt)}">${e(date(n.publishedAt))}</time><h3 class="news-card__title">${e(n.title)}</h3><a class="news-card__link" href="/news/${e(encodeURIComponent(n.slug))}">Читать материал</a></div></article>`).join('')||'<p>Публикаций пока нет.</p>';
 return html.replace(/<div class="home-feed__news-list">[\s\S]*?<\/div>/,()=>'<div class="home-feed__news-list">'+cards+'</div>');
}
export function renderCompetitionCatalog(html,rows,query={}){
 const selected=rows.filter(x=>(!query.year||query.year==='all'||x.startDate.startsWith(String(query.year)))&&(!query.status||query.status==='all'||x.eventStatus===query.status));
 const labels={upcoming:'Предстоящие',completed:'Завершённые'};
 const groups=Object.entries(labels).map(([kind,label])=>{
  const subset=selected.filter(x=>x.eventStatus===kind).sort((a,b)=>kind==='upcoming'?a.startDate.localeCompare(b.startDate):b.startDate.localeCompare(a.startDate));
  if(!subset.length)return '';
  return `<div class="events-group"><h3>${label}</h3><div class="stage-grid">${subset.map(x=>`<a class="event-card" href="/competitions/${e(encodeURIComponent(x.slug))}">${x.image?`<img class="event-card__image" src="${e(x.image)}" alt="${e(x.imageAlt||x.title)}" loading="lazy">`:''}<div class="event-card__body"><span class="event-card__demo">Соревнование Федерации</span><h4>${e(x.title)}</h4><p>${e(date(x.startDate))} — ${e(date(x.endDate))}</p><p>${e(x.location)}</p><span class="stage-status">${kind==='upcoming'?'Предстоящее':'Завершено'}</span><span class="event-card__open">Подробнее о соревновании</span></div></a>`).join('')}</div></div>`;
 }).join('');
 return html.replace('<div id="event-groups"></div>',()=>'<div id="event-groups">'+groups+'</div>').replace('<p id="event-count" role="status"></p>',()=>`<p id="event-count" role="status">Найдено: ${selected.length}</p>`).replace(/(<div\b[^>]*id="event-empty") hidden/,(_m,a)=>selected.length?a+' hidden':a).replace('Для просмотра каталога включите JavaScript.','Каталог доступен без JavaScript. Для фильтрации включите JavaScript.');
}
