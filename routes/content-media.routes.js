import {Router} from 'express';
import path from 'node:path';
import {unlink} from 'node:fs/promises';
import {asyncHandler} from '../lib/http.js';
import {HttpError,version} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {mediaDir} from '../services/news.service.js';
import {peopleMediaDir} from '../services/people.service.js';
import {competitionMediaDir} from '../services/competitions.service.js';
import {historyMediaDir} from '../services/history.service.js';
const types={news:['newsAsset','news','newsId',mediaDir],people:['personAsset','person','personId',peopleMediaDir],competitions:['competitionAsset','competition','competitionId',competitionMediaDir],history:['historyAsset','historyMaterial','materialId',historyMediaDir]};
const used=(row,src)=>!!row&&[row.payload,row.publishedPayload].some(p=>p&&p.includes(src));
export default function({db,config,requireAuth,validateOrigin}){
 const r=Router();
 r.get('/content-media',requireAuth,asyncHandler(async(_req,res)=>{
  const files=[];
  for(const [kind,[asset,model,key]] of Object.entries(types)){
   const [assets,rows]=await Promise.all([db[asset].findMany({orderBy:{createdAt:'desc'}}),db[model].findMany()]);const parents=new Map(rows.map(x=>[x.id,x]));
   for(const a of assets){const row=parents.get(a[key]),src='/media/'+kind+'/'+a.id;files.push({id:a.id,kind,parentId:a[key],title:row?.name||row?.title||'Удалённая запись',version:row?.version||0,size:a.size,image:!a.id.endsWith('.pdf'),preview:'/api/admin/'+kind+'/media/'+a.id,canDelete:!used(row,src)});}
  }res.json({success:true,files});
 }));
 r.delete('/content-media/:kind/:id',requireAuth,validateOrigin,requireCsrf,asyncHandler(async(req,res)=>{
  if(!['OWNER','TRAINER'].includes(req.user.role))throw new HttpError(403,'Удалять файлы могут владелец и тренеры.');
  const type=types[req.params.kind];if(!type||! /^[a-f0-9]{48}\.(webp|pdf)$/.test(req.params.id))throw new HttpError(404,'Файл не найден.');
  const [asset,model,key,dir]=type;
  await db.$transaction(async tx=>{
   const a=await tx[asset].findUnique({where:{id:req.params.id}});if(!a)throw new HttpError(404,'Файл не найден.');
   const row=await tx[model].findUnique({where:{id:a[key]}});
   if(row){if(row.version!==version(req.body?.version))throw new HttpError(409,'Запись изменилась. Обновите медиатеку.');if(used(row,'/media/'+req.params.kind+'/'+a.id))throw new HttpError(409,'Файл используется. Уберите его из материала и сохраните изменения.');
    const lock=await tx[model].updateMany({where:{id:row.id,version:row.version},data:{version:{increment:1}}});if(!lock.count)throw new HttpError(409,'Запись изменилась.');}
   await tx[asset].delete({where:{id:a.id}});await tx.auditLog.create({data:{actorId:req.user.id,scope:req.params.kind,entityId:a[key],action:'delete-file'}});
  });
  await unlink(path.join(dir(config),req.params.id)).catch(e=>{if(e.code!=='ENOENT')console.error('Не удалось очистить файл:',e.code);});
  res.json({success:true});
 }));return r;
}
