import {HttpError,version} from '../lib/validation.js';
// Called only behind authentication, gym scope, origin and CSRF middleware.
export async function removeGymRecord(db,actorId,model,scope,id,expectedVersion){
 version(expectedVersion);
 await db.$transaction(async tx=>{
  const old=await tx[model].findUnique({where:{id}});
  if(!old)throw new HttpError(404,'Запись не найдена.');
  const result=await tx[model].updateMany({where:{id,version:expectedVersion},data:{deletedAt:new Date().toISOString(),version:{increment:1}}});
  if(!result.count)throw new HttpError(409,'Запись изменена в другом окне. Обновите страницу перед удалением.');
  await tx.auditLog.create({data:{actorId,scope,entityId:id,action:'delete'}});
 });
}
