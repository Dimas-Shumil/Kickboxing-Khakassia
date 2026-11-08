import path from 'node:path';
import {access} from 'node:fs/promises';
import {HttpError,text,version} from '../lib/validation.js';
const fail=message=>{throw new HttpError(422,message);};
export const peopleMediaDir=config=>config.peopleUploadDir||path.join(config.ROOT,'var/people-media');
export const profileType=(p,role=p.primaryRole)=>role==='athlete'?(p.athleteLegend?'athlete':'athlete-profile'):(p.coachLegend?'coach-legend':'coach-profile');
export const personDTO=p=>({...JSON.parse(p.payload),id:p.id,status:p.status,version:p.version,slug:p.slug,hasPublished:!!p.publishedPayload,hasChanges:!!p.publishedPayload&&p.payload!==p.publishedPayload});
export const publicPerson=p=>({...JSON.parse(p.publishedPayload),id:p.id,slug:p.slug});
export const comparePeople=(a,b)=>(a.sortOrder??1000)-(b.sortOrder??1000)||a.name.localeCompare(b.name,'ru');
export async function publishedPeople(db){return (await db.person.findMany({where:{status:'published',publishedPayload:{not:null}},orderBy:{name:'asc'}})).map(publicPerson).sort(comparePeople);}
export function validatePerson(b,publishing=false){
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Ожидается объект профиля.');
 const d={name:text(b.name,'ФИО',180,true)};
 d.sortOrder=b.sortOrder===undefined?1000:b.sortOrder;
 if(!Number.isInteger(d.sortOrder)||d.sortOrder<0||d.sortOrder>999999)fail('Порядок отображения: целое число от 0 до 999999.');
 for(const key of ['isAthlete','isCoach','athleteLegend','coachLegend']){if(typeof b[key]!=='boolean')fail('Проверьте роли и статусы легенды.');d[key]=b[key];}
 if(!d.isAthlete&&!d.isCoach)fail('Выберите хотя бы одну роль.');
 if((d.athleteLegend&&!d.isAthlete)||(d.coachLegend&&!d.isCoach))fail('Статус легенды требует соответствующей роли.');
 if(!['athlete','coach'].includes(b.primaryRole)||!(b.primaryRole==='athlete'?d.isAthlete:d.isCoach))fail('Основной профиль должен соответствовать одной из ролей.');
 d.primaryRole=b.primaryRole;
 if(b.showOnHome!=null&&typeof b.showOnHome!=='boolean')fail('Проверьте показ на главной.');d.showOnHome=b.showOnHome===true;if(d.showOnHome&&!d.isAthlete)fail('Блок спортсменов главной требует спортивной роли.');
 for(const key of ['summary','city','club','portraitAlt','photoCredit','storyCaption','athleteTitle','discipline','athleteStatus','trainer','coachTitle','specialization','experience'])d[key]=text(b[key],key,key==='summary'?1000:500);
 for(const key of ['quote','athleteQuote','coachQuote','methodQuote'])d[key]=text(b[key],key,2000);
 for(const key of ['bio','athleteBio','coachBio','school'])d[key]=text(b[key],key,25000);
 const image=value=>{const src=text(value,'Изображение',300);if(src&&!/^\/site\/img\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|gif)$/.test(src)&&!/^\/media\/people\/[a-f0-9]{48}\.webp$/.test(src))fail('Недопустимый путь изображения.');return src;};
 for(const key of ['portrait','coachPortrait','storyImage','hallHoverPhoto'])d[key]=image(b[key]);
 const list=(key,max,fn)=>{if(!Array.isArray(b[key])||b[key].length>max)fail('Проверьте список '+key+' (максимум '+max+').');return b[key].map(x=>{if(!x||typeof x!=='object'||Array.isArray(x))fail('Проверьте строку списка.');return fn(x);});};
 const award=x=>({date:text(x.date,'Дата или период',100),title:text(x.title,'Заголовок',240,true),text:text(x.text,'Описание',3000),place:text(x.place,'Место',100)});
 d.athleteAwards=list('athleteAwards',40,award);d.coachAwards=list('coachAwards',40,award);
 d.methods=list('methods',12,x=>({title:text(x.title,'Принцип',240,true),text:text(x.text,'Описание',3000)}));
 d.timeline=list('timeline',40,x=>{if(!['all','athlete','coach'].includes(x.role))fail('Проверьте роль этапа пути.');return {...award(x),role:x.role};});
 d.publicPupils=list('publicPupils',30,x=>({personId:text(x.personId,'Публичный профиль воспитанника',100,true),description:text(x.description,'Достижения воспитанника',2000)}));
 if(new Set(d.publicPupils.map(x=>x.personId)).size!==d.publicPupils.length)fail('Воспитанник повторяется в списке.');
 d.gallery=list('gallery',30,x=>{if(!['competition','training','awards','students','archive'].includes(x.category))fail('Проверьте категорию фотографии.');const src=image(x.src);if(!src)fail('Выберите файл фотографии.');return {src,alt:text(x.alt,'Alt',1000),caption:text(x.caption,'Подпись',2000),credit:text(x.credit,'Автор фотографии',1000),category:x.category};});
 if(publishing){if(d.isAthlete&&!(d.bio||d.athleteBio))fail('Заполните общую биографию или биографию спортсмена.');if(d.isCoach&&!(d.bio||d.coachBio))fail('Заполните общую биографию или биографию тренера.');if(!d.portrait)fail('Перед публикацией добавьте основной портрет.');}
 return d;
}
export function personImages(p){return [p.portrait,p.coachPortrait,p.storyImage,p.hallHoverPhoto,...p.gallery.map(g=>g.src)].filter(Boolean);}
export async function checkPersonImages(db,config,p,id){
 for(const src of personImages(p)){
  let file;
  if(src.startsWith('/media/people/')){const key=path.basename(src);if(!await db.personAsset.findFirst({where:{id:key,personId:id||''}}))fail('Изображение не принадлежит этому человеку.');file=path.join(peopleMediaDir(config),key);}
  else file=path.join(config.ROOT,src.slice(1));
  try{await access(file);}catch{fail('Файл изображения отсутствует. Загрузите его снова.');}
 }
}
export function createPeopleWriter(db,config){return async(req,action)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))fail('Ожидается JSON-объект.');
 return db.$transaction(async tx=>{
  const id=req.params.id,expected=id?version(req.body.version):null,old=id?await tx.person.findUnique({where:{id}}):null;
  if(id&&!old)throw new HttpError(404,'Человек не найден.');
  if(old&&old.version!==expected)throw new HttpError(409,'Профиль уже изменён. Откройте актуальную запись в другой вкладке и перенесите правки.');
  let data;
  if(action==='save'){
   if(old?.status==='archived')fail('Сначала восстановите профиль из архива.');
   if(req.body.status&&!['draft','published'].includes(req.body.status))fail('Состояние изменяется отдельным действием.');
   if(req.body.status==='published'&&!old?.publishedPayload)fail('Публикацию выполняет владелец отдельным действием.');
   const p=validatePerson(req.body);await checkPersonImages(tx,config,p,id);
   if(p.publicPupils.some(x=>x.personId===id))fail('Нельзя добавить человека к собственным воспитанникам.');
   for(const ref of p.publicPupils)if(!await tx.person.findUnique({where:{id:ref.personId}}))fail('Публичная запись воспитанника не найдена. Ученики зала сюда не переносятся.');
   data={name:p.name,payload:JSON.stringify(p)};
  }else{
   if(!old)throw new HttpError(404,'Человек не найден.');
   if(req.user.role!=='OWNER'&&(['publish','unpublish'].includes(action)||(action==='archive'&&old.publishedPayload)))throw new HttpError(403,'Публикацию и снятие подтверждает владелец.');
   if(action==='publish'){
    if(old.status==='archived')fail('Сначала восстановите профиль.');
    const p=validatePerson(JSON.parse(old.payload),true);await checkPersonImages(tx,config,p,id);
    data={status:'published',publishedPayload:JSON.stringify(p),slug:old.slug||'person-'+old.id,publishedOn:new Date()};
   }else if(action==='unpublish'){
    if(old.status!=='published')fail('Профиль уже снят с публикации.');data={status:'draft',publishedPayload:null};
   }else if(action==='archive'){
    if(old.status==='archived')fail('Профиль уже в архиве.');data={status:'archived',publishedPayload:null};
   }else if(action==='restore'){
    if(old.status!=='archived')fail('Профиль не в архиве.');data={status:'draft',publishedPayload:null};
   }else throw new HttpError(404,'Действие не найдено.');
  }
  let saved;
  if(old){const result=await tx.person.updateMany({where:{id,version:expected},data:{...data,version:{increment:1}}});if(!result.count)throw new HttpError(409,'Конфликт версии. Перечитайте профиль.');saved=await tx.person.findUnique({where:{id}});}
  else saved=await tx.person.create({data});
  await tx.auditLog.create({data:{actorId:req.user.id,scope:'people',entityId:saved.id,action}});return saved;
 });
};}
