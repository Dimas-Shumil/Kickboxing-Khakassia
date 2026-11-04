import path from 'node:path';
import {access} from 'node:fs/promises';
import * as v from '../lib/validation.js';
export const mediaDir=config=>config.uploadDir||path.join(config.ROOT,'var/news-media');
export const publicNews=n=>({...JSON.parse(n.publishedPayload),id:n.id,slug:n.slug,body:[{heading:'',text:JSON.parse(n.publishedPayload).text}],related:[],isDemo:false});
export async function publishedNews(db){return (await db.news.findMany({where:{status:'published',publishedPayload:{not:null}},orderBy:{publishedOn:'desc'}})).map(publicNews).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));}
export async function checkImages(db,config,payload,newsId){
 for(const src of [payload.cover,...payload.gallery.map(g=>g.src)].filter(Boolean)){
  let file;
  if(src.startsWith('/media/news/')){
   const id=path.basename(src);if(!await db.newsAsset.findFirst({where:{id,newsId}}))throw new v.HttpError(422,'Изображение не принадлежит этой новости.');
   file=path.join(mediaDir(config),id);
  }else file=path.join(config.ROOT,src.slice(1));
  try{await access(file);}catch{throw new v.HttpError(422,'Файл изображения отсутствует. Загрузите его повторно.');}
 }
}
export function createNewsService(db,config){
 return async(req,action)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw new v.HttpError(422,'Ожидается JSON-объект новости или версии.');
 return db.$transaction(async tx=>{
  const id=req.params.id,expected=id?v.version(req.body.version):null;
  const old=id?await tx.news.findUnique({where:{id}}):null;
  if(id&&!old)throw new v.HttpError(404,'Новость не найдена.');
  if(old&&old.version!==expected)throw new v.HttpError(409,'Новость уже изменена. Откройте актуальную версию в другой вкладке и перенесите правки.');
  let data;
  if(action==='save'){
   const valid=v.news(req.body);await checkImages(tx,config,JSON.parse(valid.payload),id||'');
   if(old?.status==='archived')throw new v.HttpError(422,'Сначала восстановите новость из архива.');
   if(valid.status==='archived'){
    if(old?.publishedPayload&&req.user.role!=='OWNER')throw new v.HttpError(403,'Архив опубликованной новости доступен владельцу.');
    data={...valid,publishedPayload:null};
   }else data={...valid,status:old?.status||'draft'};
  }else{
   if(req.user.role!=='OWNER'&&(['publish','unpublish'].includes(action)||(action==='archive'&&old.publishedPayload)))throw new v.HttpError(403,'Публикацию и снятие подтверждает владелец.');
   if(action==='publish'){
    if(old.status==='archived')throw new v.HttpError(422,'Сначала восстановите новость из архива.');
    const payload=JSON.parse(old.payload);v.news({...payload,status:'draft'});await checkImages(tx,config,payload,id);
    data={status:'published',publishedPayload:old.payload,publishedOn:new Date(),slug:old.slug||'post-'+old.id};
   }else if(action==='unpublish'){
    if(old.status!=='published')throw new v.HttpError(422,'Новость уже снята с публикации.');
    data={status:'draft',publishedPayload:null};
   }else if(action==='archive'){
    if(old.status==='archived')throw new v.HttpError(422,'Новость уже в архиве.');
    data={status:'archived',publishedPayload:null};
   }else if(action==='restore'){
    if(old.status!=='archived')throw new v.HttpError(422,'Новость не в архиве.');
    data={status:'draft',publishedPayload:null};
   }else throw new v.HttpError(404,'Действие не найдено.');
  }
  let saved;
  if(old){const updated=await tx.news.updateMany({where:{id,version:expected},data:{...data,version:{increment:1}}});if(!updated.count)throw new v.HttpError(409,'Конфликт версии. Перечитайте новость.');saved=await tx.news.findUnique({where:{id}});}
  else saved=await tx.news.create({data});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'news',entityId:saved.id,action}});return saved;
 });
 };
}
