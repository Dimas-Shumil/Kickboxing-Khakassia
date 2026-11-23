import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import {HttpError,version} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
const models={people:['person','people'],news:['news','news'],competitions:['competition','competitions'],history:['historyMaterial','history'],'site/documents':['federationDocument','site-document']};
export default function({db,requireAuth,validateOrigin}){
 const r=Router();
 for(const [route,[model,scope]] of Object.entries(models))r.delete('/'+route+'/:id',requireAuth,validateOrigin,requireCsrf,asyncHandler(async(req,res)=>{
  const expected=version(req.body?.version);
  await db.$transaction(async tx=>{
   const row=await tx[model].findUnique({where:{id:req.params.id}});if(!row)throw new HttpError(404,'Запись не найдена.');
   if(!['OWNER','TRAINER'].includes(req.user.role)&&(row.publishedPayload||model==='federationDocument'))throw new HttpError(403,'Удаление опубликованного материала доступно владельцу и тренерам.');
   const changed=await tx[model].updateMany({where:{id:row.id,version:expected},data:{status:'deleted',publishedPayload:null,publishedOn:null,version:{increment:1}}});
   if(!changed.count)throw new HttpError(409,'Запись изменилась. Обновите список перед удалением.');
   await tx.auditLog.create({data:{actorId:req.user.id,scope,entityId:row.id,action:'delete'}});
  });res.json({success:true});
 }));return r;
}
