import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {publishedPage,publishedDocuments} from './site-content.service.js';

export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml;
const paragraph=t=>e(t).replace(/\r?\n/g,'<br>');
const cleanRobot=h=>h.replace(/<meta name="robots" content="noindex,nofollow">/,'');
const replaceSection=(h,id,content)=>h.replace(new RegExp('<section class="stage-section[^"]*" id="'+id+'"[\\s\\S]*?<\\/section>'),()=>content);
const panel=(number,title,body,more='')=>`<article class="stage-panel"><span class="stage-panel__number">${e(number)}</span><h3>${e(title)}</h3><p>${paragraph(body)}</p>${more}</article>`;
const section=(id,title,description,cards,paper=false)=>`<section class="stage-section ${paper?'stage-section--paper':''}" id="${id}" aria-labelledby="${id}-title"><div class="container"><div class="stage-heading"><h2 id="${id}-title">${e(title)}</h2><p>${e(description)}</p></div>${cards?`<div class="stage-grid">${cards}</div>`:`<div class="stage-empty"><h3>Данные пока не опубликованы</h3><p>Раздел будет дополнен после подтверждения сведений Федерацией.</p></div>`}</div></section>`;
const noData=`<div class="stage-empty"><h3>Материалы ещё не опубликованы</h3><p>Сведения появятся после подтверждения владельцем Федерации.</p></div>`;
export function renderHomeSite(html,p,privatePreview=false){
 if(!p)return html;
 if(p.heroImage){const url=privatePreview?p.heroImage.replace('/media/site/','/api/admin/site/media/'):p.heroImage;html=html.replace('<div class="hero__image" aria-hidden="true"></div>',`<div class="hero__image" aria-hidden="true" style="background-image:url('${e(url)}')"></div>`);}
 if(p.ctaImage){const url=privatePreview?p.ctaImage.replace('/media/site/','/api/admin/site/media/'):p.ctaImage;html=html.replace(/(<div class="family-cta__visual"[\s\S]*?<img[^>]*?src=")[^"]*/,(_,$1)=>$1+e(url));}
 if(p.subtitle)html=html.replace(/(<p class="hero__description">)[\s\S]*?(<\/p>)/,(_,$1,$2)=>$1+paragraph(p.subtitle)+$2);
 if(p.ctaTitle)html=html.replace(/(<h2 class="family-cta__title"[^>]*>)[\s\S]*?(<\/h2>)/,(_,$1,$2)=>$1+paragraph(p.ctaTitle)+$2);
 if(p.ctaText)html=html.replace(/(<p class="family-cta__description">)[\s\S]*?(<\/p>)/,(_,$1,$2)=>$1+paragraph(p.ctaText)+$2);
 return html;
}
export function renderFederation(html,p,privatePreview=false){
 if(!p)return html;
 html=cleanRobot(html).replace(/<div class="container"><p class="stage-notice">[\s\S]*?<\/p><\/div>/,'');
 if(p.heroTitle)html=html.replace(/(<section class="stage-hero page-hero">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/,(_,$1,$2)=>$1+paragraph(p.heroTitle)+$2);
 if(p.heroLead)html=html.replace(/(<section class="stage-hero page-hero">[\s\S]*?<h1>[\s\S]*?<\/h1><p>)[\s\S]*?(<\/p>)/,(_,$1,$2)=>$1+paragraph(p.heroLead)+$2);
 if(p.heroImage){const src=privatePreview?p.heroImage.replace('/media/site/','/api/admin/site/media/'):p.heroImage;html=html.replace(/(<section class="stage-hero page-hero"><img class="stage-hero__image" src=")[^"]+/,(_,a)=>a+e(src));}
 if(p.intro)html=html.replace(/(<section class="stage-hero page-hero">[\s\S]*?<\/section>)/,(_,$1)=>$1+`<div class="container"><p class="stage-notice">${paragraph(p.intro)}</p></div>`);
 const activities=(p.activities||[]).map((a,i)=>panel(String(i+1).padStart(2,'0')+' / Деятельность',a.title,a.body)).join('');
 html=replaceSection(html,'activity',section('activity','Направления работы','Утверждённые направления деятельности Федерации.',activities));
 const leaders=(p.leaders||[]).map((a,i)=>panel(String(i+1).padStart(2,'0')+' / Руководство',a.name,[a.position,a.bio].filter(Boolean).join(' — '),a.image?`<figure class="federation-leader"><img src="${e(privatePreview?a.image.replace('/media/site/','/api/admin/site/media/'):a.image)}" alt="${e(a.alt||a.name)}" loading="lazy"><figcaption>${e(a.credit)}</figcaption></figure>`:'')).join('');
 html=replaceSection(html,'leadership',section('leadership','Руководство','Опубликованный состав руководства.',leaders,true));
 const clubs=(p.clubs||[]).map((a,i)=>panel(String(i+1).padStart(2,'0')+' / Клуб',a.name,[a.city,a.address,a.contact].filter(Boolean).join(' · '))).join('');
 html=replaceSection(html,'clubs',section('clubs','Клубы и секции','Подтверждённые сведения о местах занятий.',clubs));
 return html;
}
export function renderContacts(html,p){
 if(!p)return html;
 html=cleanRobot(html);
 if(p.heroTitle)html=html.replace(/(<section class="stage-hero page-hero">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/,(_,$1,$2)=>$1+paragraph(p.heroTitle)+$2);
 if(p.heroLead)html=html.replace(/(<section class="stage-hero page-hero">[\s\S]*?<h1>[\s\S]*?<\/h1><p>)[\s\S]*?(<\/p>)/,(_,$1,$2)=>$1+paragraph(p.heroLead)+$2);
 const channels=[];
 if(p.phone||p.email){const links=[p.phone?`<a href="tel:${e(p.phone.replace(/[^+\d]/g,''))}">${e(p.phone)}</a>`:'',p.email?`<a href="mailto:${e(p.email)}">${e(p.email)}</a>`:''].filter(Boolean).join('<br>');channels.push(panel('01 / Обращения','Телефон и почта','',links));}
 if(p.address||p.hours)channels.push(panel('02 / Лично','Адрес и часы приёма',[p.address,p.hours].filter(Boolean).join('\n')));
 if(p.socials?.length)channels.push(panel('03 / Онлайн','Социальные сети','',`<div class="stage-links">${p.socials.map(s=>`<a class="stage-button stage-button--outline" href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.name)}</a>`).join('')}</div>`));
 let block=section('contact-details','Контактная информация','Опубликованные официальные каналы связи.',channels.join(''));
 if(p.latitude&&p.longitude){const lat=Number(p.latitude),lon=Number(p.longitude),bbox=[lon-.012,lat-.009,lon+.012,lat+.009].map(x=>x.toFixed(6)).join('%2C'),marker=encodeURIComponent(lat+','+lon);block=block.replace('</section>',`<div class="container"><div class="site-map"><iframe title="Местоположение Федерации на карте" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${marker}"></iframe><a class="stage-button stage-button--outline" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=15/${lat}/${lon}">Открыть карту</a></div></div></section>`);}
 html=replaceSection(html,'contact-details',block);
 return html;
}
export function renderDocuments(html,docs){
 if(docs.length)html=cleanRobot(html);
 const cards=docs.map((d,i)=>panel(String(i+1).padStart(2,'0')+' / '+d.category,d.title,[d.date,d.description,d.author].filter(Boolean).join(' · '),`<a class="stage-button" href="${e(d.file)}">Скачать PDF</a>${d.source?` <a class="stage-button stage-button--outline" href="${e(d.source)}" rel="noopener noreferrer" target="_blank">Источник</a>`:''}`)).join('');
 html=replaceSection(html,'official',section('official','Документы Федерации','Опубликованные PDF-файлы. Документы соревнований размещены в соответствующих событиях.',cards));
 return html;
}
export async function renderSiteHtml(config,db,key,preview=false){
 const file=key==='home'?'index':key;
 const html=await readFile(path.join(config.ROOT,'public',file+'.html'),'utf8');
 const row=await db.sitePage.findUnique({where:{key}}),p=preview?(row?JSON.parse(row.payload):null):row?.publishedPayload?JSON.parse(row.publishedPayload):null;
 return key==='home'?renderHomeSite(html,p,preview):key==='federation'?renderFederation(html,p,preview):renderContacts(html,p);
}
export {noData};
