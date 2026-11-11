const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {execFileSync}=require('node:child_process');const {randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');

test('Два зала: реальные HTTP-запросы, права, публикация, финансы и подмена ID',async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-two-gyms-')),url='file:'+path.join(dir,'test.db');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}});
 const {hashPassword}=await import('../services/password.service.js');const {createApp}=await import('../lib/app.js');
 const password=randomBytes(20).toString('base64url'),passwordHash=await hashPassword(password);
 await db.admin.createMany({data:[{login:'owner',name:'Owner',role:'OWNER',passwordHash},{login:'berezkin',name:'Берёзкин',role:'TRAINER',gymId:'school-12',passwordHash},{login:'sazantsev',name:'Сазанцев',role:'TRAINER',gymId:'school-25',passwordHash},{login:'editor',name:'Editor',role:'EDITOR',passwordHash}]});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1',siteUploadDir:path.join(dir,'site-media'),secret:randomBytes(48).toString('hex')};
 const server=await new Promise(resolve=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true});});
 async function client(login){let cookie='',csrf='';const c={
  async request(route,method='GET',body,headers={}){const r=await fetch(base+route,{method,redirect:'manual',headers:{origin:base,cookie,'x-csrf-token':csrf,...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:body instanceof Uint8Array?body:JSON.stringify(body)}:{})});const sc=r.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(sc)cookie=sc.split(';')[0];return r;},
  async json(route,method='GET',body,headers={}){const r=await this.request(route,method,body,headers);const result=await r.json();assert.ok(r.ok,`${r.status} ${route}: ${JSON.stringify(result)}`);return result;}
 };csrf=(await c.json('/api/admin/auth/login','POST',{login,password})).csrfToken;return c;}
 const a=await client('berezkin'),b=await client('sazantsev'),owner=await client('owner'),editor=await client('editor');
 const studentData={name:'Секретный ученик 12',phone:'123',parent:'Родитель',start:'2026-11-01',group:'Начальная',trainer:'',price:100000,status:'active',note:'секрет'};
 const sa=(await a.json('/api/admin/students','POST',{...studentData,gymId:'school-25'})).entity;
 const sb=(await b.json('/api/admin/students','POST',{...studentData,name:'Секретный ученик 25'})).entity;
 const payData={student:sa.id,amount:100000,received:'2026-11-05',period:'2026-11',comment:''};
 const pa=(await a.json('/api/admin/payments','POST',payData)).entity;
 const pb=(await b.json('/api/admin/payments','POST',{...payData,student:sb.id,amount:70000})).entity;
 const ga=(await a.json('/api/admin/gym/groups','POST',{name:'Начальная',trainer:'',description:'',status:'active'})).group;
 const gb=(await b.json('/api/admin/gym/groups','POST',{name:'Начальная',trainer:'',description:'',status:'active'})).group;
 const training={groupId:ga.id,title:'Занятие',heldOn:'2026-11-05',startsAt:'18:00',endsAt:'19:00',trainer:'',note:'',status:'held'};
 const ta=(await a.json('/api/admin/gym/sessions','POST',training)).session;
 const tb=(await b.json('/api/admin/gym/sessions','POST',{...training,groupId:gb.id})).session;
 await a.json('/api/admin/gym/sessions/'+ta.id+'/attendance','PATCH',{version:1,marks:[{studentId:sa.id,status:'present',note:''}]});
 const fin=(await a.json('/api/admin/finances','POST',{kind:'income',amount:30000,occurredOn:'2026-11-05',category:'Спонсор',comment:''})).entity;
 await a.json('/api/admin/finances','POST',{kind:'expense',amount:20000,occurredOn:'2026-11-05',category:'Инвентарь',comment:''});
 await t.test('Тренер не может переключить зал параметром или заголовком',async()=>{
  const dash=await a.json('/api/admin/dashboard?gymId=school-25','GET',undefined,{'x-gym-id':'school-25'});
  assert.equal(dash.gymId,'school-12');assert.deepEqual(dash.students.map(s=>s.id),[sa.id]);assert.equal(sa.gymId,'school-12');
  const dashB=await b.json('/api/admin/dashboard');assert.deepEqual(dashB.students.map(s=>s.id),[sb.id]);
  assert.ok(!JSON.stringify(dash).includes(sb.name));assert.ok(!JSON.stringify(dashB).includes(sa.name));
  const list=await a.json('/api/admin/students?search='+encodeURIComponent(sb.name)+'&gymId=school-25');assert.deepEqual(list.students.map(s=>s.id),[sa.id]);
  const activity=await a.json('/api/admin/analytics/activity?month=2026-11');assert.ok(!JSON.stringify(activity).includes(sb.id));assert.ok(!JSON.stringify(activity).includes(pb.id));
  const overview=(await a.json('/api/admin/analytics/overview?month=2026-11')).overview;assert.equal(overview.gym.receivedCents,100000);
 });
 await t.test('Одновременные запросы двух тренеров сохраняют независимый контекст зала',async()=>{
  await Promise.all(Array.from({length:16},async(_,i)=>{const who=i%2?a:b,expected=i%2?sa:sb;const result=await who.json('/api/admin/students');assert.deepEqual(result.students.map(s=>s.id),[expected.id]);}));
 });
 await t.test('Чужие ID на чтение, изменение и связи запрещены для обоих тренеров',async()=>{
  for(const [who,foreignStudent,foreignPayment,foreignGroup,foreignSession] of [[a,sb,pb,gb,tb],[b,sa,pa,ga,ta]]){
   for(const endpoint of ['/api/admin/students/'+foreignStudent.id,'/api/admin/payments/'+foreignPayment.id,'/api/admin/gym/groups/'+foreignGroup.id,'/api/admin/gym/sessions/'+foreignSession.id,'/api/admin/gym/students/'+foreignStudent.id+'/attendance'])assert.equal((await who.request(endpoint)).status,404,endpoint);
   for(const endpoint of ['/admin/student?id='+foreignStudent.id,'/admin/payment?id='+foreignPayment.id,'/admin/group?id='+foreignGroup.id,'/admin/training?id='+foreignSession.id,'/admin/attendance?id='+foreignSession.id])assert.equal((await who.request(endpoint)).status,404,endpoint);
   assert.equal((await who.request('/api/admin/students/'+foreignStudent.id,'PATCH',{...studentData,version:1})).status,404);
   assert.equal((await who.request('/api/admin/payments/'+foreignPayment.id,'PATCH',{...payData,student:foreignStudent.id,version:1,reason:'подмена'})).status,404);
   assert.equal((await who.request('/api/admin/gym/groups/'+foreignGroup.id,'PATCH',{name:'Начальная',trainer:'',description:'',status:'active',version:1})).status,404);
   assert.equal((await who.request('/api/admin/gym/sessions/'+foreignSession.id,'PATCH',{...training,groupId:foreignGroup.id,version:1})).status,404);
   assert.equal((await who.request('/api/admin/payments','POST',{...payData,student:foreignStudent.id})).status,422);
   assert.equal((await who.request('/api/admin/gym/sessions','POST',{...training,groupId:foreignGroup.id})).status,422);
  }
  assert.equal((await b.request('/api/admin/finances/'+fin.id)).status,404);
  assert.equal((await b.request('/api/admin/finances/'+fin.id,'PATCH',{kind:'income',amount:1,occurredOn:'2026-11-05',category:'подмена',version:1})).status,404);
  assert.equal((await a.request('/api/admin/gym/sessions/'+ta.id+'/attendance','PATCH',{version:2,marks:[{studentId:sb.id,status:'present'}]})).status,422);
  assert.equal((await b.request('/api/admin/gym/sessions/'+ta.id+'/attendance','PATCH',{version:2,marks:[{studentId:sb.id,status:'present'}]})).status,404);
  assert.equal(await db.attendanceRecord.count(),1);assert.equal((await db.payment.findUnique({where:{id:pb.id}})).version,1);
 });
 await t.test('Итоги без дублирования: оплаты + самостоятельные доходы − расходы',async()=>{
  let summary=(await a.json('/api/admin/gym/summary?month=2026-11')).summary;
  assert.equal(summary.receivedCents,100000);assert.equal(summary.incomeCents,130000);assert.equal(summary.expenseCents,20000);assert.equal(summary.balanceCents,110000);assert.equal(await db.financeEntry.count(),2);
  await a.json('/api/admin/payments/'+pa.id,'PATCH',{...payData,amount:110000,version:1,reason:'Уточнение суммы'});
  summary=(await a.json('/api/admin/gym/summary?month=2026-11')).summary;assert.equal(summary.incomeCents,140000);assert.equal(summary.balanceCents,120000);assert.equal(await db.paymentRevision.count(),1);assert.equal(await db.financeEntry.count(),2);
  assert.equal((await b.json('/api/admin/gym/summary?month=2026-11')).summary.incomeCents,70000);
  assert.equal((await a.json('/api/admin/gym/summary?month=2026-12')).summary.incomeCents,0);
 });
 await t.test('Общий контент доступен обоим тренерам, публикации разрешены, OWNER не выдан',async()=>{
  for(const who of [a,b]){
   for(const url of ['/admin/people','/admin/news','/admin/competitions','/admin/history','/admin/site-pages','/admin/site-documents','/admin/site-media'])assert.equal((await who.request(url)).status,200,url);
   for(const url of ['/api/admin/people','/api/admin/news','/api/admin/competitions','/api/admin/history','/api/admin/site/pages','/api/admin/site/documents'])assert.equal((await who.request(url)).status,200,url);
  }
  const news=(await a.json('/api/admin/news','POST',{title:'Общая новость тренеров',publishedAt:'2026-11-05',category:'Федерация',lead:'Анонс',text:'Полный текст новости',gallery:[],image:'',status:'draft'})).entity;
  assert.equal((await b.json('/api/admin/news/'+news.id)).news.id,news.id);
  await b.json('/api/admin/news/'+news.id+'/publish','POST',{version:news.version});
  assert.equal((await db.news.findUnique({where:{id:news.id}})).status,'published');
  // Exercise every publication service with both trainer accounts.
  for(const [i,who] of [a,b].entries()){
   const story=(await who.json('/api/admin/history','POST',{title:'История '+i,section:'competitions',dateType:'period',period:'1990-е',lead:'Анонс',body:'Текст',gallery:[],sources:[],people:[],competitions:[]})).entity;
   await who.json('/api/admin/history/'+story.id+'/publish','POST',{version:story.version});
   const competition=(await who.json('/api/admin/competitions','POST',{title:'Турнир '+i,startDate:'2026-11-01',endDate:'2026-11-02',location:'Абакан',description:'Описание',eventStatus:'upcoming',disciplines:['Лоу-кик'],program:[],documents:[],results:[],photos:[],participants:[]})).entity;
   await who.json('/api/admin/competitions/'+competition.id+'/publish','POST',{version:competition.version});
   const person=(await who.json('/api/admin/people','POST',{name:'Тренер '+i,primaryRole:'athlete',isAthlete:true,isCoach:false,athleteLegend:false,coachLegend:false,bio:'Биография',portrait:'/site/img/athlete-profile-hero.webp',athleteAwards:[],coachAwards:[],timeline:[],methods:[],publicPupils:[],gallery:[]})).entity;
   await who.json('/api/admin/people/'+person.id+'/publish','POST',{version:person.version});
   const current=(await who.json('/api/admin/site/pages/home')).page;
   const page=(await who.json('/api/admin/site/pages/home','PATCH',{subtitle:'Текст '+i,ctaTitle:'Кикбоксинг',ctaText:'Запишитесь',heroImage:'',ctaImage:'',version:current.version})).page;
   await who.json('/api/admin/site/pages/home/publish','POST',{version:page.version});
   const docData={title:'Документ '+i,category:'Регистрация',date:'2026-11-01',description:'Описание',author:'Федерация',source:'',file:''};
   const doc=(await who.json('/api/admin/site/documents','POST',docData)).document;
   const {PDFDocument}=require('pdf-lib');const pdf=await PDFDocument.create();pdf.addPage();
   const uploaded=await who.json('/api/admin/site/documents/'+doc.id+'/upload-pdf','POST',await pdf.save(),{'content-type':'application/pdf'});
   const savedDoc=(await who.json('/api/admin/site/documents/'+doc.id,'PATCH',{...docData,file:uploaded.src,version:doc.version})).document;
   await who.json('/api/admin/site/documents/'+doc.id+'/publish','POST',{version:savedDoc.version});

  }
  const {canPublish}=await import('../services/permissions.js');for(const login of ['berezkin','sazantsev']){const u=await db.admin.findUnique({where:{login}});assert.equal(u.role,'TRAINER');assert.equal(canPublish(u),true);}
 });
 await t.test('OWNER переключает оба зала, управляет доступом; тренеры и EDITOR не управляют аккаунтами',async()=>{
  for(const gymId of ['school-12','school-25']){const dash=await owner.json('/api/admin/dashboard','GET',undefined,{'x-gym-id':gymId});assert.equal(dash.gymId,gymId);assert.equal(dash.students.length,1);}
  assert.equal((await owner.json('/api/admin/dashboard')).students.length,0);
  assert.equal((await owner.request('/api/admin/access')).status,200);
  for(const who of [a,b,editor]){assert.equal((await who.request('/api/admin/access')).status,403);assert.equal((await who.request('/admin/access')).status,403);assert.equal((await who.request('/api/admin/access','POST',{role:'OWNER'})).status,403);}
  assert.equal((await editor.request('/api/admin/students')).status,403);
  const user=await db.admin.findUnique({where:{login:'sazantsev'}});
  await owner.json('/api/admin/access/'+user.id,'PATCH',{name:user.name,login:user.login,role:'TRAINER',gymId:'school-25',isActive:false});
  assert.equal((await b.request('/api/admin/dashboard')).status,401);
 });
});
