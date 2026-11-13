import {removeGymRecord} from '../services/gym-delete.service.js';
import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import * as v from '../lib/validation.js';
import requireGym from '../middleware/require-gym.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createRecordWriter} from '../services/record.service.js';
function createStudentsRouter({db,requireAuth,validateOrigin}){
 const router=Router(),write=createRecordWriter(db);router.use(requireAuth,requireGym);
 router.get('/',asyncHandler(async(_req,res)=>res.json({success:true,students:await db.student.findMany({orderBy:{name:'asc'}})})));
 router.get('/:id',asyncHandler(async(req,res)=>{const student=await db.student.findUnique({where:{id:req.params.id}});if(!student)throw new v.HttpError(404,'Ученик не найден.');res.json({success:true,student});}));
 router.use(validateOrigin,requireCsrf);
 router.post('/',asyncHandler(async(req,res)=>write(req,res,'student','students',v.student(req.body))));
 router.patch('/:id',asyncHandler(async(req,res)=>write(req,res,'student','students',v.student(req.body))));
 router.delete('/:id',asyncHandler(async(req,res)=>{
  await removeGymRecord(db,req.user.id,'student','students',req.params.id,req.body?.version);
  res.json({success:true});
 }));
 return router;
}
export default createStudentsRouter;
