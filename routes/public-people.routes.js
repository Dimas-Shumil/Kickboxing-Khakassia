import {Router} from 'express';
import path from 'node:path';
import {asyncHandler} from '../lib/http.js';
import {publishedPeople,publicPerson,personImages,profileType,peopleMediaDir,personDTO} from '../services/people.service.js';
import {renderPerson,renderPeopleCatalog,personHref} from '../services/people-render.service.js';
export function peoplePreviewRouter({db,config,requireAuth}){const router=Router();router.get('/person-preview',requireAuth.page,asyncHandler(async(req,res)=>{
 const row=typeof req.query.id==='string'?await db.person.findUnique({where:{id:req.query.id}}):null;
 if(!row)return res.status(404).sendFile(path.join(config.ROOT,'admin-pages/not-found.html'));
 const p=personDTO(row),role=req.query.role||p.primaryRole;
 if(!['athlete','coach'].includes(role)||!(role==='athlete'?p.isAthlete:p.isCoach))return res.status(404).sendFile(path.join(config.ROOT,'admin-pages/not-found.html'));
 res.type('html').send(await renderPerson(config,p,role,await publishedPeople(db),true));
}));return router;}
export default function createPublicPeopleRouter({db,config}){
 const router=Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 const notFound=res=>res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
 router.get('/api/people/search',asyncHandler(async(req,res)=>{const q=String(req.query.q||'').slice(0,100).toLocaleLowerCase('ru').replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);const rows=await publishedPeople(db);res.json({items:rows.filter(p=>q.every(w=>[p.name,p.summary,p.bio,p.athleteBio,p.coachBio,p.club,p.athleteTitle,p.coachTitle,p.discipline,p.specialization].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(w))).slice(0,100).map(p=>({title:p.name,description:p.summary||p.athleteTitle||p.coachTitle,category:[p.isAthlete?'Спортсмен':'',p.isCoach?'Тренер':'',p.athleteLegend||p.coachLegend?'Легенда':''].filter(Boolean).join(' · '),href:'/people/'+p.slug,keywords:''}))});}));
 router.get('/media/people/:file',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.webp$/.test(req.params.file))return notFound(res);const src='/media/people/'+req.params.file;if(!(await publishedPeople(db)).some(p=>personImages(p).includes(src)))return notFound(res);res.type('webp').sendFile(path.join(peopleMediaDir(config),req.params.file),{cacheControl:false},err=>{if(err&&!res.headersSent)res.status(404).end();});}));
 for(const name of ['hall-of-fame','coaches'])router.get('/'+name,asyncHandler(async(_req,res)=>res.type('html').send(await renderPeopleCatalog(config,name,await publishedPeople(db)))));
 router.get('/people/:slug',asyncHandler(async(req,res)=>{const row=await db.person.findFirst({where:{slug:req.params.slug,status:'published',publishedPayload:{not:null}}});if(!row)return notFound(res);res.redirect(302,personHref(publicPerson(row)));}));
 for(const type of ['athlete','athlete-profile','coach-legend','coach-profile']){
  const role=type.startsWith('coach')?'coach':'athlete';
  router.get('/'+type+'/:slug',asyncHandler(async(req,res)=>{
   const row=await db.person.findFirst({where:{slug:req.params.slug,status:'published',publishedPayload:{not:null}}});if(!row)return notFound(res);
   const p=publicPerson(row);if(!(role==='athlete'?p.isAthlete:p.isCoach))return notFound(res);
   if(profileType(p,role)!==type)return res.redirect(302,personHref(p,role));
   res.type('html').send(await renderPerson(config,p,role,await publishedPeople(db)));
  }));
  router.get('/'+type,asyncHandler(async(req,res)=>{const row=typeof req.query.id==='string'?await db.person.findFirst({where:{id:req.query.id,status:'published',publishedPayload:{not:null}}}):null;if(!row)return notFound(res);const p=publicPerson(row);if(!(role==='athlete'?p.isAthlete:p.isCoach))return notFound(res);res.redirect(301,personHref(p,role));}));
 }
 return router;
}
