import {renderNewsCatalog,renderHomeNews} from '../services/catalog-render.service.js';
import {publishedPage} from '../services/site-content.service.js';
import {renderHomeSite} from '../services/site-content-render.service.js';
import {publishedCompetitions} from '../services/competitions.service.js';
import {renderHomeCompetitions} from '../services/competitions-render.service.js';
import {publishedPeople} from '../services/people.service.js';
import {renderHomePeople} from '../services/people-render.service.js';
import {Router} from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {asyncHandler} from '../lib/http.js';
import {publishedNews,publicNews,mediaDir} from '../services/news.service.js';
import {newsArticle,e} from '../services/news-render.service.js';
export default function createPublicNewsRouter({db,config}){
 const router=Router(),read=name=>readFile(path.join(config.ROOT,'public',name+'.html'),'utf8');
 const noCache=(_req,res,next)=>{res.set('Cache-Control','no-store');next();};router.use(noCache);
 router.get('/api/news',asyncHandler(async(_req,res)=>res.json({news:await publishedNews(db)})));
 router.get('/api/news/search',asyncHandler(async(req,res)=>{
  const q=String(req.query.q||'').slice(0,100).toLocaleLowerCase('ru').replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);
  const news=await publishedNews(db);res.json({items:news.filter(n=>q.every(word=>[n.title,n.lead,n.text,n.category].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(word))).slice(0,100).map(n=>({title:n.title,description:n.lead,category:'Новости · '+n.category,href:'/news/'+n.slug,keywords:''}))});
 }));
 router.get('/media/news/:file',asyncHandler(async(req,res)=>{
  const id=req.params.file;
  if(!/^[a-f0-9]{48}\.webp$/.test(id))return res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
  const news=await publishedNews(db),src='/media/news/'+id;
  if(!news.some(n=>n.cover===src||n.gallery.some(g=>g.src===src)))return res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
  res.set('X-Content-Type-Options','nosniff').type('webp').sendFile(path.join(mediaDir(config),id),{cacheControl:false},err=>{if(err&&!res.headersSent)res.status(404).end();});
 }));
 const detail=async(req,res)=>{
  const where=req.params.slug?{slug:req.params.slug}:{id:typeof req.query.id==='string'?req.query.id:''};
  const row=await db.news.findFirst({where:{...where,status:'published',publishedPayload:{not:null}}});
  if(!row)return res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
  if(!req.params.slug)return res.redirect(301,'/news/'+row.slug);
  const n=publicNews(row);let html=await read('news-item');
  html=html.replace(/<div id="news-content">[\s\S]*?<\/main>/,()=>'<div id="news-content">'+newsArticle(n)+'</div></main>')
    .replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+e(n.title)+' — Федерация кикбоксинга Хакасии</title>')
    .replace(/<meta name="description" content="[^"]*">/,()=>'<meta name="description" content="'+e(n.lead)+'">')
    .replace(/<script src="\/site\/scripts\/news-(data|common|item)\.js"><\/script>/g,'');
  res.type('html').send(html);
 };
 router.get('/news/:slug',asyncHandler(detail));router.get('/news-item',asyncHandler(detail));
 for(const [route,name]of [['/','index'],['/news','news']])router.get(route,asyncHandler(async(req,res)=>{
  const news=await publishedNews(db);let html=await read(name);
  const data=JSON.stringify(news).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  html=html.replace('<script src="/site/scripts/news-data.js"></script>',()=>'<script>window.FED_NEWS='+data+';</script>');
  if(name==='index')html=html.replace(/<p class="home-feed__news-notice">[\s\S]*?<\/p>/,'').replace(/<div class="home-feed__news-list">[\s\S]*?<\/article><\/div>/,'<div class="home-feed__news-list"><p>Публикаций пока нет.</p></div>');
  if(name==='news')html=html.replace(/<div class="container"><p class="stage-notice">[\s\S]*?<\/p><\/div>/,'').replace('Демонстрационная версия раздела.','Опубликованные материалы Федерации.').replace('Подтверждённые новости пока не предоставлены.','');
  if(name==='news')html=renderNewsCatalog(html,news,req.query);
  if(name==='index')html=renderHomeNews(html,news);
  if(name==='index'){html=renderHomePeople(html,await publishedPeople(db));html=renderHomeCompetitions(html,await publishedCompetitions(db));html=renderHomeSite(html,await publishedPage(db,'home'));}
  res.type('html').send(html);
 }));return router;
}
