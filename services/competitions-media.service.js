import path from 'node:path';
import {readFile,unlink,writeFile} from 'node:fs/promises';
import {HttpError,version} from '../lib/validation.js';
import {competitionMediaDir,competitionDTO} from './competitions.service.js';
export function imageUsage(payload,src){
 if(!payload)return [];
 const p=typeof payload==='string'?JSON.parse(payload):payload;
 return [...(p.image===src?['Обложка']:[]),...['photos','documents','results'].flatMap(key=>(p[key]||[]).flatMap((x,i)=>(x.src||x.url)===src?[(key==='photos'?'Галерея':key==='documents'?'Документы':'Протоколы')+' · '+(i+1)]:[]))];
}
export async function listCompetitionMedia(db,id){
 const person=await db.competition.findUnique({where:{id}});if(!person)throw new HttpError(404,'Соревнование не найдено.');
 const assets=await db.competitionAsset.findMany({where:{competitionId:id},orderBy:{createdAt:'desc'}});
 return {version:person.version,assets:assets.map(a=>{const src='/media/competitions/'+a.id,working=imageUsage(person.payload,src),published=imageUsage(person.publishedPayload,src);return {id:a.id,src,kind:a.kind,size:a.size,createdAt:a.createdAt,working,published,canDelete:!working.length&&!published.length};})};
}
export async function deleteCompetitionMedia(db,config,req){
 const expected=version(req.body?.version),id=req.params.id,fileId=req.params.file;
 if(!/^[a-f0-9]{48}\.(webp|pdf)$/.test(fileId))throw new HttpError(404,'Загрузка не найдена.');
 const file=path.join(competitionMediaDir(config),fileId);let backup=null,removed=false;
 try{return await db.$transaction(async tx=>{
  const person=await tx.competition.findUnique({where:{id}});if(!person)throw new HttpError(404,'Соревнование не найдено.');
  if(person.version!==expected)throw new HttpError(409,'Соревнование изменено в другой вкладке. Перечитайте запись перед удалением файла.');
  if(!await tx.competitionAsset.findFirst({where:{id:fileId,competitionId:id}}))throw new HttpError(404,'Загрузка не найдена у этого соревнования.');
  const src='/media/competitions/'+fileId;
  if(imageUsage(person.payload,src).length||imageUsage(person.publishedPayload,src).length)throw new HttpError(409,'Файл используется в сохранённой или опубликованной версии. Уберите его из всех полей, сохраните изменения и подтвердите публикацию либо снимите соревнование с сайта.');
  // A deletion advances the same version as saves/publications: stale forms cannot reattach this file.
  const lock=await tx.competition.updateMany({where:{id,version:expected},data:{version:{increment:1}}});if(!lock.count)throw new HttpError(409,'Конфликт версии. Перечитайте соревнование.');
  await tx.competitionAsset.delete({where:{id:fileId}});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'competitions',entityId:id,action:'delete-file'}});
  const saved=await tx.competition.findUnique({where:{id}});
  try{backup=await readFile(file);}catch(err){if(err.code!=='ENOENT')throw err;}
  try{await unlink(file);removed=true;}catch(err){if(err.code!=='ENOENT')throw err;}
  return competitionDTO(saved);
 });}catch(error){
  // If the database transaction fails after unlink, restore the unused bytes where possible.
  if(removed&&backup)try{await writeFile(file,backup,{flag:'wx',mode:0o600});}catch(restoreError){if(restoreError.code!=='EEXIST')console.error('Photo deletion rollback failed:',restoreError.code);}
  throw error;
 }
}
