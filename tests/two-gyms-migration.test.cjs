const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');const {PrismaClient}=require('@prisma/client');
test('Миграция двух залов: сохранность всех прежних строк, FK, резервная копия и явный перенос',async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-migration-')),dbFile=path.join(dir,'legacy.db'),url='file:'+dbFile;
 const prismaDir=path.join(dir,'prisma'),migration='202611110001_two_gyms';fs.mkdirSync(prismaDir);
 fs.copyFileSync(path.join(root,'prisma/schema.prisma'),path.join(prismaDir,'schema.prisma'));fs.cpSync(path.join(root,'prisma/migrations'),path.join(prismaDir,'migrations'),{recursive:true});fs.rmSync(path.join(prismaDir,'migrations',migration),{recursive:true});
 const run=()=>execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(prismaDir,'schema.prisma')],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 run();let sqlite=new DatabaseSync(dbFile);sqlite.exec('PRAGMA foreign_keys=ON');
 const insert=(table,record)=>{const cols=Object.keys(record);sqlite.prepare(`INSERT INTO "${table}" (${cols.map(c=>'"'+c+'"').join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...Object.values(record));};
 const stamp='2026-11-10T10:00:00.000Z';
 insert('User',{id:'owner-old',login:'owner-old',name:'Старый владелец',passwordHash:'unchanged-hash',role:'OWNER'});
 insert('Student',{id:'student-old',name:'Старый ученик',start:'2026-10-01',group:'Старая группа',trainer:'Прежний тренер',price:100000,status:'active',updatedAt:stamp});
 insert('Payment',{id:'payment-old',student:'student-old',amount:120000,received:'2026-11-01',period:'2026-11',comment:'До миграции',updatedAt:stamp});
 insert('PaymentRevision',{id:'revision-old',paymentId:'payment-old',before:'{"amount":110000}',reason:'Уточнение',actorId:'owner-old'});
 insert('TrainingGroup',{id:'group-old',name:'Старая группа',updatedAt:stamp});
 insert('GymSession',{id:'session-old',groupId:'group-old',title:'Старая тренировка',heldOn:'2026-11-01',startsAt:'18:00',endsAt:'19:00',status:'held',updatedAt:stamp});
 insert('AttendanceRecord',{id:'attendance-old',sessionId:'session-old',studentId:'student-old',status:'present',updatedAt:stamp});
 insert('AuditLog',{id:'audit-student',actorId:'owner-old',scope:'students',entityId:'student-old',action:'create'});
 insert('AuditLog',{id:'audit-payment',actorId:'owner-old',scope:'payments',entityId:'payment-old',action:'update'});
 insert('AuditLog',{id:'audit-content',actorId:'owner-old',scope:'news',entityId:'news-old',action:'save'});
 insert('News',{id:'news-old',title:'Старая новость',payload:'{"title":"Старая новость"}',updatedAt:stamp});
 insert('AdminSession',{id:'admin-session-old',adminId:'owner-old',tokenHash:'old-token-hash',csrfTokenHash:'old-csrf',expiresAt:'2027-11-01T00:00:00.000Z'});
 const tables=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='_prisma_migrations' ORDER BY name").all().map(r=>r.name);
 const before=Object.fromEntries(tables.map(table=>[table,sqlite.prepare(`SELECT * FROM "${table}" ORDER BY 1`).all().map(r=>({...r}))]));sqlite.close();
 const backup=path.join(dir,'backup.db');execFileSync(process.execPath,[path.join(root,'scripts/backup-db.js'),backup],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 const copy=new DatabaseSync(backup,{readOnly:true});assert.equal(copy.prepare('SELECT amount FROM Payment').get().amount,120000);assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');copy.close();
 fs.cpSync(path.join(root,'prisma/migrations',migration),path.join(prismaDir,'migrations',migration),{recursive:true});run();run();
 sqlite=new DatabaseSync(dbFile);for(const table of tables){const after=sqlite.prepare(`SELECT * FROM "${table}" ORDER BY 1`).all().map(r=>{const x={...r};delete x.gymId;return x;});assert.deepEqual(after,before[table],table+' потерял старые данные');}
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM Gym').get().n,2);assert.equal(sqlite.prepare('SELECT gymId FROM Student').get().gymId,null);assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);sqlite.close();
 const db=new PrismaClient({datasources:{db:{url}}});t.after(async()=>{await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true});});
 const {assignLegacy}=await import('../services/legacy-gym.service.js');await assignLegacy(db,'school-12','owner-old');
 assert.equal((await db.student.findUnique({where:{id:'student-old'}})).gymId,'school-12');assert.equal((await db.trainingGroup.findUnique({where:{id:'group-old'}})).gymId,'school-12');assert.equal((await db.gymSession.findUnique({where:{id:'session-old'}})).gymId,'school-12');
 assert.equal((await db.auditLog.findUnique({where:{id:'audit-payment'}})).gymId,'school-12');assert.equal((await db.auditLog.findUnique({where:{id:'audit-content'}})).gymId,null);
 assert.equal((await db.payment.findUnique({where:{id:'payment-old'}})).amount,120000);assert.equal(await db.paymentRevision.count(),1);assert.equal(await db.attendanceRecord.count(),1);assert.equal(await db.adminSession.count(),1);
 // A second explicit transfer cannot move already assigned data.
 await assignLegacy(db,'school-25','owner-old');assert.equal((await db.student.findUnique({where:{id:'student-old'}})).gymId,'school-12');
});
