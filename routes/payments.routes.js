import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import * as v from '../lib/validation.js';
import requireOwner from '../middleware/require-owner.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createRecordWriter} from '../services/record.service.js';
function createPaymentsRouter({db,requireAuth,validateOrigin}){
 const router=Router(),write=createRecordWriter(db);router.use(requireAuth,requireOwner);
 router.get('/',asyncHandler(async(_req,res)=>res.json({success:true,payments:await db.payment.findMany({orderBy:{received:'desc'}})})));
 router.get('/:id',asyncHandler(async(req,res)=>{const payment=await db.payment.findUnique({where:{id:req.params.id},include:{revisions:true}});if(!payment)throw new v.HttpError(404,'Платёж не найден.');res.json({success:true,payment});}));
 router.use(validateOrigin,requireCsrf);
 router.post('/',asyncHandler(async(req,res)=>{const data=v.payment(req.body);if(!await db.student.findUnique({where:{id:data.student}}))throw new v.HttpError(422,'Выберите существующего ученика.');return write(req,res,'payment','payments',data);}));
 router.patch('/:id',asyncHandler(async(req,res)=>{
  const data=v.payment(req.body),version=v.version(req.body.version),reason=v.text(req.body.reason,'Причина исправления',2000,true);
  const entity=await db.$transaction(async tx=>{
   const before=await tx.payment.findUnique({where:{id:req.params.id}});if(!before)throw new v.HttpError(404,'Платёж не найден.');
   if(!await tx.student.findUnique({where:{id:data.student}}))throw new v.HttpError(422,'Ученик не найден.');
   const result=await tx.payment.updateMany({where:{id:req.params.id,version},data:{...data,version:{increment:1}}});if(!result.count)throw new v.HttpError(409,'Платёж изменён в другом окне. Обновите страницу; ваши правки ещё не сохранены.');
   await tx.paymentRevision.create({data:{paymentId:before.id,before:JSON.stringify({student:before.student,amount:before.amount,received:before.received,period:before.period,comment:before.comment}),reason,actorId:req.user.id}});
   await tx.auditLog.create({data:{actorId:req.user.id,scope:'payments',entityId:before.id,action:'update'}});
   return tx.payment.findUnique({where:{id:before.id}});
  });res.json({success:true,entity});
 }));

 return router;
}
export default createPaymentsRouter;
