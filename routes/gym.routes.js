import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import * as v from '../lib/validation.js';
import requireGym from '../middleware/require-gym.js';
import requireCsrf from '../middleware/require-csrf.js';
import * as gym from '../services/gym.service.js';

function createGymRouter({db,requireAuth,validateOrigin}){
 const router=Router();
 router.use(requireAuth,requireGym);
 router.get('/summary',asyncHandler(async(req,res)=>res.json({success:true,summary:await gym.summary(db,v.period(req.query.month))})));
 router.get('/groups',asyncHandler(async(_req,res)=>res.json({success:true,groups:await db.trainingGroup.findMany({orderBy:{name:'asc'}})})));
 router.get('/groups/:id',asyncHandler(async(req,res)=>{
  const group=await db.trainingGroup.findUnique({where:{id:req.params.id}});
  if(!group)throw new v.HttpError(404,'Группа не найдена.');res.json({success:true,group});
 }));
 router.get('/sessions',asyncHandler(async(req,res)=>{
  const month=v.period(req.query.month);
  const sessions=await db.gymSession.findMany({where:{heldOn:{startsWith:month}},include:gym.sessionInclude,orderBy:[{heldOn:'asc'},{startsAt:'asc'},{id:'asc'}]});
  res.json({success:true,sessions});
 }));
 router.get('/sessions/:id',asyncHandler(async(req,res)=>{
  const session=await db.gymSession.findUnique({where:{id:req.params.id},include:gym.sessionInclude});
  if(!session)throw new v.HttpError(404,'Тренировка не найдена.');res.json({success:true,session});
 }));
 router.get('/students/:id/attendance',asyncHandler(async(req,res)=>{
  const student=await db.student.findUnique({where:{id:req.params.id},select:{id:true}});
  if(!student)throw new v.HttpError(404,'Ученик не найден.');
  const records=await db.attendanceRecord.findMany({where:{studentId:student.id},include:{session:{select:{id:true,title:true,heldOn:true,startsAt:true,status:true,group:{select:{name:true}}}}},orderBy:{createdAt:'desc'}});
  res.json({success:true,records});
 }));
 router.use(validateOrigin,requireCsrf);
 router.post('/groups',asyncHandler(async(req,res)=>{
  const group=await gym.createGroup(db,req.user.id,gym.groupData(req.body));res.status(201).json({success:true,group});
 }));
 router.patch('/groups/:id',asyncHandler(async(req,res)=>{
  const group=await gym.updateGroup(db,req.user.id,req.params.id,v.version(req.body?.version),gym.groupData(req.body));res.json({success:true,group});
 }));
 router.post('/sessions',asyncHandler(async(req,res)=>{
  const session=await gym.createSession(db,req.user.id,gym.sessionData(req.body));res.status(201).json({success:true,session});
 }));
 router.patch('/sessions/:id',asyncHandler(async(req,res)=>{
  const session=await gym.updateSession(db,req.user.id,req.params.id,v.version(req.body?.version),gym.sessionData(req.body));res.json({success:true,session});
 }));
 router.patch('/sessions/:id/attendance',asyncHandler(async(req,res)=>{
  const session=await gym.saveAttendance(db,req.user.id,req.params.id,gym.attendanceData(req.body));res.json({success:true,session});
 }));
 return router;
}
export default createGymRouter;
