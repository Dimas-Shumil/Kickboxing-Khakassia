const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

test('08.9: группы, занятия, отметки — правила и оптимистичные версии',async t=>{
 const gym=await import('../services/gym.service.js');
 const fail=(fn,status=422)=>assert.throws(fn,e=>e.status===status);
 await t.test('Строгая валидация групп, времени и отметок',()=>{
  fail(()=>gym.groupData({name:'',status:'active'}));
  fail(()=>gym.groupData({name:'Зал',status:'unpaid'}));
  fail(()=>gym.sessionData({title:'Занятие',heldOn:'2026-02-30',startsAt:'18:00',endsAt:'19:00',status:'planned'}));
  fail(()=>gym.sessionData({title:'Занятие',heldOn:'2026-11-06',startsAt:'20:00',endsAt:'19:00',status:'planned'}));
  fail(()=>gym.sessionData({title:'Занятие',heldOn:'2026-11-06',startsAt:'25:00',endsAt:'26:00',status:'planned'}));
  fail(()=>gym.attendanceData({version:1,marks:[{studentId:'s1',status:'present'},{studentId:'s1',status:'absent'}]}));
  fail(()=>gym.attendanceData({version:1,marks:Array.from({length:251},(_,i)=>({studentId:'s'+i,status:'present'}))}));
  fail(()=>gym.attendanceData({version:1,marks:[{studentId:'s1',status:'some-debt'}]}));
  assert.equal(gym.attendanceData({version:1,marks:[{studentId:'s1',status:'',note:''}]}).marks[0].status,'');
 });
 const groups=new Map(),sessions=new Map(),attendances=new Map(),audits=[],students=[{id:'s1',group:'Подростки'},{id:'s2',group:'Взрослые'}];
 let counter=0;
 const enrich=s=>s?{...s,group:s.groupId?groups.get(s.groupId):null,attendance:[...attendances.values()].filter(a=>a.sessionId===s.id)}:null;
 const db={
  $transaction:async cb=>cb(db),
  auditLog:{create:async({data})=>{audits.push(data);return data;}},
  trainingGroup:{
   findMany:async()=>[...groups.values()],
   findUnique:async({where})=>groups.get(where.id)||null,
   create:async({data})=>{const g={...data,id:'g'+(++counter),version:1};groups.set(g.id,g);return g;},
   updateMany:async({where,data})=>{const g=groups.get(where.id);if(!g||g.version!==where.version)return {count:0};Object.assign(g,data,{version:g.version+1});return {count:1};},
   count:async()=>[...groups.values()].filter(g=>g.status==='active').length
  },
  gymSession:{
   create:async({data})=>{const s={...data,id:'t'+(++counter),version:1};sessions.set(s.id,s);return s;},
   findUnique:async({where})=>enrich(sessions.get(where.id)),
   updateMany:async({where,data})=>{const s=sessions.get(where.id);if(!s||s.version!==where.version)return {count:0};Object.assign(s,data,{version:s.version+1});return {count:1};},
   findMany:async({where})=>[...sessions.values()].filter(s=>s.heldOn.startsWith(where.heldOn.startsWith)).map(enrich)
  },
  student:{findMany:async({where})=>students.filter(s=>where.id.in.includes(s.id)),count:async()=>2},
  attendanceRecord:{
   deleteMany:async({where})=>{attendances.delete(where.sessionId+':'+where.studentId);return {count:1};},
   upsert:async({where,create,update})=>{const key=where.sessionId_studentId.sessionId+':'+where.sessionId_studentId.studentId;const saved={...(attendances.get(key)||create),...update};attendances.set(key,saved);return saved;}
  },
  financeEntry:{findMany:async()=>[]},
  payment:{findMany:async()=>[{amount:125000}]}
 };
 const sourceGroup={name:'Подростки',trainer:'Тренер',description:'',status:'active'};
 let group;
 await t.test('Создание группы, дублирующее название, версия 409 и запрет переименования',async()=>{
  group=await gym.createGroup(db,'owner',gym.groupData(sourceGroup));
  await assert.rejects(gym.createGroup(db,'owner',gym.groupData({...sourceGroup,name:'подростки'})),e=>e.status===409);
  await assert.rejects(gym.updateGroup(db,'owner',group.id,1,gym.groupData({...sourceGroup,name:'Новое'})),e=>e.status===422);
  const updated=await gym.updateGroup(db,'owner',group.id,1,gym.groupData({...sourceGroup,trainer:'Другой'}));assert.equal(updated.version,2);
  await assert.rejects(gym.updateGroup(db,'owner',group.id,1,gym.groupData(sourceGroup)),e=>e.status===409);
 });
 const sample={title:'Кикбоксинг',groupId:group.id,heldOn:'2026-11-06',startsAt:'18:00',endsAt:'19:30',trainer:'Тренер',note:'',status:'planned'};
 let session;
 await t.test('Сначала тренировка, затем проведение, отметка и HTTP 409 для устаревшей версии',async()=>{
  session=await gym.createSession(db,'owner',gym.sessionData(sample));
  await assert.rejects(gym.saveAttendance(db,'owner',session.id,gym.attendanceData({version:1,marks:[{studentId:'s1',status:'present'}]})),e=>e.status===422);
  const held=await gym.updateSession(db,'owner',session.id,1,gym.sessionData({...sample,status:'held'}));assert.equal(held.version,2);
  const saved=await gym.saveAttendance(db,'owner',session.id,gym.attendanceData({version:2,marks:[{studentId:'s1',status:'present',note:'Пришёл вовремя'}]}));
  assert.equal(saved.version,3);assert.equal(saved.attendance[0].status,'present');
  await assert.rejects(gym.saveAttendance(db,'owner',session.id,gym.attendanceData({version:2,marks:[{studentId:'s1',status:'absent'}]})),e=>e.status===409);
  assert.equal(attendances.get(session.id+':s1').status,'present');
  await assert.rejects(gym.saveAttendance(db,'owner',session.id,gym.attendanceData({version:3,marks:[{studentId:'s2',status:'present'}]})),e=>e.status===422);
  assert.equal(sessions.get(session.id).version,3);
  await assert.rejects(gym.updateSession(db,'owner',session.id,3,gym.sessionData({...sample,status:'cancelled'})),e=>e.status===422);
 });
 await t.test('Удаление отметки явно, история платежей остаётся независимой',async()=>{
  const updated=await gym.saveAttendance(db,'owner',session.id,gym.attendanceData({version:3,marks:[{studentId:'s1',status:'',note:''}]}));
  assert.equal(updated.attendance.length,0);
  assert.equal(sessions.get(session.id).version,4);
  assert.ok(audits.some(a=>a.scope==='gym-attendance'));
  const report=await gym.summary(db,'2026-11');assert.equal(report.activeGroups,1);assert.equal(report.held,1);assert.equal(report.present,0);assert.equal(report.receivedCents,125000);
 });
});
