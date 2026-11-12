import {renderCompetitionCatalog} from '../services/catalog-render.service.js';
import {Router} from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {asyncHandler} from '../lib/http.js';
import {publishedCompetitions,publicCompetition,competitionDTO,competitionFiles} from '../services/competitions.service.js';
import {publishedPeople} from '../services/people.service.js';
import {renderCompetition} from '../services/competitions-render.service.js';
import {sendCompetitionFile} from './competitions.routes.js';
export function competitionPreviewRouter({db,config,requireAuth}){const router=Router();router.get('/competition-preview',requireAuth.page,asyncHandler(async(req,res)=>{
 const row=typeof req.query.id==='string'?await db.competition.findUnique({where:{id:req.query.id}}):null;
 if(!row)return res.status(404).sendFile(path.join(config.ROOT,'admin-pages/not-found.html'));
 res.type('html').send(await renderCompetition(config,competitionDTO(row),await publishedPeople(db),true));
}));return router;}
export default function createPublicCompetitionsRouter({db,config}){
 const router=Router(),notFound=res=>res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/api/competitions',asyncHandler(async(_req,res)=>res.json({competitions:await publishedCompetitions(db)})));
 router.get('/api/competitions/search',asyncHandler(async(req,res)=>{const q=String(req.query.q||'').slice(0,100).toLocaleLowerCase('ru').replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);const rows=await publishedCompetitions(db);res.json({items:rows.filter(x=>q.every(w=>[x.title,x.lead,x.description,x.location,x.disciplines.join(' '),x.resultsText].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(w))).slice(0,100).map(x=>({title:x.title,description:x.lead||x.location,category:'Соревнования',href:'/competitions/'+x.slug,keywords:''}))});}));
 router.get('/media/competitions/:file',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.(webp|pdf)$/.test(req.params.file))return notFound(res);const src='/media/competitions/'+req.params.file;if(!(await publishedCompetitions(db)).some(x=>competitionFiles(x).includes(src)))return notFound(res);sendCompetitionFile(res,config,req.params.file);}));
 router.get('/competitions',asyncHandler(async(req,res)=>{
  const rows=await publishedCompetitions(db);let html=await readFile(path.join(config.ROOT,'public/competitions.html'),'utf8');
  const data=JSON.stringify(rows.map(x=>({...x,status:x.eventStatus}))).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  html=html.replace('<script src="/site/scripts/competitions-data.js"></script>',()=>'<script>window.FED_COMPETITIONS='+data+';</script>').replace(/<div class="container"><p class="stage-notice">[\s\S]*?<\/p><\/div>/,'').replace(/<meta name="robots" content="noindex,nofollow">/,'');
  html=renderCompetitionCatalog(html,rows,req.query);
  res.type('html').send(html);
 }));
 const detail=async(req,res)=>{const where=req.params.slug?{slug:req.params.slug}:{id:typeof req.query.id==='string'?req.query.id:''};const row=await db.competition.findFirst({where:{...where,status:'published',publishedPayload:{not:null}}});if(!row)return notFound(res);if(!req.params.slug)return res.redirect(301,'/competitions/'+row.slug);res.type('html').send(await renderCompetition(config,publicCompetition(row),await publishedPeople(db)));};
 router.get('/competitions/:slug',asyncHandler(detail));router.get('/competition',asyncHandler(detail));return router;
}
