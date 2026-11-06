import * as v from '../lib/validation.js';

const fail=message=>{throw new v.HttpError(422,message);};
const conflict=message=>{throw new v.HttpError(409,message||'Запись изменена в другом окне. Ваши данные остались в форме. Перечитайте запись перед повторным сохранением.');};
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
function groupData(body){
 if(!body||typeof body!=='object'||Array.isArray(body))fail('Проверьте поля группы.');
 return {name:v.text(body.name,'Название группы',120,true),trainer:v.text(body.trainer,'Тренер',120),description:v.text(body.description,'Описание группы',3000),status:['active','archived'].includes(body.status)?body.status:fail('Недопустимый статус группы.')};
}
function sessionData(body){
 if(!body||typeof body!=='object'||Array.isArray(body))fail('Проверьте поля тренировки.');
 const startsAt=body.startsAt,endsAt=body.endsAt;
 if(typeof startsAt!=='string'||typeof endsAt!=='string'||!TIME.test(startsAt)||!TIME.test(endsAt)||startsAt>=endsAt)fail('Укажите корректное время начала и окончания в пределах одного дня.');
 const groupId=body.groupId===null||body.groupId===undefined||body.groupId===''?null:v.text(body.groupId,'Группа',100,true);
 return {groupId,title:v.text(body.title,'Название тренировки',180,true),heldOn:v.date(body.heldOn),startsAt,endsAt,trainer:v.text(body.trainer,'Тренер',120),note:v.text(body.note,'Примечание',3000),status:['planned','held','cancelled'].includes(body.status)?body.status:fail('Недопустимый статус тренировки.')};
}
function attendanceData(body){
 const version=v.version(body?.version),marks=body?.marks;
 if(!Array.isArray(marks)||marks.length>250)fail('За раз можно отметить не более 250 учеников.');
 const seen=new Set();
 return {version,marks:marks.map(mark=>{
  if(!mark||typeof mark!=='object'||Array.isArray(mark))fail('Некорректная отметка посещаемости.');
  const studentId=v.text(mark.studentId,'Ученик',100,true);
  if(seen.has(studentId))fail('Ученик указан дважды.');seen.add(studentId);
  const status=['present','absent','excused',''].includes(mark.status)?mark.status:fail('Недопустимая отметка посещаемости.');
  return {studentId,status,note:v.text(mark.note,'Комментарий',500)};
 })};
}
function isPrismaConflict(error){return ['P2002','P2034','P2028'].includes(error?.code)||(error?.message||'').includes('database is locked');}
async function guarded(work){try{return await work();}catch(error){if(isPrismaConflict(error))conflict('Данные обновляются в другом окне. Проверьте запись и повторите сохранение.');throw error;}}
async function ensureGroup(tx,groupId,allowArchived=false){
 if(!groupId)return null;
 const group=await tx.trainingGroup.findUnique({where:{id:groupId}});
 if(!group)throw new v.HttpError(422,'Выбранная группа не найдена.');
 if(!allowArchived&&group.status!=='active')fail('Нельзя назначить новую тренировку архивной группе.');
 return group;
}
async function createGroup(db,actor,data){
 return guarded(()=>db.$transaction(async tx=>{
  const names=await tx.trainingGroup.findMany({select:{name:true}});
  if(names.some(g=>g.name.toLocaleLowerCase('ru')===data.name.toLocaleLowerCase('ru')))conflict('Группа с таким названием уже есть.');
  const saved=await tx.trainingGroup.create({data});
  await tx.auditLog.create({data:{actorId:actor,scope:'gym-groups',entityId:saved.id,action:'create'}});
  return saved;
 }));
}
async function updateGroup(db,actor,id,version,data){
 return guarded(()=>db.$transaction(async tx=>{
  const old=await tx.trainingGroup.findUnique({where:{id}});
  if(!old)throw new v.HttpError(404,'Группа не найдена.');
  if(old.name!==data.name)fail('Название существующей группы менять нельзя: по нему привязаны ученики. Для нового названия создайте группу и переназначьте учеников.');
  const result=await tx.trainingGroup.updateMany({where:{id,version},data:{trainer:data.trainer,description:data.description,status:data.status,version:{increment:1}}});
  if(!result.count)conflict();
  await tx.auditLog.create({data:{actorId:actor,scope:'gym-groups',entityId:id,action:'update'}});
  return tx.trainingGroup.findUnique({where:{id}});
 }));
}
async function createSession(db,actor,data){
 return guarded(()=>db.$transaction(async tx=>{
  await ensureGroup(tx,data.groupId);
  const saved=await tx.gymSession.create({data});
  await tx.auditLog.create({data:{actorId:actor,scope:'gym-sessions',entityId:saved.id,action:'create'}});
  return saved;
 }));
}
async function updateSession(db,actor,id,version,data){
 return guarded(()=>db.$transaction(async tx=>{
  const old=await tx.gymSession.findUnique({where:{id},select:{id:true,groupId:true,status:true,attendance:{select:{id:true},take:1}}});
  if(!old)throw new v.HttpError(404,'Тренировка не найдена.');
  if(old.attendance.length&&(old.groupId!==data.groupId||data.status!=='held'))fail('У тренировки уже есть посещения. Сначала снимите отметки, затем измените группу или отмените занятие.');
  await ensureGroup(tx,data.groupId,old.groupId===data.groupId);
  const updated=await tx.gymSession.updateMany({where:{id,version},data:{...data,version:{increment:1}}});
  if(!updated.count)conflict();
  await tx.auditLog.create({data:{actorId:actor,scope:'gym-sessions',entityId:id,action:'update'}});
  return tx.gymSession.findUnique({where:{id},include:{group:true,attendance:true}});
 }));
}
async function saveAttendance(db,actor,id,{version,marks}){
 return guarded(()=>db.$transaction(async tx=>{
  const session=await tx.gymSession.findUnique({where:{id},include:{group:true,attendance:true}});
  if(!session)throw new v.HttpError(404,'Тренировка не найдена.');
  if(session.status!=='held')fail('Посещения отмечаются только для проведённой тренировки.');
  const ids=marks.map(x=>x.studentId);
  const students=await tx.student.findMany({where:{id:{in:ids}},select:{id:true,group:true}});
  if(students.length!==ids.length)fail('Один или несколько учеников не найдены.');
  const enrolled=new Map(students.map(s=>[s.id,s]));
  const already=new Set(session.attendance.map(a=>a.studentId));
  if(session.group&&marks.some(m=>!already.has(m.studentId)&&enrolled.get(m.studentId).group!==session.group.name))fail('Для этой группы можно отметить только её учеников.');
  const updated=await tx.gymSession.updateMany({where:{id,version},data:{version:{increment:1}}});
  if(!updated.count)conflict();
  for(const mark of marks){
   const key={sessionId_studentId:{sessionId:id,studentId:mark.studentId}};
   if(!mark.status)await tx.attendanceRecord.deleteMany({where:{sessionId:id,studentId:mark.studentId}});
   else await tx.attendanceRecord.upsert({where:key,create:{sessionId:id,...mark},update:{status:mark.status,note:mark.note}});
  }
  await tx.auditLog.create({data:{actorId:actor,scope:'gym-attendance',entityId:id,action:'update'}});
  return tx.gymSession.findUnique({where:{id},include:{group:true,attendance:{orderBy:{studentId:'asc'}}}});
 }));
}
const sessionInclude={group:{select:{id:true,name:true,status:true}},attendance:{select:{studentId:true,status:true,note:true}}};
async function summary(db,month){
 const [groups,students,sessions,payments]=await Promise.all([
  db.trainingGroup.count({where:{status:'active'}}),
  db.student.count({where:{status:'active'}}),
  db.gymSession.findMany({where:{heldOn:{startsWith:month}},include:{attendance:{select:{status:true}}},orderBy:[{heldOn:'asc'},{startsAt:'asc'}]}),
  db.payment.findMany({where:{received:{startsWith:month}},select:{amount:true}})
 ]);
 return {month,activeGroups:groups,activeStudents:students,scheduled:sessions.filter(s=>s.status==='planned').length,held:sessions.filter(s=>s.status==='held').length,cancelled:sessions.filter(s=>s.status==='cancelled').length,present:sessions.reduce((n,s)=>n+s.attendance.filter(a=>a.status==='present').length,0),recorded:sessions.reduce((n,s)=>n+s.attendance.length,0),paymentsCount:payments.length,receivedCents:payments.reduce((n,p)=>n+p.amount,0)};
}
export {groupData,sessionData,attendanceData,createGroup,updateGroup,createSession,updateSession,saveAttendance,summary,sessionInclude};
