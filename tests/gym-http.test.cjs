const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');

test('08.9 HTTP: один зал, права, группы, тренировки, посещения и неизменность оплат',async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-gym-http-'));
 const url='file:'+path.join(dir,'gym.db').replaceAll('\\','/');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}});
 const {hashPassword}=await import('../services/password.service.js');
 const {createApp}=await import('../lib/app.js');
 const password=randomBytes(24).toString('base64url');const passwordHash=await hashPassword(password);
 await db.admin.createMany({data:[{login:'owner-089',name:'Owner',role:'OWNER',passwordHash},{login:'editor-089',name:'Editor',role:'EDITOR',passwordHash}]});
 const config={ROOT:root,secret:randomBytes(48).toString('hex'),production:false,origin:'http://127.0.0.1'};
 const server=await new Promise(resolve=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.$disconnect();await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});});
 function client(){let cookie='',csrf='';return {
  async request(route,options={}){const response=await fetch(base+route,{redirect:'manual',...options,headers:{origin:base,cookie,'x-csrf-token':csrf,...options.headers}});const setCookie=response.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(setCookie)cookie=setCookie.split(';')[0];return response;},
  async login(login){const response=await this.json('/api/admin/auth/login','POST',{login,password});assert.equal(response.status,200);csrf=(await response.json()).csrfToken;assert.ok(csrf);},
  async json(route,method,body,headers={}){return this.request(route,{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});}
 };}
 const owner=client(),editor=client(),anonymous=client();
 await owner.login('owner-089');await editor.login('editor-089');
 await t.test('Только OWNER видит новые страницы, API и приватную информацию',async()=>{
  for(const url of ['/api/admin/gym/groups','/api/admin/gym/sessions?month=2026-11','/api/admin/gym/summary?month=2026-11']){
   assert.equal((await anonymous.request(url)).status,401,url);
   assert.equal((await editor.request(url)).status,403,url);
   assert.equal((await owner.request(url)).status,200,url);
  }
  for(const page of ['gym','groups','group','trainings','training','attendance']){
   assert.equal((await editor.request('/admin/'+page)).status,403,page);
   if(page!=='attendance')assert.equal((await owner.request('/admin/'+page)).status,200,page);
  }
  assert.equal((await anonymous.request('/admin/trainings')).status,303);
  assert.equal((await owner.request('/admin/attendance')).status,404);
  const publicHtml=await (await anonymous.request('/')).text();assert.ok(!publicHtml.includes('gym-attendance'));
 });
 let student,group,session;
 await t.test('Создание ученика и группы, валидация, CSRF, повторное название 409',async()=>{
  const studentData={name:'ТЕСТ-УЧЕНИК-089',phone:'СЕКРЕТ-089',parent:'ТЕСТ-РОДИТЕЛЬ',start:'2026-11-01',group:'Подростки',trainer:'',price:300000,status:'active',note:'СКРЫТАЯ-ЗАМЕТКА-089'};
  let response=await owner.json('/api/admin/students','POST',studentData);assert.equal(response.status,201);student=(await response.json()).entity;
  const payload={name:'Подростки',trainer:'Тренер',description:'Тестовая группа',status:'active'};
  response=await owner.json('/api/admin/gym/groups','POST',payload,{'x-csrf-token':'wrong'});assert.equal(response.status,403);
  response=await editor.json('/api/admin/gym/groups','POST',payload);assert.equal(response.status,403);
  response=await owner.json('/api/admin/gym/groups','POST',payload);assert.equal(response.status,201);group=(await response.json()).group;
  response=await owner.json('/api/admin/gym/groups','POST',{...payload,name:'подростки'});assert.equal(response.status,409);
  response=await owner.json('/api/admin/gym/groups/'+group.id,'PATCH',{...payload,name:'Переименованная',version:group.version});assert.equal(response.status,422);
  assert.equal((await db.student.findUnique({where:{id:student.id}})).group,'Подростки');
 });
 await t.test('Создание занятия, закрытые отметки, отказ неподходящей группы',async()=>{
  const bad={title:'Тренировка 089',groupId:'missing',heldOn:'2026-11-06',startsAt:'18:00',endsAt:'19:30',trainer:'Тренер',status:'planned',note:''};
  assert.equal((await owner.json('/api/admin/gym/sessions','POST',bad)).status,422);
  let response=await owner.json('/api/admin/gym/sessions','POST',{...bad,groupId:group.id});assert.equal(response.status,201);session=(await response.json()).session;
  assert.equal((await owner.json('/api/admin/gym/sessions/'+session.id+'/attendance','PATCH',{version:1,marks:[{studentId:student.id,status:'present'}]})).status,422);
  response=await owner.json('/api/admin/gym/sessions/'+session.id,'PATCH',{...bad,groupId:group.id,status:'held',version:1});assert.equal(response.status,200);session=(await response.json()).session;assert.equal(session.version,2);
  response=await owner.json('/api/admin/gym/sessions/'+session.id+'/attendance','PATCH',{version:session.version,marks:[{studentId:student.id,status:'present',note:'Работал в паре'}]});assert.equal(response.status,200);session=(await response.json()).session;assert.equal(session.attendance.length,1);
  assert.equal((await editor.request('/api/admin/gym/students/'+student.id+'/attendance')).status,403);
  assert.equal((await owner.request('/admin/attendance?id='+session.id)).status,200);
 });
 await t.test('Оптимистичная версия, корректные 404 и независимая финансовая запись',async()=>{
  const mark={version:2,marks:[{studentId:student.id,status:'absent'}]};
  assert.equal((await owner.json('/api/admin/gym/sessions/'+session.id+'/attendance','PATCH',mark)).status,409);
  assert.equal((await owner.json('/api/admin/gym/sessions/not-found/attendance','PATCH',{version:1,marks:[]})).status,404);
  assert.equal((await owner.request('/api/admin/gym/groups/not-found')).status,404);
  assert.equal((await owner.request('/api/admin/gym/sessions/not-found')).status,404);
  assert.equal((await owner.request('/api/admin/gym/students/not-found/attendance')).status,404);
  const paymentData={student:student.id,amount:175000,received:'2026-11-06',period:'2026-11',comment:'Фактическая оплата'};
  const response=await owner.json('/api/admin/payments','POST',paymentData);assert.equal(response.status,201);
  const summary=(await (await owner.request('/api/admin/gym/summary?month=2026-11')).json()).summary;
  assert.equal(summary.activeGroups,1);assert.equal(summary.held,1);assert.equal(summary.present,1);assert.equal(summary.receivedCents,175000);assert.equal(summary.paymentsCount,1);
  const attendance=(await (await owner.request('/api/admin/gym/students/'+student.id+'/attendance')).json()).records;
  assert.equal(attendance.length,1);assert.equal(attendance[0].status,'present');
  const publicPages=['/','/history','/contacts','/news','/competitions'];
  for(const page of publicPages){const text=await (await anonymous.request(page)).text();assert.ok(!text.includes('СЕКРЕТ-089'),page);assert.ok(!text.includes('СКРЫТАЯ-ЗАМЕТКА-089'),page);}
  const reader=new PrismaClient({datasources:{db:{url}}});assert.equal(await reader.attendanceRecord.count(),1);assert.equal(await reader.payment.count(),1);await reader.$disconnect();
 });
 await t.test('Архивирование группы не меняет прежних отметок, не допускает новые тренировки',async()=>{
  const response=await owner.json('/api/admin/gym/groups/'+group.id,'PATCH',{name:group.name,trainer:group.trainer,description:group.description,status:'archived',version:group.version});assert.equal(response.status,200);
  const draft={title:'Новая',groupId:group.id,heldOn:'2026-11-12',startsAt:'10:00',endsAt:'11:00',trainer:'',note:'',status:'planned'};
  assert.equal((await owner.json('/api/admin/gym/sessions','POST',draft)).status,422);
  assert.equal((await db.attendanceRecord.count()),1);
 });
});
