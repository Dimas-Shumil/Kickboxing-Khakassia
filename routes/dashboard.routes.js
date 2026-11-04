import {Router} from 'express';
import {asyncHandler,newsDTO} from '../lib/http.js';
function createDashboardRouter({db,requireAuth}){const router=Router();router.get('/',requireAuth,asyncHandler(async(req,res)=>{
  const canGym=req.user.role==='OWNER';
  const [news,logs,students,payments]=await Promise.all([db.news.findMany({orderBy:{updatedAt:'desc'}}),db.auditLog.findMany({where:canGym?{}:{scope:'news'},orderBy:{createdAt:'desc'},take:30}),canGym?db.student.findMany({orderBy:{name:'asc'}}):[],canGym?db.payment.findMany({include:{revisions:{orderBy:{createdAt:'desc'}}},orderBy:{received:'desc'}}):[]]);
  res.json({user:{id:req.user.id,name:req.user.name,role:req.user.role},students:students.map(s=>({...s,person:''})),payments:payments.map(({revisions,...p})=>({...p,history:revisions.map(h=>({before:JSON.parse(h.before),reason:h.reason,actorId:h.actorId,at:h.createdAt.toISOString()}))})),news:news.map(newsDTO),changes:logs.reverse().map(l=>({text:({students:'Ученик',payments:'Платёж',news:'Новость'}[l.scope]||'Запись')+': '+(l.action==='create'?'создание':'изменение')+' · '+l.entityId,at:l.createdAt.toISOString()}))});
}));return router;}
export default createDashboardRouter;
