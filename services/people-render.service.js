import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {profileType} from './people.service.js';
import {e} from './news-render.service.js';
export const personHref=(p,role=p.primaryRole)=>'/'+profileType(p,role)+'/'+p.slug;
const empty='<p class="person-empty">Материалы пока не добавлены.</p>';
const paras=value=>value?String(value).split(/\n\s*\n/).map(t=>`<p class="person-content-text">${e(t)}</p>`).join(''):empty;
const img=(src,alt='',credit='')=>src?`<img src="${e(src)}" alt="${e(alt)}" loading="lazy">${credit?`<figcaption>${e(credit)}</figcaption>`:''}`:'';
const fill=(html,data)=>html.replace(/\{\{([A-Z_]+)\}\}/g,(_m,key)=>data[key]??'');
const read=(config,name)=>readFile(path.join(config.ROOT,'views/people',name+'.html'),'utf8');
export async function renderPerson(config,p,role,people,preview=false){
 const type=profileType(p,role),coach=role==='coach',awards=coach?p.coachAwards:p.athleteAwards;
 const quote=(coach?p.coachQuote:p.athleteQuote)||p.quote;
 const portrait=coach?(p.coachPortrait||p.portrait):p.portrait;
 const href=r=>preview?'/admin/person-preview?id='+encodeURIComponent(p.id)+'&role='+r:personHref(p,r);
 const roles=`<span class="person-role-links" role="navigation" aria-label="Профили человека">${p.isAthlete?`<a href="${e(href('athlete'))}" ${!coach?'aria-current="page"':''}>${p.athleteLegend?'Спортсмен-легенда':'Спортсмен'}</a>`:''}${p.isCoach?`<a href="${e(href('coach'))}" ${coach?'aria-current="page"':''}>${p.coachLegend?'Тренер-легенда':'Тренер'}</a>`:''}</span>`;
 const bio=paras((coach?p.coachBio:p.athleteBio)||p.bio);
 const athleteFacts=[['Статус',p.athleteStatus],['Дисциплина',p.discipline],['Клуб',p.club],['Тренер',p.trainer],['Город',p.city]].filter(x=>x[1]);
 const coachFacts=[['Роль',p.coachTitle||'Тренер Федерации'],['Направление',p.specialization],['Клуб',p.club],['Тренерский стаж',p.experience],['Город',p.city]].filter(x=>x[1]);
 const timeline=p.timeline.filter(x=>x.role==='all'||x.role===role);
 let awardHTML=awards.map((a,i)=>{
  if(type==='athlete')return `<article class="profile-award"><span class="profile-award__icon" aria-hidden="true">★</span><span class="profile-award__kicker">${e(a.date||String(i+1).padStart(2,'0'))}</span><h3>${e(a.title)}</h3><p class="person-content-text">${e(a.text)}</p></article>`;
  if(type==='athlete-profile')return `<article class="athlete-detail-result athlete-detail-result--${a.place==='1'?'gold':a.place==='2'?'silver':'bronze'}"><span class="athlete-detail-result__date">${e(a.date)}</span><h3>${e(a.title)}</h3><p class="person-content-text">${e(a.text)}</p>${a.place?`<div class="athlete-detail-result__place"><strong>${e(a.place)}</strong><span>место</span></div>`:''}</article>`;
  if(type==='coach-legend')return `<article class="coach-award"><span class="coach-award__icon" aria-hidden="true">✦</span><h3>${e(a.title)}</h3><p class="person-content-text">${e(a.date)} ${e(a.text)}</p></article>`;
  return `<article><span class="coach-profile-results__icon">${i+1}</span><div><h3>${e(a.title)}</h3><p class="person-content-text">${e(a.date)} ${e(a.text)}</p></div></article>`;
 }).join('')||empty;
 const pupils=p.publicPupils.map(ref=>({ref,person:people.find(x=>x.id===ref.personId&&x.isAthlete)})).filter(x=>x.person&&x.person.id!==p.id).map(({person:x,ref},i)=>{
  const c=type==='coach-legend'?'coach-student':'coach-profile-student';
  return `<article class="${c}"><a class="${c}__${type==='coach-legend'?'image':'photo'}" href="${e(personHref(x,'athlete'))}">${img(x.portrait,x.portraitAlt||x.name)}</a><div class="${c}__body"><h3><a href="${e(personHref(x,'athlete'))}">${e(x.name)}</a></h3><p class="person-content-text">${e(ref.description||x.athleteTitle)}</p></div></article>`;
 }).join('')||'<p class="person-empty">Опубликованные профили воспитанников пока не добавлены.</p>';
 const gallery=p.gallery.map((g,i)=>{
  const caption=[g.caption,g.credit].filter(Boolean).join(' · ');
  if(coach){const c=type==='coach-legend'?'coach-gallery__item':'coach-profile-gallery__item';return `<button type="button" class="${c}" data-coach-media data-type="image" data-category="${e(g.category)}" data-full="${e(g.src)}" data-caption="${e(caption)}" aria-label="Открыть фотографию ${i+1}">${img(g.src,g.alt)}<span>${e(g.caption)}</span></button>`;}
  return `<button type="button" class="profile-gallery__item" data-media-type="image" data-gallery-category="${e(g.category)}" data-full="${e(g.src)}" data-caption="${e(caption)}" aria-label="Открыть фотографию ${i+1}">${img(g.src,g.alt)}<span class="profile-gallery__item-label">${e(g.caption)}</span><span class="profile-gallery__zoom" aria-hidden="true">+</span></button>`;
 }).join('')||empty;
 const pathHTML=timeline.map((t,i)=>{
  const title=`<h3>${e(t.title)}</h3><p class="person-content-text">${e(t.text)}</p>`;
  if(type==='athlete')return `<li><span class="profile-journey__year">${e(t.date)}</span><div>${title}</div></li>`;
  if(type==='athlete-profile')return `<li><span class="athlete-detail-journey__year">${e(t.date)}</span>${title}</li>`;
  return `<li><span class="${type==='coach-legend'?'coach-path__step':''}">${e(t.date||String(i+1).padStart(2,'0'))}</span>${title}</li>`;
 }).join('')||'<li class="person-empty">Хронология пока не добавлена.</li>';
 const data={PAGE_TITLE:e(p.name)+' — Федерация кикбоксинга Хакасии',DESCRIPTION:e(p.summary||p.name),NAME:e(p.name),NAME_SPANS:p.name.split(/\s+/).map((x,i)=>'<span'+(type==='athlete'&&i>0?' class="profile-hero__gold"':'')+'>'+e(x)+'</span>').join(''),ATHLETE_TITLE:e(p.athleteTitle),DISCIPLINE:e(p.discipline),COACH_TITLE:e(p.coachTitle||'Тренер Федерации'),PORTRAIT:img(portrait,p.portraitAlt||p.name)+(p.photoCredit&&type!=='coach-profile'?'<span class="person-photo-credit">'+e(p.photoCredit)+'</span>':''),CREDIT:e(p.photoCredit),QUOTE:e(quote),QUOTE_LINKS:e(quote)+roles,BIO:bio,LEGEND_BIO:'<span class="profile-section-head__eyebrow">История человека за медалями</span><h2 id="profile-story-title">Моя история</h2><span class="profile-section-head__line" aria-hidden="true"></span>'+bio,STORY_IMAGE:img(p.storyImage,p.storyCaption),STORY_FIGURE:img(p.storyImage,p.storyCaption,p.storyCaption),ATHLETE_FACTS:athleteFacts.map(([a,b])=>`<div><dt>${e(a)}</dt><dd>${e(b)}</dd></div>`).join(''),COACH_FACTS:coachFacts.map(([a,b])=>type==='coach-legend'?`<div><span aria-hidden="true">✦</span><p><strong>${e(a)}</strong><small>${e(b)}</small></p></div>`:`<div><span class="coach-profile-facts__label">${e(a)}</span><strong>${e(b)}</strong></div>`).join(''),AWARDS:awardHTML,HIGHLIGHTS:awards.slice(0,4).map(a=>`<article class="athlete-detail-highlight"><span class="athlete-detail-highlight__icon">★</span><strong>${e(a.place)}</strong><div><span>${e(a.title)}</span><small>${e(a.date)}</small></div></article>`).join(''),TIMELINE:pathHTML,GALLERY:gallery,PUPILS:pupils,PUPIL_INTRO:'Опубликованные спортсмены, подготовленные наставником.',AWARDS_INTRO:'Подтверждённые достижения',PATH_INTRO:'Этапы спортивного и тренерского пути',METHOD_QUOTE:e(p.methodQuote),SCHOOL:paras(p.school)+p.methods.map(m=>`<h3>${e(m.title)}</h3>${paras(m.text)}`).join(''),METHODS:(p.methodQuote?'<article class="coach-profile-method__card"><h3>Принципы подготовки</h3>'+paras(p.methodQuote)+'</article>':'')+p.methods.map((m,i)=>`<article class="coach-profile-method__card"><span>${i+1}</span><h3>${e(m.title)}</h3>${paras(m.text)}</article>`).join('')||empty};
 let html=fill(await read(config,type),data);
 // Markers are replaced once. User text is never interpreted as a template.
 if(preview){html=html.replace('</head>','<script defer src="/site/scripts/admin/session-guard.js"></script></head>');html=html.replace(/\/media\/people\//g,'/api/admin/people/media/');html=html.replace(/<body([^>]*)>/,`<body$1><aside class="person-preview-banner">Закрытый предпросмотр · ${e(p.name)} <a href="/admin/person-edit?id=${e(p.id)}">Вернуться к редактированию</a></aside>`);}
 return html;
}
export async function renderPeopleCatalog(config,name,people){
 const legendRole=x=>x.athleteLegend&&x.coachLegend?x.primaryRole:x.athleteLegend?'athlete':'coach';
 const legends=people.filter(x=>x.athleteLegend||x.coachLegend),athletes=people.filter(x=>x.isAthlete&&!x.athleteLegend),coaches=people.filter(x=>x.isCoach);
 const legendPhoto=x=>{const first=legendRole(x)==='coach'?(x.coachPortrait||x.portrait):x.portrait;return `<div class="hall-legend__photo${x.hallHoverPhoto?' hall-legend__photo--swap':''}">${img(first,x.portraitAlt||x.name)}${x.hallHoverPhoto?`<img class="hall-legend__photo-hover" src="${e(x.hallHoverPhoto)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`:''}</div>`;};
 const legendCards=legends.map(x=>`<article class="hall-legend"><a class="hall-legend__link" href="${e(personHref(x,legendRole(x)))}" aria-label="${e(x.name)}"></a>${legendPhoto(x)}<div class="hall-legend__body"><h3 class="hall-legend__name">${e(x.name)}</h3><p class="hall-legend__description">${e(x.summary)}</p><div class="hall-legend__tags"><span>${x.athleteLegend?'Спортсмен-легенда':''}${x.athleteLegend&&x.coachLegend?' · ':''}${x.coachLegend?'Тренер-легенда':''}</span></div></div></article>`).join('')||empty;
 const athleteCards=athletes.map(x=>`<a class="heritage-card heritage-card--linked" href="${e(personHref(x,'athlete'))}"><div class="heritage-card__photo">${img(x.portrait,x.portraitAlt||x.name)}</div><div class="heritage-card__details"><h3>${e(x.name)}</h3><p>${e(x.athleteTitle||x.summary)}</p></div></a>`).join('')||empty;
 const coachCards=coaches.map(x=>`<a class="coach-card coach-card--linked" href="${e(personHref(x,'coach'))}"><div class="coach-card__photo">${img(x.coachPortrait||x.portrait,x.portraitAlt||x.name)}</div><div class="coach-card__details"><h3>${e(x.name)}</h3><p>${e(x.coachTitle||x.specialization)}</p></div></a>`).join('')||empty;
 return fill(await read(config,name),{LEGEND_CARDS:legendCards,ATHLETE_CARDS:athleteCards,COACH_CARDS:coachCards});
}
export function renderHomePeople(html,people){const rows=people.filter(x=>x.isAthlete&&x.showOnHome),cards=rows.map(x=>`<article class="athlete-card"><a class="athlete-card__photo" href="${e(personHref(x,'athlete'))}" aria-label="${e(x.name)}">${img(x.portrait,x.portraitAlt||x.name)}</a><div class="athlete-card__body"><h3 class="athlete-card__name">${e(x.name)}</h3><p class="athlete-card__meta">${e(x.athleteTitle)}</p></div></article>`).join('')||empty;
 return html.replace(/(<div class="home-feed__athletes-track"[^>]*>)[\s\S]*?(<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section>)/,(_m,start,end)=>start+cards+end).replace(/(<span class="home-feed__counter" data-athletes-counter[^>]*>)[^<]*(<\/span>)/,(_m,a,b)=>a+(rows.length?'01 / '+String(rows.length).padStart(2,'0'):'00 / 00')+b);
}
