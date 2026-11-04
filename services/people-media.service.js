import path from 'node:path';
import {readFile,unlink,writeFile} from 'node:fs/promises';
import {HttpError,version} from '../lib/validation.js';
import {peopleMediaDir,personDTO} from './people.service.js';
export function imageUsage(payload,src){
 if(!payload)return [];
 const p=typeof payload==='string'?JSON.parse(payload):payload;
 return [...[['portrait','Основной портрет'],['coachPortrait','Фото тренера'],['storyImage','Фото биографии'],['hallHoverPhoto','Второе фото карточки легенды (наведение)']].filter(([key])=>p[key]===src).map(([,label])=>label),...(p.gallery||[]).flatMap((g,i)=>g.src===src?['Галерея · фото '+(i+1)+(g.caption?' · '+g.caption:'')]:[])];
}
export async function listPersonMedia(db,id){
 const person=await db.person.findUnique({where:{id}});if(!person)throw new HttpError(404,'Человек не найден.');
 const assets=await db.personAsset.findMany({where:{personId:id},orderBy:{createdAt:'desc'}});
 return {version:person.version,assets:assets.map(a=>{const src='/media/people/'+a.id,working=imageUsage(person.payload,src),published=imageUsage(person.publishedPayload,src);return {id:a.id,src,size:a.size,createdAt:a.createdAt,working,published,canDelete:!working.length&&!published.length};})};
}
export async function deletePersonMedia(db,config,req){
 const expected=version(req.body?.version),id=req.params.id,fileId=req.params.file;
 if(!/^[a-f0-9]{48}\.webp$/.test(fileId))throw new HttpError(404,'Загрузка не найдена.');
 const file=path.join(peopleMediaDir(config),fileId);let backup=null,removed=false;
 try{return await db.$transaction(async tx=>{
  const person=await tx.person.findUnique({where:{id}});if(!person)throw new HttpError(404,'Человек не найден.');
  if(person.version!==expected)throw new HttpError(409,'Профиль изменён в другой вкладке. Перечитайте запись перед удалением файла.');
  if(!await tx.personAsset.findFirst({where:{id:fileId,personId:id}}))throw new HttpError(404,'Загрузка не найдена у этого человека.');
  const src='/media/people/'+fileId;
  if(imageUsage(person.payload,src).length||imageUsage(person.publishedPayload,src).length)throw new HttpError(409,'Фото используется в сохранённой или опубликованной версии. Уберите его из всех полей, сохраните изменения и подтвердите публикацию либо снимите профиль с сайта.');
  // A deletion advances the same version as saves/publications: stale forms cannot reattach this file.
  const lock=await tx.person.updateMany({where:{id,version:expected},data:{version:{increment:1}}});if(!lock.count)throw new HttpError(409,'Конфликт версии. Перечитайте профиль.');
  await tx.personAsset.delete({where:{id:fileId}});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'people',entityId:id,action:'delete-photo'}});
  const saved=await tx.person.findUnique({where:{id}});
  try{backup=await readFile(file);}catch(err){if(err.code!=='ENOENT')throw err;}
  try{await unlink(file);removed=true;}catch(err){if(err.code!=='ENOENT')throw err;}
  return personDTO(saved);
 });}catch(error){
  // If the database transaction fails after unlink, restore the unused bytes where possible.
  if(removed&&backup)try{await writeFile(file,backup,{flag:'wx',mode:0o600});}catch(restoreError){if(restoreError.code!=='EEXIST')console.error('Photo deletion rollback failed:',restoreError.code);}
  throw error;
 }
}
