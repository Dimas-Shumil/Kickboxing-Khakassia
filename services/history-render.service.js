import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {e} from './news-render.service.js';
import {personHref} from './people-render.service.js';
const titles={story:'История',chronology:'Хронология',competitions:'Соревнования',photos:'Фотоархив',documents:'Документы',people:'Люди'};
const escLines=s=>e(s||'').replace(/\n/g,'<br>');
const prettyDate=p=>p.dateType==='exact'&&p.date?new Date(p.date+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):p.dateType==='period'?p.period:'Дата не установлена';
const year=p=>p.dateType==='exact'?p.date.slice(0,4):'undated';
const href=p=>'/history/'+encodeURIComponent(p.slug);
const empty=text=>`<p class="history-empty">${e(text)}</p>`;
const image=(src,alt='')=>src?`<img src="${e(src)}" alt="${e(alt)}" loading="lazy">`:'';
const caption=p=>[p.caption,p.credit].filter(Boolean).join(' · ');
export async function historyConnections(db,p){
 const [people,competitions]=await Promise.all([db.person.findMany({where:{id:{in:p.people},status:'published',publishedPayload:{not:null}}}),db.competition.findMany({where:{id:{in:p.competitions},status:'published',publishedPayload:{not:null}}})]);
 return {people:people.map(x=>({...JSON.parse(x.publishedPayload),id:x.id,slug:x.slug})),competitions:competitions.map(x=>({...JSON.parse(x.publishedPayload),id:x.id,slug:x.slug}))};
}
function links(p,relations){
 const persons=relations.people.map(x=>`<a href="${e(personHref(x))}">${e(x.name)}</a>`).join('');
 const competitions=relations.competitions.map(x=>`<a href="/competitions/${e(x.slug)}">${e(x.title)}</a>`).join('');
 const sources=p.sources.map(s=>`<li>${s.url?`<a href="${e(s.url)}" rel="noopener noreferrer nofollow" target="_blank">${e(s.title)}</a>`:e(s.title)}${s.note?`<span> — ${e(s.note)}</span>`:''}</li>`).join('');
 return {persons,competitions,sources};
}
function galleryButton(g,section){return `<button class="history-photo" type="button" data-media-type="image" data-gallery-category="${e(section)}" data-full="${e(g.src)}" data-caption="${e(caption(g))}" aria-label="Открыть фотографию: ${e(g.caption||g.alt||'Архив')}">${image(g.src,g.alt||g.caption)}<span class="history-photo__type">${e(titles[section])}</span><span class="history-photo__caption">${e(g.caption||'Архивный снимок')}</span></button>`;}
export async function renderHistoryIndex(config,rows){
 let html=await readFile(path.join(config.ROOT,'public/history.html'),'utf8');
 const groups=Object.fromEntries(Object.keys(titles).map(k=>[k,rows.filter(x=>x.section===k)]));
 const story=groups.story.map(x=>`<article class="history-story">${x.cover?`<figure>${image(x.cover,x.coverAlt||x.title)}<figcaption>${e([x.coverCaption,x.coverCredit].filter(Boolean).join(' · '))}</figcaption></figure>`:'<figure class="history-story__placeholder">Исторический материал</figure>'}<div class="history-story__text"><span class="history-eyebrow">${e(prettyDate(x))}</span><h3>${e(x.title)}</h3><p>${escLines(x.lead)}</p>${x.author?`<p>Автор: ${e(x.author)}</p>`:''}<a class="history-text-link" href="${e(href(x))}">Читать материал</a></div></article>`).join('')||empty('Проверенных исторических материалов пока нет.');
 const tabs=groups.chronology.map((x,i)=>`<button type="button" role="tab" id="era-tab-${i}" aria-controls="era-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}"><span>${String(i+1).padStart(2,'0')}</span>${e(x.title)}<small>${e(prettyDate(x))}</small></button>`).join('');
 const eras=groups.chronology.map((x,i)=>`<div class="history-era" id="era-${i}" role="tabpanel" aria-labelledby="era-tab-${i}" tabindex="0" ${i?'hidden':''}>${image(x.cover,x.coverAlt||x.title)}<div><span class="history-tag">${e(prettyDate(x))}</span><h3>${e(x.title)}</h3><p>${escLines(x.lead)}</p><p class="history-era__source">${e(x.coverCredit||x.author)}</p><a class="history-text-link" href="${e(href(x))}">Подробнее</a></div></div>`).join('');
 const chronology=groups.chronology.length?`<div class="history-timeline" role="tablist" aria-label="Материалы хронологии">${tabs}</div>${eras}`:empty('Хронология пока не опубликована.');
 const events=groups.competitions.map(x=>`<article class="history-event" data-event data-year="${year(x)}" data-kind="${x.gallery.length?'photo':'result'}"><div class="history-event__image">${image(x.cover,x.coverAlt||x.title)}<span>${e(prettyDate(x))}</span></div><div class="history-event__body"><span class="history-eyebrow">${e(prettyDate(x))}</span><h3>${e(x.title)}</h3><p>${escLines(x.lead)}</p><a class="history-text-link" href="${e(href(x))}">Открыть материал</a></div></article>`).join('');
 const years=[...new Set(groups.competitions.map(year).filter(y=>y!=='undated'))].sort().reverse();
 const competitionHTML=`<div class="history-filters"><label>Год<select id="archive-year"><option value="all">Все годы</option>${years.map(y=>`<option value="${y}">${y}</option>`).join('')}<option value="undated">Дата не установлена / период</option></select></label><label>Материалы<select id="archive-kind"><option value="all">Все материалы</option><option value="photo">С фотографиями</option><option value="result">Без галереи</option></select></label><button class="history-reset" type="button" id="archive-reset">Сбросить фильтры</button><p id="archive-count" role="status"></p></div><div class="history-events">${events}</div><p id="archive-empty" class="history-empty" ${events?'hidden':''}>По выбранным фильтрам материалов нет.</p>`;
 const pictures=rows.flatMap(p=>{const items=p.gallery.map(g=>({g,section:p.section}));if(p.section==='photos'&&p.cover&&!p.gallery.some(g=>g.src===p.cover))items.unshift({section:p.section,g:{src:p.cover,alt:p.coverAlt,caption:p.coverCaption||p.title,credit:p.coverCredit}});return items;});
 const usedSections=[...new Set(pictures.map(x=>x.section))];
 const photoHTML=`<div class="history-photo-filters" role="group" aria-label="Разделы фотоархива"><button type="button" data-gallery-filter="all" aria-pressed="true" class="is-active">Все фотографии</button>${usedSections.map(k=>`<button type="button" data-gallery-filter="${k}" aria-pressed="false">${e(titles[k])}</button>`).join('')}</div><div class="history-gallery" data-gallery-grid>${pictures.map(({g,section})=>galleryButton(g,section)).join('')}</div><p data-gallery-empty class="history-empty" ${pictures.length?'hidden':''}>Фотоархив пока не наполнен.</p><div class="profile-gallery__more-wrap history-more"><button class="history-button history-button--outline" type="button" data-gallery-more>Показать ещё</button></div>`;
 const documents=groups.documents.map((x,i)=>`<article class="history-document"><span class="history-document__icon">${String(i+1).padStart(2,'0')} / ≡</span><h3>${e(x.title)}</h3><p>${escLines(x.lead)}</p><a class="history-text-link" href="${e(href(x))}">Источники материала</a></article>`).join('')||empty('Документальные свидетельства пока не опубликованы.');
 const people=groups.people.map(x=>`<article class="history-story">${x.cover?`<figure>${image(x.cover,x.coverAlt||x.title)}<figcaption>${e(x.coverCaption)}</figcaption></figure>`:''}<div class="history-story__text"><span class="history-eyebrow">${e(prettyDate(x))}</span><h3>${e(x.title)}</h3><p>${escLines(x.lead)}</p><a class="history-text-link" href="${e(href(x))}">Читать историю</a></div></article>`).join('')||empty('Истории людей пока не опубликованы.');
 const replacements={STORY:story,CHRONOLOGY:chronology,COMPETITIONS:competitionHTML,PHOTOS:photoHTML,DOCUMENTS:`<div class="history-documents">${documents}</div>`,PEOPLE:people};
 for(const [k,v]of Object.entries(replacements))html=html.replace('{{HISTORY_'+k+'}}',()=>v);
 return html;
}
export async function renderHistoryDetail(config,p,relations,preview=false){
 let html=await readFile(path.join(config.ROOT,'views/history/detail.html'),'utf8');
 const l=links(p,relations),cover=p.cover?`<figure class="history-item-cover">${image(p.cover,p.coverAlt||p.title)}<figcaption>${e([p.coverCaption,p.coverCredit].filter(Boolean).join(' · '))}</figcaption></figure>`:'';
 const gallery=p.gallery.length?`<section class="history-item-gallery"><h2>Фотоархив</h2><div class="history-gallery" data-gallery-grid>${p.gallery.map(g=>galleryButton(g,p.section)).join('')}</div><div class="profile-gallery__more-wrap"><button class="history-item-back" type="button" data-gallery-more>Показать ещё</button></div></section>`:'';
 const body=String(p.body||'').split(/\n\s*\n/).map(s=>`<p>${escLines(s)}</p>`).join('');
 const rep={TITLE:e(p.title),DESCRIPTION:e(p.lead),SECTION:e(titles[p.section]),DATE:e(prettyDate(p)),AUTHOR:e(p.author||'Не указан'),COVER:cover,BODY:body,GALLERY:gallery,SOURCES:l.sources?`<ul>${l.sources}</ul>`:'<p>Не указаны.</p>',PEOPLE:l.persons||'<p>Нет опубликованных профилей.</p>',COMPETITIONS:l.competitions||'<p>Нет опубликованных соревнований.</p>'};
 for(const [k,v]of Object.entries(rep))html=html.replaceAll('{{'+k+'}}',()=>v);
 if(preview)html=html.replace('</head>','<meta name="robots" content="noindex,nofollow"><script defer src="/site/scripts/admin/session-guard.js"></script></head>').replace(/\/media\/history\//g,'/api/admin/history/media/').replace('<body class="history-item-page">',()=>`<body class="history-item-page"><aside class="history-item-preview">Закрытый предпросмотр · <a href="/admin/history-edit?id=${e(p.id)}">К редактированию</a></aside>`);
 return html;
}
