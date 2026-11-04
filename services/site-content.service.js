import path from 'node:path';
import {access} from 'node:fs/promises';
import {HttpError,text,version,date} from '../lib/validation.js';

const error=message=>{throw new HttpError(422,message);};
export const pageKeys=['home','federation','contacts'];
export const siteMediaDir=c=>c.siteUploadDir||path.join(c.ROOT,'var/site-media');
export const ownerPage=k=>'page:'+k;
export const ownerDocument=id=>'document:'+id;
export const emptyPage=key=>key==='home'?{subtitle:'',ctaTitle:'',ctaText:'',heroImage:'',ctaImage:''}:key==='contacts'?{heroTitle:'',heroLead:'',phone:'',email:'',address:'',hours:'',latitude:'',longitude:'',socials:[]}:{heroTitle:'',heroLead:'',heroImage:'',intro:'',activities:[],leaders:[],clubs:[]};
const list=(val,key,max,parse)=>{if(!Array.isArray(val)||val.length>max)error('Поле '+key+': максимум '+max+' записей.');return val.map(parse);};
function httpsUrl(v,name){v=text(v,name,1800);if(!v)return '';let u;try{u=new URL(v);}catch{error('Неверный адрес: '+name);}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)error('Для '+name+' допустимы только ссылки HTTP(S) без логина и пароля.');return v;}
function asset(v,kind){v=text(v,'Файл',255);if(v&&!new RegExp('^/media/site/[a-f0-9]{48}\\.'+(kind==='pdf'?'pdf':'webp')+'$').test(v))error('Недопустимый путь файла.');return v;}
function coordinates(v,min,max,label){v=text(v,label,30);if(!v)return '';if(!/^-?\d{1,3}(?:\.\d{1,7})?$/.test(v)||Number(v)<min||Number(v)>max)error('Неверные координаты '+label+'.');return v;}
export function validatePage(key,b){
 if(!pageKeys.includes(key))throw new HttpError(404,'Страница не найдена.');
 if(!b||typeof b!=='object'||Array.isArray(b))error('Неверный формат страницы.');
 if(key==='home')return {subtitle:text(b.subtitle,'Подзаголовок главной',1000),ctaTitle:text(b.ctaTitle,'Заголовок приглашения',180),ctaText:text(b.ctaText,'Текст приглашения',1400),heroImage:asset(b.heroImage,'image'),ctaImage:asset(b.ctaImage,'image')};
 if(key==='contacts'){const p={heroTitle:text(b.heroTitle,'Заголовок',180),heroLead:text(b.heroLead,'Введение',1400),phone:text(b.phone,'Телефон',100),email:validateMail(text(b.email,'Почта',255)),address:text(b.address,'Адрес',500),hours:text(b.hours,'Часы работы',400),latitude:coordinates(b.latitude,-90,90,'широта'),longitude:coordinates(b.longitude,-180,180,'долгота'),socials:list(b.socials,'соцсети',12,s=>({name:text(s?.name,'Название сети',120,true),url:httpsUrl(s?.url,'Ссылка соцсети')}))};if(p.socials.some(s=>!s.url))error('Укажите ссылку социальной сети.');if(Boolean(p.latitude)!==Boolean(p.longitude))error('Укажите обе координаты для карты.');return p;}
 return {heroTitle:text(b.heroTitle,'Заголовок',180),heroLead:text(b.heroLead,'Введение',1400),heroImage:asset(b.heroImage,'image'),intro:text(b.intro,'Описание',5000),activities:list(b.activities,'направления',12,a=>({title:text(a?.title,'Направление',180,true),body:text(a?.body,'Описание направления',1800)})),leaders:list(b.leaders,'руководство',30,a=>({name:text(a?.name,'ФИО руководителя',180,true),position:text(a?.position,'Должность',220),bio:text(a?.bio,'Описание',1800),image:asset(a?.image,'image'),alt:text(a?.alt,'Alt фотографии',500),credit:text(a?.credit,'Автор фотографии',300)})),clubs:list(b.clubs,'клубы',60,a=>({name:text(a?.name,'Название клуба',180,true),city:text(a?.city,'Населённый пункт',180),address:text(a?.address,'Адрес',350),contact:text(a?.contact,'Контакт',300)}))};
}
function validateMail(v){if(v&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v))error('Укажите корректную почту.');return v;}
export function validateDocument(b){
 if(!b||typeof b!=='object'||Array.isArray(b))error('Неверный формат документа.');
 return {title:text(b.title,'Название документа',240,true),category:choice(b.category,['Федерация','Положения','Правила','Регистрация','Прочее'],'категория'),date:b.date?date(b.date):'',description:text(b.description,'Описание',5000),author:text(b.author,'Автор / ведомство',300),source:httpsUrl(b.source,'Источник'),file:asset(b.file,'pdf')};
}
function choice(v,allowed,label){if(!allowed.includes(v))error('Укажите '+label+'.');return v;}
export function usedPageFiles(p){return [p.heroImage,p.ctaImage,...(p.leaders||[]).map(x=>x.image)].filter(Boolean);}
export function usedDocumentFiles(p){return p.file?[p.file]:[];}
export async function checkFiles(db,c,owner,paths){
 for(const src of paths){const id=path.basename(src),asset=await db.siteAsset.findFirst({where:{id,ownerKey:owner}});if(!asset)error('Файл не принадлежит этой записи.');try{await access(path.join(siteMediaDir(c),id));}catch{error('Указанный файл не найден на диске.');}}
}
export const pageDTO=(r,key)=>({...emptyPage(key),...(r?JSON.parse(r.payload):{}),key,version:r?.version||0,hasPublished:!!r?.publishedPayload,hasChanges:!!r?.publishedPayload&&r.payload!==r.publishedPayload,publishedOn:r?.publishedOn||null});
export const docDTO=r=>({...JSON.parse(r.payload),id:r.id,status:r.status,version:r.version,hasPublished:!!r.publishedPayload,hasChanges:!!r.publishedPayload&&r.payload!==r.publishedPayload});
export const publishedPage=async(db,key)=>{const r=await db.sitePage.findUnique({where:{key}});return r?.publishedPayload?JSON.parse(r.publishedPayload):null;};
export const publishedDocuments=async db=>(await db.federationDocument.findMany({where:{status:'published',publishedPayload:{not:null}}})).map(r=>({...JSON.parse(r.publishedPayload),id:r.id})).sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title,'ru'));
const conflict=()=>{throw new HttpError(409,'Запись была изменена в другой вкладке. Данные в форме сохранены; сравните версии перед повторением.');};
function mapConcurrency(err){if(['P2002','P2034','P2028'].includes(err?.code))conflict();throw err;}
export function siteWriter(db,c){
 return async(req,key,action)=>db.$transaction(async tx=>{
  if(!pageKeys.includes(key))throw new HttpError(404,'Страница не найдена.');
  const old=await tx.sitePage.findUnique({where:{key}}),expected=req.body?.version;
  if(old?version(expected)!==old.version:expected!==0)conflict();
  let data;
  if(action==='save'){
   const p=validatePage(key,req.body);await checkFiles(tx,c,ownerPage(key),usedPageFiles(p));data={payload:JSON.stringify(p)};
  }else{
   if(!old)throw new HttpError(422,'Сначала сохраните рабочую версию.');
   if(req.user.role!=='OWNER')throw new HttpError(403,'Публикацией управляет только владелец.');
   if(action==='publish'){const p=validatePage(key,JSON.parse(old.payload));await checkFiles(tx,c,ownerPage(key),usedPageFiles(p));data={publishedPayload:old.payload,publishedOn:new Date()};}
   else if(action==='unpublish')data={publishedPayload:null};else throw new HttpError(404,'Действие не найдено.');
  }
  const updated=old?await tx.sitePage.updateMany({where:{key,version:old.version},data:{...data,version:{increment:1}}}):null;
  if(old&&!updated.count)conflict();
  const row=old?await tx.sitePage.findUnique({where:{key}}):await tx.sitePage.create({data:{key,...data}});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'site-page',entityId:key,action}});
  return pageDTO(row,key);
 }).catch(mapConcurrency);
}
export function documentWriter(db,c){return async(req,id,action)=>db.$transaction(async tx=>{
 const old=id?await tx.federationDocument.findUnique({where:{id}}):null;
 if(id&&!old)throw new HttpError(404,'Документ не найден.');
 if(old&&version(req.body?.version)!==old.version)conflict();
 let data;
 if(action==='save'){
  if(old?.status==='archived')error('Восстановите документ из архива перед редактированием.');
  const p=validateDocument(req.body);await checkFiles(tx,c,ownerDocument(id),usedDocumentFiles(p));data={title:p.title,payload:JSON.stringify(p)};
 }else{
  if(!old)throw new HttpError(404,'Документ не найден.');
  if(['publish','unpublish'].includes(action)&&req.user.role!=='OWNER')throw new HttpError(403,'Публикацией управляет только владелец.');
  if(action==='publish'){
   if(old.status==='archived')error('Восстановите документ из архива.');const p=validateDocument(JSON.parse(old.payload));if(!p.file)error('Для публикации необходимо прикрепить PDF.');await checkFiles(tx,c,ownerDocument(id),usedDocumentFiles(p));data={publishedPayload:old.payload,status:'published',publishedOn:new Date()};
  }else if(action==='unpublish'){if(old.status!=='published')error('Документ уже снят.');data={publishedPayload:null,status:'draft'};}
  else if(action==='archive'){if(old.status==='archived')error('Документ уже в архиве.');if(old.publishedPayload&&req.user.role!=='OWNER')throw new HttpError(403,'Архивирование опубликованного документа подтверждает владелец.');data={publishedPayload:null,status:'archived'};}
  else if(action==='restore'){if(old.status!=='archived')error('Документ не в архиве.');data={status:'draft',publishedPayload:null};}else throw new HttpError(404,'Действие не найдено.');
 }
 let row;
 if(old){const updated=await tx.federationDocument.updateMany({where:{id,version:old.version},data:{...data,version:{increment:1}}});if(!updated.count)conflict();row=await tx.federationDocument.findUnique({where:{id}});}
 else row=await tx.federationDocument.create({data});
 await tx.auditLog.create({data:{actorId:req.user.id,scope:'site-document',entityId:row.id,action}});
 return docDTO(row);
 }).catch(mapConcurrency);}
export function usageOf(row,src){const w=row?.payload?JSON.parse(row.payload):{},p=row?.publishedPayload?JSON.parse(row.publishedPayload):{};const files=obj=>[obj.heroImage,obj.ctaImage,...(obj.leaders||[]).map(x=>x.image),obj.file].filter(Boolean);return {working:files(w).includes(src),published:files(p).includes(src)};}
// Точные подписи мест использования для медиатеки, без раскрытия неопубликованных данных наружу.
export function siteAssetLocations(payload,src){
 if(!payload)return [];
 const p=typeof payload==='string'?JSON.parse(payload):payload;
 const labels=[];
 if(p.heroImage===src)labels.push('Фон Hero');
 if(p.ctaImage===src)labels.push('Фото нижнего приглашения');
 for(const leader of p.leaders||[])if(leader.image===src)labels.push('Руководство: '+leader.name);
 if(p.file===src)labels.push('PDF документа');
 return labels;
}
