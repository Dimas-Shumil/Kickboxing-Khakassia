import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import * as v from '../lib/validation.js';
import requireGym from '../middleware/require-gym.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createRecordWriter} from '../services/record.service.js';
export default function({db,requireAuth,validateOrigin}){
 const router=Router(),write=createRecordWriter(db);router.use(requireAuth,requireGym);
 router.get('/',asyncHandler(async(req,res)=>{const month=v.period(req.query.month);res.json({success:true,entries:await db.financeEntry.findMany({where:{occurredOn:{startsWith:month}},orderBy:[{occurredOn:'desc'},{id:'asc'}]})});}));
 router.get('/:id',asyncHandler(async(req,res)=>{const entry=await db.financeEntry.findUnique({where:{id:req.params.id}});if(!entry)throw new v.HttpError(404,'Запись не найдена.');res.json({success:true,entry});}));
 router.use(validateOrigin,requireCsrf);
 const data=body=>{
  if(!['income','expense'].includes(body.kind))throw new v.HttpError(422,'Выберите доход или расход.');
  if(!Number.isSafeInteger(body.amount)||body.amount<=0||body.amount>100000000)throw new v.HttpError(422,'Укажите сумму в копейках от 1 до 100 000 000.');
  return {kind:body.kind,amount:body.amount,occurredOn:v.date(body.occurredOn),category:v.text(body.category,'Категория',120,true),comment:v.text(body.comment,'Комментарий',2000)};
 };
 router.post('/',asyncHandler(async(req,res)=>write(req,res,'financeEntry','gym-finances',data(req.body))));
 router.patch('/:id',asyncHandler(async(req,res)=>write(req,res,'financeEntry','gym-finances',data(req.body))));
 return router;
}
