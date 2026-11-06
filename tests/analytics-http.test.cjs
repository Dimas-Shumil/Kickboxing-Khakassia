const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');

test('08.10 HTTP: аналитика, журнал, реальные SQLite-данные и разграничение ролей',async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-analytics-http-'));
 const url='file:'+path.join(dir,'analytics.db').replaceAll('\\','/');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}});
 const {hashPassword}=await import('../services/password.service.js');
 const {createApp}=await import('../lib/app.js');
 const password=randomBytes(24).toString('base64url');const passwordHash=await hashPassword(password);
 const owner=await db.admin.create({data:{login:'owner-810',name:'Владелец',role:'OWNER',passwordHash}});
 const editor=await db.admin.create({data:{login:'editor-810',name:'Редактор',role:'EDITOR',passwordHash}});
 const student=await db.student.create({data:{name:'ПРИВАТНЫЙ_УЧЕНИК_810',start:'2026-11-01',price:300000,status:'active',phone:'ПРИВАТНЫЙ_ТЕЛЕФОН_810'}});
 await db.payment.create({data:{student:student.id,amount:74000,received:'2026-11-06',period:'2026-10',comment:'СЕКРЕТНЫЙ_ПЛАТЁЖ_810'}});
 const group=await db.trainingGroup.create({data:{name:'Группа 810'}});
 const session=await db.gymSession.create({data:{title:'Занятие 810',groupId:group.id,heldOn:'2026-11-06',startsAt:'15:00',endsAt:'16:00',status:'held'}});
 await db.attendanceRecord.create({data:{sessionId:session.id,studentId:student.id,status:'present'}});
 await db.news.create({data:{title:'Новость 810',status:'published',payload:'{"title":"Черновые правки 810"}',publishedPayload:'{"title":"Публикация 810"}',slug:'post-810'}});
 await db.sitePage.create({data:{key:'contacts',payload:'{"phone":"123"}',publishedPayload:'{"phone":"123"}'}});
 await db.auditLog.createMany({data:[
  {actorId:owner.id,scope:'news',entityId:'n810',action:'publish',createdAt:new Date('2026-11-05T09:00:00Z')},
  {actorId:owner.id,scope:'payments',entityId:student.id,action:'update',createdAt:new Date('2026-11-06T09:00:00Z')},
  {actorId:editor.id,scope:'news',entityId:'n810',action:'update',createdAt:new Date('2026-11-07T09:00:00Z')}
 ]});
 const config={ROOT:root,secret:randomBytes(48).toString('hex'),production:false,origin:'http://127.0.0.1'};
 const server=await new Promise(resolve=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>resolve(s));});
 const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.$disconnect();await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});});
 function client(){let cookie='',csrf='';return {
  async request(route,options={}){const response=await fetch(base+route,{redirect:'manual',...options,headers:{origin:base,cookie,'x-csrf-token':csrf,...options.headers}});const value=response.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(value)cookie=value.split(';')[0];return response;},
  async login(login){const response=await this.request('/api/admin/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login,password})});assert.equal(response.status,200);csrf=(await response.json()).csrfToken;}
 };}
 const ownerClient=client(),editorClient=client(),guest=client();
 await ownerClient.login('owner-810');await editorClient.login('editor-810');
 await t.test('Анонимные пользователи закрыты от аналитики и журнала',async()=>{
  for(const endpoint of ['/api/admin/analytics/overview?month=2026-11','/api/admin/analytics/activity?month=2026-11'])assert.equal((await guest.request(endpoint)).status,401);
  assert.equal((await guest.request('/admin/activity')).status,303);
  assert.equal((await editorClient.request('/admin/activity')).status,200);
  assert.equal((await ownerClient.request('/admin/activity')).status,200);
 });
 await t.test('Редактор получает редакционную статистику, но не зал и деньги',async()=>{
  const response=await editorClient.request('/api/admin/analytics/overview?month=2026-11');assert.equal(response.status,200);
  const data=(await response.json()).overview;
  assert.equal(data.content.find(x=>x.key==='news').published,1);
  assert.equal(data.content.find(x=>x.key==='news').pendingUpdates,1);
  assert.equal(data.activity.total,2);
  assert.equal(Object.hasOwn(data,'gym'),false);
  assert.equal(data.activity.byScope.payments,undefined);
  assert.ok(!JSON.stringify(data).includes('ПРИВАТНЫЙ'));
  const list=await editorClient.request('/api/admin/analytics/activity?month=2026-11');assert.equal(list.status,200);
  const log=(await list.json()).activity;assert.equal(log.total,2);assert.ok(log.entries.every(x=>x.scope==='news'));
  assert.ok(!JSON.stringify(log).includes('payments'));
  assert.equal((await editorClient.request('/api/admin/analytics/activity?month=2026-11&scope=payments')).status,403);
 });
 await t.test('Владелец видит фактически полученную сумму, занятия и посещения',async()=>{
  const response=await ownerClient.request('/api/admin/analytics/overview?month=2026-11');assert.equal(response.status,200);
  const data=(await response.json()).overview;
  assert.equal(data.gym.receivedCents,74000);assert.equal(data.gym.present,1);assert.equal(data.gym.held,1);
  assert.equal(data.activity.total,3);
  const log=await ownerClient.request('/api/admin/analytics/activity?month=2026-11&scope=payments');
  assert.equal(log.status,200);assert.equal((await log.json()).activity.total,1);
 });
 await t.test('Фильтры отклоняют вредные значения и корректно показывают пустой месяц',async()=>{
  for(const q of ['month=2026-13','month=2026-11&scope=invalid','month=2026-11&page=999','month=2026-11&action=DROP']){
   assert.equal((await ownerClient.request('/api/admin/analytics/activity?'+q)).status,422,q);
  }
  const response=await ownerClient.request('/api/admin/analytics/overview?month=2026-09');assert.equal(response.status,200);
  const data=(await response.json()).overview;assert.equal(data.activity.total,0);assert.equal(data.gym.receivedCents,0);
  assert.equal((await guest.request('/api/admin/analytics/missing')).status,401);
  assert.equal((await ownerClient.request('/api/admin/analytics/missing')).status,404);
 });
});
