const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {DatabaseSync}=require('node:sqlite');
test('Миграция удаления сохраняет прежние значения и связи без пересоздания таблиц',()=>{
 const db=new DatabaseSync(':memory:');const root=path.join(__dirname,'../prisma/migrations');
 try{
  for(const folder of fs.readdirSync(root).filter(x=>x<'202611130001_gym_soft_delete'&&fs.existsSync(path.join(root,x,'migration.sql'))).sort())db.exec(fs.readFileSync(path.join(root,folder,'migration.sql'),'utf8'));
  db.exec(`INSERT INTO Student (id,name,start,price,status,updatedAt,gymId) VALUES ('s','Прежний ученик','2026-11-15',300000,'active',1,'school-12');
INSERT INTO Payment (id,student,amount,received,period,updatedAt) VALUES ('p','s',300000,'2026-11-15','2026-11',1);
INSERT INTO PaymentRevision (id,paymentId,before,reason,actorId) VALUES ('r','p','{}','Причина','old-user');
INSERT INTO TrainingGroup (id,name,updatedAt,gymId) VALUES ('g','Группа',1,'school-12');
INSERT INTO GymSession (id,title,groupId,heldOn,startsAt,endsAt,updatedAt,gymId) VALUES ('t','Занятие','g','2026-11-15','18:00','19:00',1,'school-12');
INSERT INTO AttendanceRecord (id,sessionId,studentId,status,updatedAt) VALUES ('a','t','s','present',1);`);
  const tables=['Student','Payment','PaymentRevision','TrainingGroup','GymSession','AttendanceRecord'];const before=Object.fromEntries(tables.map(t=>[t,db.prepare('SELECT * FROM '+t).all().map(r=>({...r}))]));
  db.exec(fs.readFileSync(path.join(root,'202611130001_gym_soft_delete/migration.sql'),'utf8'));
  for(const table of tables){const after=db.prepare('SELECT * FROM '+table).all().map(r=>{const out={...r};delete out.deletedAt;return out;});assert.deepEqual(after,before[table],table);}
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(db.prepare('SELECT deletedAt FROM Payment').get().deletedAt,null);
 }finally{db.close();}
});
