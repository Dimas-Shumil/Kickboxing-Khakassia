import {Router} from 'express';
import path from 'node:path';
import {asyncHandler} from '../lib/http.js';
import {publishedHistory,publicHistory,historyFiles,historyDTO} from '../services/history.service.js';
import {renderHistoryIndex,renderHistoryDetail,historyConnections} from '../services/history-render.service.js';
import {sendHistoryFile} from './history.routes.js';
export function historyPreviewRouter({db,config,requireAuth}){const r=Router();r.get('/history-preview',requireAuth.page,asyncHandler(async(req,res)=>{
 const row=typeof req.query.id==='string'?await db.historyMaterial.findUnique({where:{id:req.query.id}}):null;
 if(!row)return res.status(404).sendFile(path.join(config.ROOT,'admin-pages/not-found.html'));
 res.type('html').send(await renderHistoryDetail(config,historyDTO(row),await historyConnections(db,JSON.parse(row.payload)),true));
 }));return r;}
export default function createPublicHistoryRouter({db,config}){
 const r=Router(),notFound=res=>res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
 r.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 r.get('/api/history',asyncHandler(async(_req,res)=>{const rows=await publishedHistory(db);const materials=await Promise.all(rows.map(async p=>{const related=await historyConnections(db,p);return {...p,people:related.people.map(x=>x.id),competitions:related.competitions.map(x=>x.id)};}));res.json({materials});}));
 r.get('/api/history/search',asyncHandler(async(req,res)=>{const q=String(req.query.q||'').slice(0,100).toLocaleLowerCase('ru').replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean),rows=await publishedHistory(db);
  res.json({items:rows.filter(x=>q.every(w=>[x.title,x.lead,x.body,x.period,x.author,x.sources.map(s=>s.title).join(' ')].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(w))).slice(0,100).map(x=>({title:x.title,description:x.lead,category:'История и архив',href:'/history/'+x.slug,keywords:''}))});
 }));
 r.get('/media/history/:file',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.webp$/.test(req.params.file))return notFound(res);const src='/media/history/'+req.params.file;if(!(await publishedHistory(db)).some(x=>historyFiles(x).includes(src)))return notFound(res);sendHistoryFile(res,config,req.params.file);}));
 r.get('/history',asyncHandler(async(_req,res)=>res.type('html').send(await renderHistoryIndex(config,await publishedHistory(db)))));
 r.get('/history/:slug',asyncHandler(async(req,res)=>{const row=await db.historyMaterial.findFirst({where:{slug:req.params.slug,status:'published',publishedPayload:{not:null}}});if(!row)return notFound(res);const p=publicHistory(row);res.type('html').send(await renderHistoryDetail(config,p,await historyConnections(db,p)));}));
 return r;
}
