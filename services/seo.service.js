import {e} from './news-render.service.js';
import {profileType} from './people.service.js';
export const SITE_ORIGIN='https://kickboxing19.ru';
export const SITE_NAME='Федерация кикбоксинга Республики Хакасия';
export const SITE_PHONE='+79233595555';
export const DEFAULT_IMAGE='/site/img/seo-share.png';
export const staticPages={
 '/':{title:'Федерация кикбоксинга Республики Хакасия — официальный сайт',description:'Кикбоксинг в Хакасии: новости Федерации, соревнования, спортсмены и тренеры, история и фотоархив. Контактный телефон: +7 923 359-55-55.'},
 '/federation':{title:'О Федерации кикбоксинга Республики Хакасия',description:'Деятельность Федерации кикбоксинга Республики Хакасия: опубликованные сведения о руководстве, клубах и развитии кикбоксинга в регионе.',model:'sitePage',key:'federation'},
 '/contacts':{title:'Контакты Федерации кикбоксинга Хакасии — Абакан',description:'Связаться с Федерацией кикбоксинга Республики Хакасия: +7 923 359-55-55. Опубликованные контакты, адрес и каналы связи.',type:'ContactPage'},
 '/news':{title:'Новости кикбоксинга Хакасии — Федерация',description:'Новости Федерации кикбоксинга Республики Хакасия: соревнования, спортивные события, люди и история. Опубликованные материалы и фотографии.',model:'news',type:'CollectionPage'},
 '/competitions':{title:'Соревнования по кикбоксингу в Хакасии — календарь и результаты',description:'Предстоящие и завершённые соревнования по кикбоксингу: даты, места проведения, программа, положения, результаты и фотоотчёты.',model:'competition',type:'CollectionPage'},
 '/coaches':{title:'Тренеры по кикбоксингу в Хакасии — профили и достижения',description:'Тренеры Федерации кикбоксинга Республики Хакасия: биографии, специализация, опубликованные достижения и фотографии.',model:'person',role:'coach',type:'CollectionPage'},
 '/hall-of-fame':{title:'Зал славы кикбоксинга Хакасии — спортсмены и тренеры',description:'Спортсмены, тренеры и легенды кикбоксинга Хакасии: опубликованные биографии, достижения, фотографии и спортивные истории.',model:'person',type:'CollectionPage'},
 '/history':{title:'История кикбоксинга Хакасии — архив Федерации',description:'История кикбоксинга Республики Хакасия: исторические материалы, хронология, архивные фотографии, люди, документы и источники.',model:'historyMaterial',type:'CollectionPage'},
 '/documents':{title:'Документы Федерации кикбоксинга Хакасии',description:'Опубликованные документы Федерации кикбоксинга Республики Хакасия: положения, правила и официальные материалы для скачивания.',model:'federationDocument',type:'CollectionPage'}
};
export const faqs=[
 {question:'Что можно найти на сайте Федерации кикбоксинга Хакасии?',answer:'На сайте собраны новости Федерации, сведения о соревнованиях, профили спортсменов и тренеров, история и архивные материалы.',link:'/federation',label:'О Федерации'},
 {question:'Где посмотреть календарь и результаты соревнований?',answer:'В разделе «Соревнования» размещаются даты и места проведения, программа, положения, результаты и фотоотчёты. Состав материалов зависит от того, что опубликовано для конкретного соревнования.',link:'/competitions',label:'Соревнования'},
 {question:'Где прочитать о тренерах по кикбоксингу в Хакасии?',answer:'На странице тренеров публикуются профили с биографией и сведениями о подготовке и достижениях.',link:'/coaches',label:'Тренеры'},
 {question:'Как связаться с Федерацией?',answer:'Телефон для связи: +7 923 359-55-55. Остальные опубликованные каналы связи собраны в разделе «Контакты».',link:'/contacts',label:'Контакты'},
 {question:'Где найти историю и архивные фотографии?',answer:'В разделе «История и архив» собраны опубликованные исторические материалы, фотографии, документы и ссылки на источники.',link:'/history',label:'История и архив'}
];
export const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function description(value,fallback=''){const text=plain(value)||fallback;return text.length>190?text.slice(0,187).replace(/\s+\S*$/,'')+'…':text;}
export function absolute(path){try{const u=new URL(path,SITE_ORIGIN);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const snapshot=row=>{try{return JSON.parse(row.publishedPayload);}catch{return null;}};
const publishedWhere={status:'published',publishedPayload:{not:null}};
const validSlug=slug=>typeof slug==='string'&&slug.length>0;
export const hrefForPerson=(p,slug,role=p.primaryRole)=>'/'+profileType(p,role)+'/'+encodeURIComponent(slug);

export async function publicEntries(db){
 const [news,people,competitions,history,documents,about]=await Promise.all([
  db.news.findMany({where:publishedWhere}),db.person.findMany({where:publishedWhere}),db.competition.findMany({where:publishedWhere}),db.historyMaterial.findMany({where:publishedWhere}),db.federationDocument.findMany({where:publishedWhere}),db.sitePage.findUnique({where:{key:'federation'}})
 ]);
 const entries=[{path:'/',title:staticPages['/'].title},{path:'/contacts',title:staticPages['/contacts'].title}];
 if(about?.publishedPayload)entries.push({path:'/federation',title:staticPages['/federation'].title,lastmod:about.publishedOn});
 for(const [rows,base,kind] of [[news,'/news','news'],[competitions,'/competitions','competition'],[history,'/history','history']]){
  const valid=rows.filter(r=>validSlug(r.slug)&&snapshot(r));
  if(valid.length)entries.push({path:base,title:staticPages[base].title});
  for(const row of valid){const p=snapshot(row);entries.push({path:base+'/'+encodeURIComponent(row.slug),title:p.title,lastmod:row.publishedOn,kind,payload:p});}
 }
 const validPeople=people.filter(r=>validSlug(r.slug)&&snapshot(r));
 if(validPeople.length)entries.push({path:'/hall-of-fame',title:staticPages['/hall-of-fame'].title});
 if(validPeople.some(r=>snapshot(r).isCoach))entries.push({path:'/coaches',title:staticPages['/coaches'].title});
 for(const row of validPeople){const p=snapshot(row);for(const role of ['athlete','coach'])if(role==='athlete'?p.isAthlete:p.isCoach)entries.push({path:hrefForPerson(p,row.slug,role),title:p.name,lastmod:row.publishedOn});}
 if(documents.length)entries.push({path:'/documents',title:staticPages['/documents'].title});
 return entries;
}

export async function pageSeo(db,path){
 if(Object.hasOwn(staticPages,path)){
  const meta={...staticPages[path],path,eligible:true};
  if(meta.model==='sitePage')meta.eligible=!!(await db.sitePage.findUnique({where:{key:meta.key}}))?.publishedPayload;
  else if(meta.model){
   const rows=await db[meta.model].findMany({where:publishedWhere,select:{publishedPayload:true}});
   meta.eligible=rows.some(r=>{const p=snapshot(r);return p&&(!meta.role||p.isCoach);});
  }
  return meta;
 }
 const match=/^\/(news|competitions|history|athlete|athlete-profile|coach-legend|coach-profile)\/([^/]+)$/.exec(path);
 if(!match)return null;
 let slug;try{slug=decodeURIComponent(match[2]);}catch{return null;}
 const kind=match[1],person=['athlete','athlete-profile','coach-legend','coach-profile'].includes(kind),model=person?'person':kind==='news'?'news':kind==='competitions'?'competition':'historyMaterial';
 const row=await db[model].findFirst({where:{slug,...publishedWhere}});if(!row)return null;
 const p=snapshot(row);if(!p)return null;
 const role=kind.startsWith('coach')?'coach':'athlete';
 if(person&&(!(role==='coach'?p.isCoach:p.isAthlete)||profileType(p,role)!==kind))return null;
 const title=person?p.name+' — '+(role==='coach'?'тренер по кикбоксингу':'спортсмен')+' | Кикбоксинг Хакасии':p.title+' | '+(kind==='history'?'История кикбоксинга Хакасии':'Кикбоксинг Хакасии');
 const body=person?(role==='coach'?p.coachBio:p.athleteBio)||p.bio:kind==='competitions'?p.description:kind==='history'?p.body:p.text;
 return {path:person?hrefForPerson(p,row.slug,role):'/'+kind+'/'+encodeURIComponent(row.slug),title,description:description(p.summary||p.lead||body),eligible:true,payload:p,row,kind,role,
  image:person?(role==='coach'?p.coachPortrait||p.portrait:p.portrait):kind==='competitions'?p.image:p.cover,
  type:person?'ProfilePage':kind==='competitions'?'ItemPage':'Article'};
}

export function indexAllowed(config,req){
 return config.production===true&&config.seoIndexable===true&&config.origin===SITE_ORIGIN&&String(req.get('host')||'').toLowerCase().split(':')[0]==='kickboxing19.ru';
}
export function answersHtml(){return `<section class="site-answers" aria-labelledby="site-answers-title"><div class="container"><h2 id="site-answers-title">О кикбоксинге в Хакасии: вопросы и ответы</h2>${faqs.map(q=>`<details class="site-answers__item"><summary>${e(q.question)}</summary><div><p>${e(q.answer)}</p><a href="${e(q.link)}">${e(q.label)}</a></div></details>`).join('')}</div></section><script defer src="/site/scripts/site-answers.js?v=20261112"></script>`;}
function clean(obj){return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null&&v!==''));}
const publicImage=src=>src&&/^\/(?:site\/img|media)\//.test(src)?absolute(src):absolute(DEFAULT_IMAGE);
export function graphFor(meta,contacts={}){
 const url=SITE_ORIGIN+meta.path,orgId=SITE_ORIGIN+'/#organization',siteId=SITE_ORIGIN+'/#website',pageId=url+'#webpage';
 const org=clean({'@type':'SportsOrganization','@id':orgId,name:SITE_NAME,url:SITE_ORIGIN+'/',logo:{'@type':'ImageObject',url:absolute('/site/img/logo-fed.png')},telephone:SITE_PHONE,sport:'Кикбоксинг',areaServed:{'@type':'AdministrativeArea',name:'Республика Хакасия'},email:contacts.email,address:contacts.address,sameAs:(contacts.socials||[]).map(s=>absolute(s.url)).filter(Boolean).length?(contacts.socials||[]).map(s=>absolute(s.url)).filter(Boolean):undefined});
 const web={'@type':'WebSite','@id':siteId,url:SITE_ORIGIN+'/',name:SITE_NAME,inLanguage:'ru-RU',publisher:{'@id':orgId}};
 const page={'@type':meta.type||'WebPage','@id':pageId,url,name:meta.title,description:meta.description,inLanguage:'ru-RU',isPartOf:{'@id':siteId},about:{'@id':orgId}};
 const graph=[org,web,page];
 if(meta.path!=='/'){
  const base=meta.kind?meta.kind==='news'?'/news':meta.kind==='competitions'?'/competitions':meta.kind==='history'?'/history':meta.role==='coach'?'/coaches':'/hall-of-fame':null;
  const crumbs=[{name:'Главная',url:SITE_ORIGIN+'/'}];if(base)crumbs.push({name:staticPages[base].title,url:SITE_ORIGIN+base});crumbs.push({name:meta.payload?.name||meta.payload?.title||meta.title,url});
  graph.push({'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:c.url}))});page.breadcrumb={'@id':url+'#breadcrumbs'};
 }
 if(meta.path==='/')graph.push({'@type':'FAQPage','@id':SITE_ORIGIN+'/#answers',mainEntity:faqs.map(q=>({'@type':'Question',name:q.question,acceptedAnswer:{'@type':'Answer',text:q.answer}}))});
 const p=meta.payload;if(!p)return {'@context':'https://schema.org','@graph':graph};
 const image=publicImage(meta.image),published=meta.row.publishedOn?.toISOString?.();
 if(meta.type==='ProfilePage'){
  const person=clean({'@type':'Person','@id':SITE_ORIGIN+'/people/'+encodeURIComponent(meta.row.slug)+'#person',name:p.name,url,image,description:meta.description,jobTitle:meta.role==='coach'?p.coachTitle:undefined});
  graph.push(person);page.mainEntity={'@id':person['@id']};
 }else if(meta.kind==='competitions'){
  const event=clean({'@type':'SportsEvent','@id':url+'#event',name:p.title,url,description:description(p.description||p.lead),startDate:p.startDate,endDate:p.endDate,location:p.location?{'@type':'Place',name:p.location}:undefined,image:p.image?[image]:undefined,organizer:p.organizer?{'@type':'Organization',name:p.organizer}:undefined});graph.push(event);page.mainEntity={'@id':event['@id']};
 }else{
  const article=clean({'@type':meta.kind==='news'?'NewsArticle':'Article','@id':url+'#article',headline:p.title,description:meta.description,url,mainEntityOfPage:{'@id':pageId},inLanguage:'ru-RU',image:meta.image?[image]:undefined,datePublished:meta.kind==='news'?p.publishedAt:published,dateModified:published,author:p.author?{'@type':p.author===SITE_NAME||p.author==='Федерация'?'Organization':'Person',name:p.author}:undefined,publisher:{'@id':orgId}});graph.push(article);page.mainEntity={'@id':article['@id']};
 }
 return {'@context':'https://schema.org','@graph':graph};
}

export function injectSeo(html,meta,{indexable=false,contacts={},verification={}}={}){
 const canonical=meta?SITE_ORIGIN+meta.path:null,robots=indexable?'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1':'noindex,follow';
 html=html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["'](?:robots|googlebot|description|twitter:[^"']+)["'])[^>]*>\s*/gi,'').replace(/<meta\b(?=[^>]*\bproperty\s*=\s*["']og:[^"']+["'])[^>]*>\s*/gi,'').replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>\s*/gi,'');
 let head=`<meta name="robots" content="${robots}">`;
 if(meta){
  const title=meta.title,desc=description(meta.description,staticPages['/'].description),image=publicImage(meta.image);
  html=html.replace(/<title>[\s\S]*?<\/title>/i,()=>'<title>'+e(title)+'</title>');
  head+=`<meta name="description" content="${e(desc)}"><link rel="canonical" href="${e(canonical)}"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="${e(SITE_NAME)}"><meta property="og:type" content="${meta.type==='Article'?'article':'website'}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(image)}"><meta property="og:image:alt" content="${e(meta.payload?.name||meta.payload?.title||SITE_NAME)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(desc)}"><meta name="twitter:image" content="${e(image)}"><link rel="alternate" type="application/rss+xml" title="Новости Федерации кикбоксинга Хакасии" href="${SITE_ORIGIN}/feed.xml">`;
  if(!meta.image)head+='<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">';
  for(const [name,value]of Object.entries(verification))if(value)head+=`<meta name="${e(name)}" content="${e(value)}">`;
  const json=JSON.stringify(graphFor({...meta,description:desc},contacts)).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');head+=`<script type="application/ld+json">${json}</script>`;
  if(meta.path==='/'){html=html.replace('</main>',()=>answersHtml()+'</main>');head+='<link rel="stylesheet" href="/site/css/seo.min.css?v=20261112-smooth">';}
 }
 return html.replace('</head>',()=>head+'</head>');
}
