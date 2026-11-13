// 08.10. Read-only analytics. Every figure is computed from existing SQLite records.
// No private gym queries are executed for EDITOR.
import {HttpError,period} from '../lib/validation.js';

export const contentScopes=['news','people','competitions','history','site-page','site-document','site-media'];
export const gymScopes=['students','payments','gym-groups','gym-sessions','gym-attendance','gym-finances'];
export const scopeLabels={news:'Новости',people:'Люди',competitions:'Соревнования',history:'История',
 'site-page':'Страницы Федерации','site-document':'Документы','site-media':'Медиатека',
 students:'Ученики',payments:'Платежи','gym-groups':'Группы',
 'gym-sessions':'Тренировки','gym-attendance':'Посещаемость','gym-finances':'Доходы и расходы'};
export const actionLabels={create:'Создание',save:'Сохранение правок',update:'Изменение',publish:'Публикация',
 unpublish:'Снятие публикации',archive:'В архив',restore:'Восстановление',delete:'Удаление',
 'delete-file':'Удаление файла','delete-photo':'Удаление фото'};
export const allowedScopes=role=>['OWNER','TRAINER'].includes(role)?[...contentScopes,...gymScopes]:[...contentScopes];
export const allowedActions=['all','create','save','update','publish','unpublish','archive','restore','delete','delete-file','delete-photo'];
export function monthWindow(month){
 period(month);
 const [year,n]=month.split('-').map(Number);
 const next=new Date(Date.UTC(year,n,1)).toISOString().slice(0,7);
 // Абакан (Asia/Krasnoyarsk) — UTC+07, без сезонного перевода часов.
 return {month,from:new Date(`${month}-01T00:00:00+07:00`),to:new Date(`${next}-01T00:00:00+07:00`)};
}
function category(records,{page=false}={}){
 const total=records.length;
 let published=0,archived=0,waiting=0;
 for(const item of records){
  const live=page?item.publishedPayload!==null: item.status==='published'&&item.publishedPayload!==null;
  if(live)published++;
  if(item.status==='archived')archived++;
  if(live&&item.payload!==item.publishedPayload)waiting++;
 }
 return {total,published,unpublished:total-published-archived,archived,pendingUpdates:waiting};
}
function sumMoney(entries){return entries.reduce((s,row)=>s+row.amount,0);}
function bucketDay(iso){return Math.min(4,Math.floor((Number(iso.slice(8,10))-1)/7));}
function weeklyChart(sessions,payments,month){
 const [year,n]=month.split('-').map(Number);
 const days=new Date(Date.UTC(year,n,0)).getUTCDate();
 const groups=Array.from({length:Math.ceil(days/7)},(_,i)=>({label:`${i*7+1}–${Math.min(days,i*7+7)}`,sessions:0,present:0,recorded:0,receivedCents:0,payments:0}));
 for(const s of sessions){if(s.status!=='held')continue;const row=groups[bucketDay(s.heldOn)];row.sessions++;row.present+=s.attendance.filter(a=>a.status==='present').length;row.recorded+=s.attendance.length;}
 for(const p of payments){const row=groups[bucketDay(p.received)];row.receivedCents+=p.amount;row.payments++;}
 return groups;
}
export async function analyticsOverview(db,role,month){
 const {from,to}=monthWindow(month),visible=allowedScopes(role);
 const selection={select:{status:true,payload:true,publishedPayload:true}};
 const [news,people,competitions,history,documents,pages,activity,recent]=await Promise.all([
  db.news.findMany(selection),db.person.findMany(selection),db.competition.findMany(selection),
  db.historyMaterial.findMany(selection),db.federationDocument.findMany(selection),
  db.sitePage.findMany({select:{payload:true,publishedPayload:true}}),
  db.auditLog.groupBy({by:['scope','action'],where:{scope:{in:visible},createdAt:{gte:from,lt:to}},_count:{_all:true}}),
  db.auditLog.count({where:{scope:{in:visible},createdAt:{gte:from,lt:to}}})
 ]);
 const content=[
  {key:'news',label:'Новости',href:'/admin/news',...category(news)},
  {key:'people',label:'Люди',href:'/admin/people',...category(people)},
  {key:'competitions',label:'Соревнования',href:'/admin/competitions',...category(competitions)},
  {key:'history',label:'История и архив',href:'/admin/history',...category(history)},
  {key:'site-document',label:'Документы',href:'/admin/site-documents',...category(documents)},
  {key:'site-page',label:'Страницы',href:'/admin/site-pages',...category(pages,{page:true})}
 ];
 const byScope=Object.fromEntries(visible.map(s=>[s,0]));
 const byAction={created:0,saved:0,published:0,withdrawn:0,archived:0,other:0};
 for(const row of activity){
  const count=row._count._all;byScope[row.scope]=(byScope[row.scope]||0)+count;
  const name=row.action==='create'?'created':['save','update'].includes(row.action)?'saved':row.action==='publish'?'published':row.action==='unpublish'?'withdrawn':row.action==='archive'?'archived':'other';
  byAction[name]+=count;
 }
 const result={month,content,activity:{total:recent,byScope,byAction}};
 if(['OWNER','TRAINER'].includes(role)){
  const [activeStudents,activeGroups,sessions,payments]=await Promise.all([
   db.student.count({where:{status:'active'}}),db.trainingGroup.count({where:{status:'active'}}),
   db.gymSession.findMany({where:{heldOn:{startsWith:month}},select:{heldOn:true,status:true,attendance:{select:{status:true}}}}),
   db.payment.findMany({where:{received:{startsWith:month}},select:{received:true,amount:true}})
  ]);
  const held=sessions.filter(s=>s.status==='held');
  const records=held.flatMap(s=>s.attendance);
  result.gym={activeStudents,activeGroups,planned:sessions.filter(s=>s.status==='planned').length,held:held.length,
   cancelled:sessions.filter(s=>s.status==='cancelled').length,present:records.filter(a=>a.status==='present').length,
   absent:records.filter(a=>a.status==='absent').length,excused:records.filter(a=>a.status==='excused').length,
   marked:records.length,paymentsCount:payments.length,receivedCents:sumMoney(payments),weekly:weeklyChart(sessions,payments,month)};
 }
 return result;
}
const linkFor=(scope,id)=>{
 const root={news:'/admin/news-edit?id=',people:'/admin/person-edit?id=',competitions:'/admin/competition-edit?id=',history:'/admin/history-edit?id=',
  'site-document':'/admin/site-document-edit?id=',students:'/admin/student?id=',payments:'/admin/payment?id=',
  'gym-groups':'/admin/group?id=','gym-sessions':'/admin/training?id=','gym-attendance':'/admin/attendance?id=','gym-finances':'/admin/finances?id='};
 if(scope==='site-page')return ['home','contacts','federation'].includes(id)?'/admin/site-page-edit?key='+id:null;
 if(scope==='site-media')return '/admin/site-media';
 return root[scope]?root[scope]+encodeURIComponent(id):null;
};
export function parseActivityFilter(query,role){
 const month=period(query.month),scope=query.scope||'all',action=query.action||'all';
 if(typeof scope!=='string')throw new HttpError(422,'Недопустимый раздел журнала.');
 if(gymScopes.includes(scope)&&!['OWNER','TRAINER'].includes(role))throw new HttpError(403,'Учёт зала доступен владельцу и назначенному тренеру.');
 if(!['all',...allowedScopes(role)].includes(scope))throw new HttpError(422,'Недопустимый раздел журнала.');
 if(typeof action!=='string'||!allowedActions.includes(action))throw new HttpError(422,'Недопустимое действие журнала.');
 const page=query.page===undefined?'0':String(query.page);
 if(!/^(?:0|[1-9]\d{0,2})$/.test(page)||Number(page)>100)throw new HttpError(422,'Недопустимая страница журнала.');
 return {month,scope,action,page:Number(page)};
}
export async function analyticsActivity(db,role,filter){
 const {from,to}=monthWindow(filter.month),scopes=allowedScopes(role),where={scope:{in:filter.scope==='all'?scopes:[filter.scope]},createdAt:{gte:from,lt:to}};
 if(filter.action!=='all')where.action=filter.action;
 const take=20;
 const [total,rows,admins]=await Promise.all([
  db.auditLog.count({where}),
  db.auditLog.findMany({where,select:{id:true,scope:true,action:true,actorId:true,entityId:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:filter.page*take,take}),
  db.admin.findMany({select:{id:true,name:true}})
 ]);
 const actors=new Map(admins.map(x=>[x.id,x.name]));
 const allowed=new Set(scopes);
 const entries=rows.filter(r=>allowed.has(r.scope)).map(r=>({
  id:r.id,scope:r.scope,scopeLabel:scopeLabels[r.scope]||'Раздел',action:r.action,
  actionLabel:actionLabels[r.action]||'Действие',actor:actors.get(r.actorId)||'Удалённый сотрудник',
  at:r.createdAt.toISOString(),href:linkFor(r.scope,r.entityId)
 }));
 return {month:filter.month,page:filter.page,pageSize:take,total,pages:Math.min(101,Math.ceil(total/take)),limited:total>2020,entries};
}
