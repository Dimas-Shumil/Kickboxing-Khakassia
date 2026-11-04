import path from 'node:path';
import {readFile,unlink,writeFile} from 'node:fs/promises';
import {HttpError,version} from '../lib/validation.js';
import {historyMediaDir,historyDTO,photoUsage} from './history.service.js';
export async function listHistoryMedia(db,id){
 const row=await db.historyMaterial.findUnique({where:{id}});if(!row)throw new HttpError(404,'Материал не найден.');
 const assets=await db.historyAsset.findMany({where:{materialId:id},orderBy:{createdAt:'desc'}});
 return {version:row.version,assets:assets.map(a=>{const src='/media/history/'+a.id,working=photoUsage(row.payload,src),published=photoUsage(row.publishedPayload,src);return {id:a.id,src,size:a.size,working,published,canDelete:!working.length&&!published.length};})};
}
export async function deleteHistoryMedia(db,c,req){
 const expected=version(req.body?.version),id=req.params.id,fileId=req.params.file;
 if(!/^[a-f0-9]{48}\.webp$/.test(fileId))throw new HttpError(404,'Файл не найден.');
 const file=path.join(historyMediaDir(c),fileId);let backup,removed=false;
 try{return await db.$transaction(async tx=>{
  const row=await tx.historyMaterial.findUnique({where:{id}});if(!row)throw new HttpError(404,'Материал не найден.');
  if(row.version!==expected)throw new HttpError(409,'Материал изменён. Сравните данные перед удалением.');
  if(!await tx.historyAsset.findFirst({where:{id:fileId,materialId:id}}))throw new HttpError(404,'Файл не принадлежит материалу.');
  const src='/media/history/'+fileId;
  if(photoUsage(row.payload,src).length||photoUsage(row.publishedPayload,src).length)throw new HttpError(409,'Файл используется в рабочей или опубликованной версии. Уберите его из полей, сохраните изменения и обновите или снимите публикацию.');
  const locked=await tx.historyMaterial.updateMany({where:{id,version:expected},data:{version:{increment:1}}});if(!locked.count)throw new HttpError(409,'Конфликт версии.');
  await tx.historyAsset.delete({where:{id:fileId}});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'history',entityId:id,action:'delete-file'}});
  const saved=await tx.historyMaterial.findUnique({where:{id}});
  try{backup=await readFile(file);}catch(err){if(err.code!=='ENOENT')throw err;}
  try{await unlink(file);removed=true;}catch(err){if(err.code!=='ENOENT')throw err;}
  return historyDTO(saved);
 });}catch(err){if(removed&&backup)try{await writeFile(file,backup,{flag:'wx',mode:0o600});}catch(restoreErr){if(restoreErr.code!=='EEXIST')console.error('History deletion rollback failed:',restoreErr.code);}throw err;}
}
