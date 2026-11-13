const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');const {randomBytes}=require('node:crypto');const {PrismaClient}=require('@prisma/client');
test('Удаление: HTTP, CSRF, версии, два зала, суммы и сохранение истории',async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-remove-')),url='file:'+path.join(dir,'test.db');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}});
 const {hashPassword}=await import('../services/password.service.js');const {createApp}=await import('../lib/app.js');const password=randomBytes(20).toString('hex'),passwordHash=await hashPassword(password);
 await db.admin.createMany({data:[{login:'trainer-a',name:'A',role:'TRAINER',gymId:'school-12',passwordHash},{login:'trainer-b',name:'B',role:'TRAINER',gymId:'school-25',passwordHash},{login:'owner',name:'Owner',role:'OWNER',passwordHash},{login:'editor',name:'Editor',role:'EDITOR',passwordHash}]});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1',siteUploadDir:path.join(dir,'media'),secret:randomBytes(48).toString('hex')};
 const server=await new Promise(resolve=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true});});
 async function client(login){let cookie='',csrf='';const c={async request(route,method='GET',body,headers={}){const r=await fetch(base+route,{method,redirect:'manual',headers:{origin:base,cookie,'x-csrf-token':csrf,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});const sc=r.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(sc)cookie=sc.split(';')[0];return r;},async json(route,method='GET',body,headers={}){const r=await this.request(route,method,body,headers),data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}};csrf=(await c.json('/api/admin/auth/login','POST',{login,password})).csrfToken;return c;}
 const a=await client('trainer-a'),b=await client('trainer-b'),editor=await client('editor'),owner=await client('owner');
 const pupil={name:'История ученика',phone:'',parent:'',start:'2026-11-15',group:'Тестовая',trainer:'',price:300000,status:'active',note:''};
 const student=(await a.json('/api/admin/students','POST',pupil)).entity;
 const group=(await a.json('/api/admin/gym/groups','POST',{name:'Тестовая',trainer:'',description:'',status:'active'})).group;
 const payment=(await a.json('/api/admin/payments','POST',{student:student.id,amount:300000,received:'2026-11-15',period:'2026-11',comment:''})).entity;
 const payment2=(await a.json('/api/admin/payments','POST',{student:student.id,amount:300000,received:'2026-12-20',period:'2026-12',comment:''})).entity;
 await a.json('/api/admin/payments/'+payment.id,'PATCH',{...payment,amount:310000,reason:'Правка'});
 const session=(await a.json('/api/admin/gym/sessions','POST',{groupId:group.id,title:'Занятие',heldOn:'2026-11-15',startsAt:'18:00',endsAt:'19:00',trainer:'',note:'',status:'held'})).session;
 await a.json('/api/admin/gym/sessions/'+session.id+'/attendance','PATCH',{version:1,marks:[{studentId:student.id,status:'present',note:''}]});
 for(const route of ['/api/admin/payments/'+payment.id,'/api/admin/students/'+student.id,'/api/admin/gym/groups/'+group.id]){
  assert.equal((await b.request(route,'DELETE',{version:1})).status,404);
  assert.equal((await editor.request(route,'DELETE',{version:1})).status,403);
  assert.equal((await a.request(route,'DELETE',{version:1},{'x-csrf-token':'invalid'})).status,403);
  assert.equal((await a.request(route,'DELETE',{version:999})).status,409);
 }
 await a.json('/api/admin/payments/'+payment.id,'DELETE',{version:2});
 assert.equal((await a.request('/api/admin/payments/'+payment.id)).status,404);
 assert.equal((await a.request('/api/admin/payments/'+payment.id,'DELETE',{version:2})).status,404);
 assert.equal((await a.json('/api/admin/gym/summary?month=2026-11')).summary.receivedCents,0);
 assert.equal((await a.json('/api/admin/analytics/overview?month=2026-11')).success,true);
 assert.ok((await db.payment.findUnique({where:{id:payment.id}})).deletedAt);assert.equal(await db.paymentRevision.count({where:{paymentId:payment.id}}),1);
 await a.json('/api/admin/students/'+student.id,'DELETE',{version:1});
 assert.equal((await a.json('/api/admin/students')).students.length,0);
 assert.equal((await a.json('/api/admin/gym/summary?month=2026-12')).summary.receivedCents,300000,'Removing pupil must not remove cash receipts');
 const dash=await a.json('/api/admin/dashboard?view=payments');assert.equal(dash.payments[0].pupil.name,pupil.name);assert.ok(dash.payments[0].pupil.deletedAt);
 await a.json('/api/admin/gym/groups/'+group.id,'DELETE',{version:1});
 assert.equal((await a.json('/api/admin/gym/groups')).groups.length,0);
 assert.equal((await a.request('/api/admin/gym/groups/'+group.id,'PATCH',{name:group.name,trainer:'',description:'',status:'active',version:2})).status,404);
 assert.equal(await db.student.count(),1);assert.equal(await db.trainingGroup.count(),1);assert.equal(await db.payment.count(),2);assert.equal(await db.attendanceRecord.count(),1);assert.equal(await db.gymSession.count(),1);
 assert.equal(await db.auditLog.count({where:{action:'delete',gymId:'school-12'}}),3);
 assert.equal((await b.json('/api/admin/dashboard?view=payments')).payments.length,0);
 assert.equal((await owner.json('/api/admin/dashboard?view=payments','GET',undefined,{'x-gym-id':'school-12'})).payments.length,1);
 assert.equal((await db.payment.findUnique({where:{id:payment2.id}})).deletedAt,null);
});
