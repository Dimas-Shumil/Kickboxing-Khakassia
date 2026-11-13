import {competitionDTO} from '../services/competitions.service.js';
import {historyDTO} from '../services/history.service.js';
import {personDTO} from '../services/people.service.js';
import {Router} from 'express';
import {asyncHandler,newsDTO} from '../lib/http.js';
function createDashboardRouter({db,requireAuth}){const router=Router();router.get('/',requireAuth,asyncHandler(async(req,res)=>{
  const canGym=['OWNER','TRAINER'].includes(req.user.role);
  const collections={dashboard:[],activity:[],finances:[],access:[],
   news:['news'],'news-edit':['news'],'news-preview':['news'],people:['people'],'person-edit':['people'],
   competitions:['competitions'],'competition-edit':['competitions','people'],
   history:['history'],'history-edit':['history','people','competitions'],
   'site-pages':[],'site-page-edit':[],'site-documents':[],'site-document-edit':[],'site-media':[],
   gym:['students','payments'],students:['students','payments'],student:['students','payments'],
   payments:['students','payments'],payment:['students','payments'],groups:['students'],group:[],trainings:[],training:[],attendance:['students']};
  const view=typeof req.query.view==='string'&&Object.hasOwn(collections,req.query.view)?req.query.view:null;
  const need=key=>view===null||collections[view].includes(key);
  const [news,logs,students,payments,people,competitions,materials,gyms]=await Promise.all([
   need('news')?db.news.findMany({orderBy:{updatedAt:'desc'}}):[],
   view===null?db.auditLog.findMany({where:canGym?{}:{scope:{in:['news','people','competitions','history','site-page','site-document','site-media']}},orderBy:{createdAt:'desc'},take:30}):[],
   canGym&&need('students')?db.student.findMany({orderBy:{name:'asc'}}):[],
   canGym&&need('payments')?db.payment.findMany({include:{pupil:{select:{name:true,deletedAt:true}},revisions:{orderBy:{createdAt:'desc'}}},orderBy:{received:'desc'}}):[],
   need('people')?db.person.findMany({orderBy:{updatedAt:'desc'}}):[],
   need('competitions')?db.competition.findMany({orderBy:{updatedAt:'desc'}}):[],
   need('history')?db.historyMaterial.findMany({orderBy:{updatedAt:'desc'}}):[],
   req.user.role==='OWNER'?db.gym.findMany({orderBy:{id:'asc'}}):req.user.role==='TRAINER'?db.gym.findMany({where:{id:req.user.gymId}}):[]
  ]);
  res.json({gymId:req.gymId,gyms,history:materials.map(historyDTO),competitions:competitions.map(competitionDTO),people:people.map(personDTO),user:{id:req.user.id,name:req.user.name,role:req.user.role,gymId:req.user.gymId},students:students.map(s=>({...s,person:''})),payments:payments.map(({revisions,...p})=>({...p,history:revisions.map(h=>({before:JSON.parse(h.before),reason:h.reason,actorId:h.actorId,at:h.createdAt.toISOString()}))})),news:news.map(newsDTO),changes:logs.reverse().map(l=>({text:({students:'Ученик',payments:'Платёж',news:'Новость',people:'Человек',competitions:'Соревнование',history:'История','site-page':'Страница Федерации','site-document':'Документ Федерации','site-media':'Медиатека','gym-groups':'Группа','gym-sessions':'Тренировка','gym-attendance':'Посещаемость'}[l.scope]||'Запись')+': '+(l.action==='create'?'создание':l.action==='delete'?'удаление':'изменение')+' · '+l.entityId,at:l.createdAt.toISOString()}))});
}));return router;}
export default createDashboardRouter;
