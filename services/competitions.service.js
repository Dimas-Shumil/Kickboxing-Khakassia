import path from 'node:path';
import {access} from 'node:fs/promises';
import {HttpError,text,date,version} from '../lib/validation.js';
const fail=m=>{throw new HttpError(422,m);};
export const competitionMediaDir=c=>c.competitionUploadDir||path.join(c.ROOT,'var/competition-media');
export const competitionDTO=r=>({...JSON.parse(r.payload),id:r.id,status:r.status,slug:r.slug,version:r.version,hasPublished:!!r.publishedPayload,hasChanges:!!r.publishedPayload&&r.payload!==r.publishedPayload});
export const publicCompetition=r=>({...JSON.parse(r.publishedPayload),id:r.id,slug:r.slug});
export async function publishedCompetitions(db){return (await db.competition.findMany({where:{status:'published',publishedPayload:{not:null}}})).map(publicCompetition).sort((a,b)=>a.startDate.localeCompare(b.startDate));}
export function validateCompetition(b,publishing=false){
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Ожидается объект соревнования.');
 const d={title:text(b.title,'Название',240,true)};
 for(const k of ['lead','location','organizer','imageAlt','imageCaption','imageCredit'])d[k]=text(b[k],k,k==='lead'?1500:1000);
 for(const k of ['description','resultsText'])d[k]=text(b[k],k,25000);
 for(const k of ['startDate','endDate'])d[k]=b[k]==null||b[k]===''?'':date(b[k]);
 if(d.startDate&&d.endDate&&d.endDate<d.startDate)fail('Окончание не может быть раньше начала.');
 if(!['upcoming','completed'].includes(b.eventStatus))fail('Выберите состояние соревнования.');d.eventStatus=b.eventStatus;
 const media=(s,ext)=>{s=text(s,'Файл',200);if(s&&!new RegExp('^/media/competitions/[a-f0-9]{48}\\.'+ext+'$').test(s))fail('Недопустимый файл.');return s;};
 d.image=media(b.image,'webp');
 const list=(key,max,fn)=>{if(!Array.isArray(b[key])||b[key].length>max)fail('Список '+key+': максимум '+max+'.');return b[key].map(fn);};
 d.disciplines=list('disciplines',20,x=>text(x,'Дисциплина',150,true));
 const obj=x=>{if(!x||typeof x!=='object'||Array.isArray(x))fail('Проверьте строку списка.');return x;};
 d.program=list('program',50,x=>{obj(x);return {time:text(x.time,'Время / дата',100),title:text(x.title,'Пункт программы',300,true),description:text(x.description,'Описание',2000)};});
 const document=x=>{obj(x);const url=media(x.url,'pdf');if(!url)fail('Выберите PDF.');return {title:text(x.title,'Название документа',300,true),url};};
 d.documents=list('documents',20,document);d.results=list('results',20,document);
 d.photos=list('photos',50,x=>{obj(x);const src=media(x.src,'webp');if(!src)fail('Выберите фото.');return {src,alt:text(x.alt,'Alt',1000),caption:text(x.caption,'Подпись',2000),credit:text(x.credit,'Автор',1000),category:text(x.category,'Категория',100)};});
 d.participants=list('participants',100,x=>text(x,'Публичный профиль',100,true));
 if(new Set(d.participants).size!==d.participants.length)fail('Участник повторяется.');
 if(publishing&&(!d.startDate||!d.endDate||!d.location||!d.description||!d.disciplines.length))fail('Для публикации заполните обе даты, место, описание и дисциплины.');
 return d;
}
export const competitionFiles=p=>[p.image,...p.photos.map(x=>x.src),...p.documents.map(x=>x.url),...p.results.map(x=>x.url)].filter(Boolean);
export async function checkCompetitionFiles(db,config,p,id){
 for(const src of competitionFiles(p)){const key=path.basename(src);if(!await db.competitionAsset.findFirst({where:{id:key,competitionId:id||''}}))fail('Файл не принадлежит этому соревнованию.');try{await access(path.join(competitionMediaDir(config),key));}catch{fail('Файл отсутствует. Загрузите его снова.');}}
 for(const personId of p.participants)if(!await db.person.findUnique({where:{id:personId}}))fail('Публичный профиль участника не найден. Ученики зала здесь не используются.');
}
export function createCompetitionWriter(db,config){return async(req,action)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))fail('Ожидается JSON-объект.');
 return db.$transaction(async tx=>{
  const id=req.params.id,expected=id?version(req.body.version):null,old=id?await tx.competition.findUnique({where:{id}}):null;
  if(id&&!old)throw new HttpError(404,'Соревнование не найдено.');
  if(old&&old.version!==expected)throw new HttpError(409,'Соревнование уже изменено. Откройте актуальную запись в другой вкладке и перенесите правки.');
  let data;
  if(action==='save'){
   if(old?.status==='archived')fail('Сначала восстановите соревнование.');
   if(req.body.status&&!['draft','published'].includes(req.body.status))fail('Состояние изменяется отдельным действием.');
   if(req.body.status==='published'&&!old?.publishedPayload)fail('Публикацию подтверждает владелец.');
   const p=validateCompetition(req.body);await checkCompetitionFiles(tx,config,p,id);data={title:p.title,payload:JSON.stringify(p)};
  }else{
   if(!old)throw new HttpError(404,'Соревнование не найдено.');
   if(req.user.role!=='OWNER'&&(['publish','unpublish'].includes(action)||(action==='archive'&&old.publishedPayload)))throw new HttpError(403,'Публикацию и снятие подтверждает владелец.');
   if(action==='publish'){
    if(old.status==='archived')fail('Сначала восстановите соревнование.');
    const p=validateCompetition(JSON.parse(old.payload),true);await checkCompetitionFiles(tx,config,p,id);
    data={status:'published',publishedPayload:JSON.stringify(p),slug:old.slug||'event-'+old.id,publishedOn:new Date()};
   }else if(action==='unpublish'){if(old.status!=='published')fail('Соревнование уже снято.');data={status:'draft',publishedPayload:null};}
   else if(action==='archive'){if(old.status==='archived')fail('Соревнование уже в архиве.');data={status:'archived',publishedPayload:null};}
   else if(action==='restore'){if(old.status!=='archived')fail('Соревнование не в архиве.');data={status:'draft',publishedPayload:null};}
   else throw new HttpError(404,'Действие не найдено.');
  }
  let saved;
  if(old){const result=await tx.competition.updateMany({where:{id,version:expected},data:{...data,version:{increment:1}}});if(!result.count)throw new HttpError(409,'Конфликт версии. Перечитайте соревнование.');saved=await tx.competition.findUnique({where:{id}});}else saved=await tx.competition.create({data});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'competitions',entityId:saved.id,action}});return saved;
 });
};}
