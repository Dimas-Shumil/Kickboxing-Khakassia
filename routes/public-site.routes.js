import {publishedNews} from '../services/news.service.js';
import {publishedPeople} from '../services/people.service.js';
import {publishedCompetitions} from '../services/competitions.service.js';
import {renderHomePeople} from '../services/people-render.service.js';
import {renderHomeCompetitions} from '../services/competitions-render.service.js';
import {Router} from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {asyncHandler} from '../lib/http.js';
import {publishedPage,publishedDocuments} from '../services/site-content.service.js';
import {renderFederation,renderContacts,renderDocuments,renderHomeSite,renderSiteHtml,escapeHtml} from '../services/site-content-render.service.js';
import {sendSiteMedia} from './site-content.routes.js';
export function sitePreviewRouter({db,config,requireAuth}){
 const r=Router();r.get('/site-page-preview',requireAuth.page,asyncHandler(async(req,res)=>{
  if(!['home','federation','contacts'].includes(req.query.key))return res.status(404).sendFile(path.join(config.ROOT,'admin-pages/not-found.html'));
  const key=req.query.key;
  // Для главной использовать полный рабочий рендер: в предпросмотре блоки других разделов должны остаться честными.
  if(key==='home'){
   let html=await readFile(path.join(config.ROOT,'public/index.html'),'utf8');
   const news=await publishedNews(db),e=escapeHtml;
   const cards=news.slice(0,3).map(n=>`<article class="news-card"><a class="news-card__image" href="/news/${e(n.slug)}"><img src="${e(n.cover||'/site/img/hall-archive.webp')}" alt="${e(n.alt||n.title)}" loading="lazy"></a><div class="news-card__content"><time class="news-card__date" datetime="${e(n.publishedAt)}">${e(n.publishedAt)}</time><h3 class="news-card__title">${e(n.title)}</h3><a class="news-card__link" href="/news/${e(n.slug)}">Читать материал</a></div></article>`).join('')||'<p>Публикаций пока нет.</p>';
   html=html.replace(/<p class="home-feed__news-notice">[\s\S]*?<\/p>/,'')
      .replace(/<div class="home-feed__news-list">[\s\S]*?<\/article><\/div>/,()=>'<div class="home-feed__news-list">'+cards+'</div>')
      .replace(/<script src="\/site\/scripts\/news-(?:data|common)\.js"><\/script>/g,'')
      .replace(/<script src="\/site\/scripts\/news\.js"><\/script>/g,'');
   html=renderHomePeople(html,await publishedPeople(db));html=renderHomeCompetitions(html,await publishedCompetitions(db));
   const row=await db.sitePage.findUnique({where:{key}});
   return res.set('Cache-Control','no-store').type('html').send(renderHomeSite(html,row?JSON.parse(row.payload):null,true));
  }
  res.set('Cache-Control','no-store').type('html').send(await renderSiteHtml(config,db,key,true));
 }));
 r.get('/site-document-preview',requireAuth.page,asyncHandler(async(req,res)=>{
  const row=typeof req.query.id==='string'?await db.federationDocument.findUnique({where:{id:req.query.id}}):null;
  if(!row)return res.status(404).sendFile(path.join(config.ROOT,'admin-pages/not-found.html'));
  const d=JSON.parse(row.payload),e=escapeHtml;
  res.set('Cache-Control','no-store').type('html').send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.title)} — Предпросмотр</title><link rel="stylesheet" href="/site/css/admin.min.css"><link rel="icon" href="/favicon.ico"></head><body class="admin"><main class="workspace" style="max-width:900px;margin:4vh auto"><div class="panel"><p class="badge">Закрытый предпросмотр рабочей версии · не опубликовано этим действием</p><h1>${e(d.title)}</h1><p>${e(d.category)}${d.date?' · '+e(d.date):''}</p><p>${e(d.description)}</p><p>Автор / источник: ${e(d.author||'Не указан')}</p>${d.source?`<a class="btn" href="${e(d.source)}" rel="noopener noreferrer" target="_blank">Оригинальный источник</a>`:''} ${d.file?`<a class="btn btn--primary" href="${e(d.file.replace('/media/site/','/api/admin/site/media/'))}">Скачать PDF (только авторизованным)</a>`:'<p>PDF ещё не прикреплён.</p>'}</div></main></body></html>`);
 }));
 return r;
}
export default function createPublicSiteRouter({db,config}){
 const r=Router(),dir=path.join(config.ROOT,'public');r.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 r.get('/api/site/search',asyncHandler(async(req,res)=>{
  const q=String(req.query.q||'').slice(0,100).toLocaleLowerCase('ru').replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);
  const docs=await publishedDocuments(db),pages=await Promise.all(['home','federation','contacts'].map(async key=>({key,p:await publishedPage(db,key)})));
  const pageTitles={home:['Федерация кикбоксинга Республики Хакасия','/'],federation:['О Федерации','/federation'],contacts:['Контакты','/contacts']};
  const items=[...pages.filter(x=>x.p).map(({key,p})=>({title:pageTitles[key][0],description:p.heroLead||p.intro||p.subtitle||p.address||'',category:'Раздел Федерации',href:pageTitles[key][1],keywords:JSON.stringify(p)})),...docs.map(d=>({title:d.title,description:d.description||d.category,category:'Документы Федерации',href:'/documents#official',keywords:[d.author,d.category,d.date].join(' ')}))];
  res.json({items:items.filter(x=>q.every(w=>[x.title,x.description,x.keywords].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(w))).slice(0,100).map(({keywords,...item})=>item)});
 }));
 r.get('/media/site/:id',asyncHandler(async(req,res)=>{
  const id=req.params.id;if(!/^[a-f0-9]{48}\.(webp|pdf)$/.test(id))return res.status(404).sendFile(path.join(dir,'404.html'));
  const a=await db.siteAsset.findUnique({where:{id}});if(!a)return res.status(404).sendFile(path.join(dir,'404.html'));
  const src='/media/site/'+id;
  let isPublished=false;
  if(a.ownerKey.startsWith('page:')){
   const p=await publishedPage(db,a.ownerKey.slice(5));isPublished=!!p&&(p.heroImage===src||p.ctaImage===src||(p.leaders||[]).some(l=>l.image===src));
  }else if(a.ownerKey.startsWith('document:')){
   const docs=await publishedDocuments(db);isPublished=docs.some(d=>a.ownerKey==='document:'+d.id&&d.file===src);
  }
  if(!isPublished)return res.status(404).sendFile(path.join(dir,'404.html'));
  sendSiteMedia(res,config,id);
 }));
 r.get('/federation',asyncHandler(async(_req,res)=>{const html=await readFile(path.join(dir,'federation.html'),'utf8');res.type('html').send(renderFederation(html,await publishedPage(db,'federation')));}));
 r.get('/contacts',asyncHandler(async(_req,res)=>{const html=await readFile(path.join(dir,'contacts.html'),'utf8');res.type('html').send(renderContacts(html,await publishedPage(db,'contacts')));}));
 r.get('/documents',asyncHandler(async(_req,res)=>{const html=await readFile(path.join(dir,'documents.html'),'utf8');res.type('html').send(renderDocuments(html,await publishedDocuments(db)));}));
 return r;
}
