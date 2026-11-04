import * as v from '../lib/validation.js';
import {newsDTO} from '../lib/http.js';
function createRecordWriter(db){
 return async function write(req,res,model,scope,data){
  const id=req.params.id;const version=id?v.version(req.body.version):null;
  const entity=await db.$transaction(async tx=>{
   let saved;
   if(id){const updated=await tx[model].updateMany({where:{id,version},data:{...data,version:{increment:1}}});if(!updated.count){if(!await tx[model].findUnique({where:{id}}))throw new v.HttpError(404,'Запись не найдена.');throw new v.HttpError(409,'Запись уже изменена в другом окне. Перезагрузите страницу, чтобы получить последнюю версию.');}saved=await tx[model].findUnique({where:{id}});}
   else saved=await tx[model].create({data});
   await tx.auditLog.create({data:{actorId:req.user.id,scope,entityId:saved.id,action:id?'update':'create'}});return saved;
  });res.status(id?200:201).json({success:true,entity:scope==='news'?newsDTO(entity):entity});
 }
}
export {createRecordWriter};
