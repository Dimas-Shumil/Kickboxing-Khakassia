import {canPublish} from './permissions.js';
import path from 'node:path';
import {access} from 'node:fs/promises';
import {HttpError,text,date,version} from '../lib/validation.js';

const fail=m=>{throw new HttpError(422,m);};
const sections=['story','chronology','competitions','photos','documents','people'];
const urlOf=id=>'/media/history/'+id;
export const historyMediaDir=c=>c.historyUploadDir||path.join(c.ROOT,'var/history-media');
export const historyDTO=r=>({...JSON.parse(r.payload),id:r.id,version:r.version,status:r.status,slug:r.slug,hasPublished:!!r.publishedPayload,hasChanges:!!r.publishedPayload&&r.payload!==r.publishedPayload});
export const publicHistory=r=>({...JSON.parse(r.publishedPayload),id:r.id,slug:r.slug});
export const publishedHistory=async db=>(await db.historyMaterial.findMany({where:{status:'published',publishedPayload:{not:null}}})).map(publicHistory).sort((a,b)=>(b.date||b.period||'').localeCompare(a.date||a.period||'')||a.title.localeCompare(b.title,'ru'));
const image=s=>{s=text(s,'Фотография',200);if(s&&!/^\/media\/history\/[a-f0-9]{48}\.webp$/.test(s))fail('Недопустимый путь фотографии.');return s;};
function sourceUrl(s){s=text(s,'Ссылка на источник',2000);if(!s)return '';let u;try{u=new URL(s);}catch{fail('Проверьте ссылку на источник.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail('Допустима только обычная HTTP(S) ссылка без логина и пароля.');return s;}
const list=(b,key,max,fn)=>{if(!Array.isArray(b[key])||b[key].length>max)fail('Список '+key+': максимум '+max+'.');return b[key].map(fn);};
export function validateHistory(b,publishing=false){
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Ожидается объект исторического материала.');
 const p={title:text(b.title,'Название',240,true)};
 if(!sections.includes(b.section))fail('Укажите раздел архива.');p.section=b.section;
 if(!['exact','period','unknown'].includes(b.dateType))fail('Укажите точность даты.');p.dateType=b.dateType;
 p.date=b.dateType==='exact'?date(b.date):'';
 p.period=b.dateType==='period'?text(b.period,'Исторический период',120,true):'';
 p.lead=text(b.lead,'Анонс',2500);
 p.body=text(b.body,'Основной текст',60000);
 p.author=text(b.author,'Автор материала',300);
 p.cover=image(b.cover);p.coverAlt=text(b.coverAlt,'Alt обложки',1000);p.coverCaption=text(b.coverCaption,'Подпись обложки',2000);p.coverCredit=text(b.coverCredit,'Авторство обложки',1000);
 p.gallery=list(b,'gallery',50,x=>{if(!x||typeof x!=='object'||Array.isArray(x))fail('Проверьте фотографии галереи.');const src=image(x.src);if(!src)fail('Выберите фотографию.');return {src,alt:text(x.alt,'Alt фото',1000),caption:text(x.caption,'Подпись фото',2000),credit:text(x.credit,'Автор / права фото',1000)};});
 p.sources=list(b,'sources',30,x=>{if(!x||typeof x!=='object'||Array.isArray(x))fail('Проверьте источник.');return {title:text(x.title,'Название источника',300,true),url:sourceUrl(x.url),note:text(x.note,'Описание источника',1500)};});
 p.people=list(b,'people',100,x=>text(x,'Профиль человека',100,true));
 p.competitions=list(b,'competitions',100,x=>text(x,'Соревнование',100,true));
 for(const k of ['people','competitions'])if(new Set(p[k]).size!==p[k].length)fail('Повторяются связанные записи.');
 p.detail=b.detail===true;
 if(publishing&&(!p.lead||!p.body))fail('Для публикации заполните анонс и текст.');
 return p;
}
export const historyFiles=p=>[p.cover,...p.gallery.map(x=>x.src)].filter(Boolean);
export async function checkHistory(db,c,p,id){
 for(const src of historyFiles(p)){const name=path.basename(src);if(!await db.historyAsset.findFirst({where:{id:name,materialId:id||''}}))fail('Файл не принадлежит этому материалу.');try{await access(path.join(historyMediaDir(c),name));}catch{fail('Файл отсутствует. Загрузите его снова.');}}
 for(const personId of p.people)if(!await db.person.findUnique({where:{id:personId}}))fail('Связанный публичный профиль не найден.');
 for(const competitionId of p.competitions)if(!await db.competition.findUnique({where:{id:competitionId}}))fail('Связанное соревнование не найдено.');
}
export function createHistoryWriter(db,c){return async(req,action)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))fail('Ожидается JSON-объект.');
 return db.$transaction(async tx=>{
  const id=req.params.id,expected=id?version(req.body.version):null,old=id?await tx.historyMaterial.findUnique({where:{id}}):null;
  if(id&&!old)throw new HttpError(404,'Исторический материал не найден.');
  if(old&&old.version!==expected)throw new HttpError(409,'Материал изменён в другой вкладке. Ваши правки остались в форме. Сравните версии перед повторным сохранением.');
  let data;
  if(action==='save'){
   if(old?.status==='archived')fail('Сначала восстановите материал из архива.');
   if(req.body.status&&req.body.status!==old?.status&&req.body.status!=='draft')fail('Смена статуса допускается только отдельным действием.');
   const p=validateHistory(req.body);await checkHistory(tx,c,p,id);data={title:p.title,payload:JSON.stringify(p)};
  }else{
   if(!old)throw new HttpError(404,'Материал не найден.');
   if(['publish','unpublish'].includes(action)&&!canPublish(req.user))throw new HttpError(403,'Публиковать и снимать с публикации могут владелец и тренеры.');
   if(action==='publish'){
    if(old.status==='archived')fail('Сначала восстановите материал.');
    const p=validateHistory(JSON.parse(old.payload),true);await checkHistory(tx,c,p,id);
    data={status:'published',publishedPayload:JSON.stringify(p),slug:old.slug||'archive-'+old.id,publishedOn:new Date()};
   }else if(action==='unpublish'){
    if(old.status!=='published')fail('Материал уже снят с публикации.');data={status:'draft',publishedPayload:null};
   }else if(action==='archive'){
    if(old.status==='archived')fail('Материал уже в архиве.');
    if(old.publishedPayload&&!canPublish(req.user))throw new HttpError(403,'Архивирование опубликованного материала доступно владельцу и тренерам.');
    data={status:'archived',publishedPayload:null};
   }else if(action==='restore'){
    if(old.status!=='archived')fail('Материал не находится в архиве.');data={status:'draft',publishedPayload:null};
   }else throw new HttpError(404,'Действие не найдено.');
  }
  let saved;
  if(old){const changed=await tx.historyMaterial.updateMany({where:{id,version:expected},data:{...data,version:{increment:1}}});if(!changed.count)throw new HttpError(409,'Конфликт версии.');saved=await tx.historyMaterial.findUnique({where:{id}});}
  else saved=await tx.historyMaterial.create({data});
  await tx.auditLog.create({data:{scope:'history',entityId:saved.id,action,actorId:req.user.id}});
  return saved;
 });
};}
export function photoUsage(payload,src){if(!payload)return [];const p=typeof payload==='string'?JSON.parse(payload):payload;return [...(p.cover===src?['Обложка раздела и материала']:[]),...(p.gallery||[]).flatMap((x,i)=>x.src===src?['Галерея · фото '+(i+1)]:[])];}
