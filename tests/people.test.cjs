const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),{PrismaClient}=require('@prisma/client'),sharp=require('sharp');
test('08.5: люди, четыре шаблона, права, версии, медиа и публичные данные',async t=>{
 const {createApp}=await import('../lib/app.js'),{hashPassword}=await import('../services/password.service.js');
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-people-')),url='file:'+path.join(dir,'test.db').replaceAll('\\','/');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}}),password=randomBytes(24).toString('hex'),passwordHash=await hashPassword(password);
 await db.admin.createMany({data:['OWNER','EDITOR'].map(role=>({login:role.toLowerCase(),name:role,passwordHash,role}))});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1',peopleUploadDir:path.join(dir,'media')},server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});});
 function client(){let cookie='',csrf='';return {async request(route,options={}){const r=await fetch(base+route,{redirect:'manual',...options,headers:{cookie,origin:base,'x-csrf-token':csrf,...options.headers}});const c=r.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(c)cookie=c.split(';')[0];return r;},async json(route,method,body,headers={}){return this.request(route,{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});},async login(login){const r=await this.json('/api/admin/auth/login','POST',{login,password});assert.equal(r.status,200);csrf=(await r.json()).csrfToken;}};}
 const anon=client(),owner=client(),editor=client();await owner.login('owner');await editor.login('editor');
 const draft={name:'Тестов Иван <script> $&',summary:'Публичное описание',bio:'Биография с уникальным словом ПОИСКБИО.\n\n<script>window.XSS=1</script>',quote:'Цитата',isAthlete:true,isCoach:true,showOnHome:true,athleteLegend:true,coachLegend:false,primaryRole:'athlete',portrait:'',coachPortrait:'',storyImage:'',city:'Абакан',club:'Клуб',athleteTitle:'Спортивное звание',coachTitle:'Квалификация тренера',discipline:'Лоу-кик',athleteAwards:[{date:'2024',title:'Личный результат',text:'Описание результата',place:'1'}],coachAwards:[{date:'2025',title:'Тренерский результат',text:'Подтверждённые сведения'}],timeline:[{date:'2010',title:'Первый шаг',text:'История',role:'all'}],methods:[{title:'Техника',text:'Подход к подготовке'}],publicPupils:[],gallery:[]};
 let person,pupil,src,slug;
 const save=async(body,who=editor)=>{const r=await who.json('/api/admin/people'+(person?'/'+person.id:''),person?'PATCH':'POST',body);if(r.ok)person=(await r.json()).entity;return r;};
 const action=async(name,who=owner,version=person.version)=>{const r=await who.json('/api/admin/people/'+person.id+'/'+name,'POST',{version});if(r.ok)person=(await r.json()).entity;return r;};
 await t.test('Пустые каталоги без автоматического импорта макетов; закрытые API и HTTP 404',async()=>{
  for(const route of ['/hall-of-fame','/coaches']){const r=await anon.request(route);assert.equal(r.status,200);assert.ok(!(await r.text()).includes('Имя спортсмена'));}
  assert.equal((await anon.request('/api/admin/people')).status,401);assert.equal((await anon.request('/admin/people')).status,303);
  for(const route of ['/athlete','/athlete-profile','/coach-legend','/coach-profile','/athlete/no-such-id','/people/missing'])assert.equal((await anon.request(route)).status,404,route);
  assert.equal((await owner.request('/admin/person-edit?id=missing')).status,404);assert.equal((await owner.request('/admin/person-preview?id=missing')).status,404);
  for(const route of ['/admin/person-edit?id=working','/admin/person-edit?id=','/admin/person-edit?id[]=x'])assert.equal((await owner.request(route)).status,404);
 });
 await t.test('Создание редактором, серверная валидация ролей и полей, Origin/CSRF',async()=>{
  assert.equal((await save(draft)).status,201);
  for(const bad of [{name:''},{isAthlete:false,athleteLegend:true},{isCoach:false,isAthlete:false,athleteLegend:false},{primaryRole:'other'},{name:'x'.repeat(181)},{gallery:[{src:'/../../secret',category:'training'}]},{publicPupils:[{personId:'private-student'}]}])assert.equal((await save({...draft,...bad,version:person.version})).status,422);
  assert.equal((await editor.json('/api/admin/people/'+person.id,'PATCH',{...draft,version:person.version},{origin:'https://evil.invalid'})).status,403);
  assert.equal((await editor.json('/api/admin/people/'+person.id,'PATCH',{...draft,version:person.version},{'x-csrf-token':'bad'})).status,403);
  assert.equal((await action('publish',editor)).status,403);assert.equal((await action('publish')).status,422);
  assert.deepEqual((await(await anon.request('/api/people/search?q=Тестов')).json()).items,[]);
 });
 await t.test('Изображения: подмена формата, повреждение, лимит, приватность и принадлежность человеку',async()=>{
  const bytes=await sharp({create:{width:24,height:24,channels:3,background:'#447799'}}).png().toBuffer(),route='/api/admin/people/'+person.id+'/upload';
  for(const [b,mime,status]of [[Buffer.from('<svg/>'),'image/svg+xml',422],[Buffer.from('bad'),'image/png',422],[bytes,'image/jpeg',422],[Buffer.alloc(8*1024*1024+1),'image/png',413]])assert.equal((await editor.request(route,{method:'POST',headers:{'content-type':mime},body:b})).status,status);
  const r=await editor.request(route,{method:'POST',headers:{'content-type':'image/png'},body:bytes});assert.equal(r.status,201);src=(await r.json()).src;
  assert.equal((await anon.request(src)).status,404);assert.equal((await anon.request(src.replace('/media/people/','/api/admin/people/media/'))).status,401);assert.equal((await editor.request(src.replace('/media/people/','/api/admin/people/media/'))).status,200);
  assert.equal((await save({...draft,portrait:src,gallery:[{src,alt:'Alt',caption:'Подпись',credit:'Автор',category:'training'}],version:person.version})).status,200);
  const other=await editor.json('/api/admin/people','POST',{...draft,name:'Другой человек',portrait:src});assert.equal(other.status,422);
 });
 await t.test('Закрытый предпросмотр использует правильный шаблон и защищённое изображение',async()=>{
  assert.equal((await anon.request('/admin/person-preview?id='+person.id)).status,303);
  for(const [role,css]of [['athlete','athlete.min.css'],['coach','coach-profile.min.css']]){const r=await owner.request('/admin/person-preview?id='+person.id+'&role='+role);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes(css));assert.ok(html.includes('/api/admin/people/media/'));assert.ok(!html.includes('<script>window.XSS=1</script>'));}
 });
 await t.test('Публикация: один человек с двумя ролями, разные HTML/CSS, общий поиск и главная',async()=>{
  assert.equal((await action('publish')).status,200);slug=person.slug;
  for(const [type,css]of [['athlete','athlete.min.css'],['coach-profile','coach-profile.min.css']]){const r=await anon.request('/'+type+'/'+slug);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('/site/css/'+css));assert.ok(html.includes('Тестов Иван &lt;script&gt; $&'));assert.ok(html.includes('&lt;script&gt;window.XSS=1&lt;/script&gt;'));assert.ok(!html.includes('Демонстрационный профиль'));assert.ok(!html.includes('Панкова'));assert.ok(!html.includes('Чочиев'));}
  const redirect=await anon.request('/people/'+slug);assert.equal(redirect.headers.get('location'),'/athlete/'+slug);
  assert.equal((await anon.request('/athlete?id='+person.id)).headers.get('location'),'/athlete/'+slug);
  for(const route of ['/','/hall-of-fame','/coaches']){const html=await(await anon.request(route)).text();assert.ok(html.includes('Тестов Иван'));assert.ok(!html.includes('PRIVATE-PHONE'));}
  assert.equal((await(await anon.request('/api/people/search?q=ПОИСКБИО')).json()).items.length,1);assert.equal((await anon.request(src)).status,200);
  assert.equal((await action('archive',editor)).status,403);assert.equal((await action('unpublish',editor)).status,403);
 });
 await t.test('Изменение статусов легенды не меняет сайт до публикации; после неё работают два других шаблона',async()=>{
  const stale=person.version;assert.equal((await save({...person,name:'Новая версия',athleteLegend:false,coachLegend:true,version:person.version})).status,200);
  assert.equal(person.hasChanges,true);assert.ok((await(await anon.request('/athlete/'+slug)).text()).includes('Тестов Иван'));
  for(const route of ['/hall-of-fame','/coaches','/api/people/search?q=Новая'])assert.ok(!(await(await anon.request(route)).text()).includes('Новая версия'));
  assert.equal((await action('publish',owner,stale)).status,409);assert.equal((await save({...person,name:'Конфликт',version:stale})).status,409);
  assert.equal((await action('publish')).status,200);assert.equal(person.slug,slug);
  for(const [type,css]of [['athlete-profile','athlete-profile.min.css'],['coach-legend','coach-legend.min.css']]){const r=await anon.request('/'+type+'/'+slug);assert.equal(r.status,200);assert.ok((await r.text()).includes('/site/css/'+css));}
  assert.equal((await anon.request('/athlete/'+slug)).headers.get('location'),'/athlete-profile/'+slug);assert.equal((await anon.request('/coach-profile/'+slug)).headers.get('location'),'/coach-legend/'+slug);
  const hall=await(await anon.request('/hall-of-fame')).text();assert.ok(hall.includes('/coach-legend/'+slug));assert.ok(hall.includes('/athlete-profile/'+slug));
 });
 await t.test('Воспитанники: только публичные спортсмены; снятые скрываются без утечки приватных данных',async()=>{
  const r=await editor.json('/api/admin/people','POST',{...draft,name:'Публичный воспитанник',isCoach:false,athleteLegend:false,portrait:'/site/img/athlete-profile-hero.webp'});assert.equal(r.status,201);pupil=(await r.json()).entity;
  assert.equal((await save({...person,publicPupils:[{personId:pupil.id,description:'Достижение ученика'}],version:person.version})).status,200);assert.equal((await action('publish')).status,200);
  assert.ok(!(await(await anon.request('/coach-legend/'+slug)).text()).includes('Публичный воспитанник'));
  let pub=await owner.json('/api/admin/people/'+pupil.id+'/publish','POST',{version:pupil.version});assert.equal(pub.status,200);pupil=(await pub.json()).entity;
  assert.ok((await(await anon.request('/coach-legend/'+slug)).text()).includes('Публичный воспитанник'));
  assert.equal((await owner.json('/api/admin/people/'+pupil.id+'/unpublish','POST',{version:pupil.version})).status,200);
  assert.ok(!(await(await anon.request('/coach-legend/'+slug)).text()).includes('Публичный воспитанник'));
 });
 await t.test('Одновременные правки и жизненный цикл; прежний slug остаётся зарезервирован',async()=>{
  const version=person.version;const rs=await Promise.all(['A','B'].map(name=>editor.json('/api/admin/people/'+person.id,'PATCH',{...person,name,version})));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);person=(await(await owner.request('/api/admin/people/'+person.id)).json()).person;
  assert.equal((await action('unpublish')).status,200);assert.equal((await anon.request('/people/'+slug)).status,404);assert.equal((await anon.request(src)).status,404);
  assert.equal((await action('archive',editor)).status,200);assert.equal((await action('restore',editor)).status,200);assert.equal(person.hasPublished,false);assert.equal((await anon.request('/coach-legend/'+slug)).status,404);assert.equal((await action('publish')).status,200);assert.equal(person.slug,slug);
 });
 await t.test('Отсутствующий файл не меняет опубликованную версию при отказе публикации',async()=>{
  const file=path.join(config.peopleUploadDir,path.basename(src)),bytes=fs.readFileSync(file),before=await db.person.findUnique({where:{id:person.id}});fs.unlinkSync(file);
  try{assert.equal((await action('publish')).status,422);const after=await db.person.findUnique({where:{id:person.id}});assert.equal(after.version,before.version);assert.equal(after.publishedPayload,before.publishedPayload);}finally{fs.writeFileSync(file,bytes);}
 });
 await t.test('Редактор без учеников и оплат; только открытые поля в публичном поиске',async()=>{
  for(const route of ['/admin/students','/api/admin/students','/api/admin/payments'])assert.equal((await editor.request(route)).status,403);
  const row=await db.student.create({data:{name:'PRIVATE-STUDENT',phone:'PRIVATE-PHONE',price:100,status:'active',start:'2026-01-01'}});
  assert.equal((await save({...person,publicPupils:[{personId:row.id,description:''}],version:person.version})).status,422);
  assert.ok(!(await(await editor.request('/api/admin/dashboard')).text()).includes('PRIVATE-PHONE'));
  assert.deepEqual((await(await anon.request('/api/people/search?q=PRIVATE')).json()).items,[]);
 });
 await t.test('Фотографии: назначения, удаление только неиспользуемых, права, версии и ошибка файловой системы',async()=>{
  const png=await sharp({create:{width:24,height:24,channels:3,background:'#bb4422'}}).png().toBuffer();
  const upload=async()=>{const r=await editor.request('/api/admin/people/'+person.id+'/upload',{method:'POST',headers:{'content-type':'image/png'},body:png});assert.equal(r.status,201);return (await r.json()).src;};
  const media=async()=>{const r=await owner.request('/api/admin/people/'+person.id+'/media');assert.equal(r.status,200);return (await r.json()).assets;};
  const remove=(file,version=person.version,who=editor,headers={})=>who.json('/api/admin/people/'+person.id+'/media/'+path.basename(file),'DELETE',{version},headers);
  const unused=await upload(),unusedPath=path.join(config.peopleUploadDir,path.basename(unused));
  assert.equal((await anon.request('/api/admin/people/'+person.id+'/media')).status,401);
  let rows=await media();assert.equal(rows.find(a=>a.src===unused).canDelete,true);assert.ok(rows.find(a=>a.src===src).published.includes('Основной портрет'));assert.ok(rows.find(a=>a.src===src).working.includes('Основной портрет'));
  assert.equal((await remove(unused,person.version,anon)).status,401);assert.equal((await remove(unused,person.version,editor,{'x-csrf-token':'bad'})).status,403);assert.equal((await remove(unused,person.version,editor,{origin:'https://evil.invalid'})).status,403);
  assert.equal((await remove(src)).status,409);assert.ok(fs.existsSync(path.join(config.peopleUploadDir,path.basename(src))));
  const other=await(await editor.json('/api/admin/people','POST',{...draft,name:'Другой профиль для проверки удаления',portrait:'/site/img/athlete-profile-hero.webp'})).json();
  assert.equal((await editor.json('/api/admin/people/'+other.entity.id+'/media/'+path.basename(unused),'DELETE',{version:other.entity.version})).status,404);
  assert.equal((await remove(unused,person.version+1)).status,409);const oldVersion=person.version;
  let r=await remove(unused);assert.equal(r.status,200);person=(await r.json()).entity;assert.equal(person.version,oldVersion+1);assert.ok(!fs.existsSync(unusedPath));assert.equal(await db.personAsset.count({where:{id:path.basename(unused)}}),0);assert.equal((await remove(unused)).status,404);
  assert.equal((await save({...person,version:oldVersion})).status,409);
  // A real unlink/read failure must not produce success or delete database metadata.
  const failed=await upload(),file=path.join(config.peopleUploadDir,path.basename(failed)),copy=file+'.saved';fs.renameSync(file,copy);fs.mkdirSync(file);
  const before=person.version,audits=await db.auditLog.count({where:{action:'delete-photo'}}),expectedLogs=[],originalError=console.error;
  console.error=(...args)=>{if(args[0]==='Request failed:')expectedLogs.push(args);else originalError(...args);};
  try{r=await remove(failed);assert.equal(r.status,500);assert.equal((await r.json()).success,false);assert.equal((await db.person.findUnique({where:{id:person.id}})).version,before);assert.equal(await db.personAsset.count({where:{id:path.basename(failed)}}),1);assert.equal(await db.auditLog.count({where:{action:'delete-photo'}}),audits);}finally{console.error=originalError;fs.rmdirSync(file);fs.renameSync(copy,file);}assert.equal(expectedLogs.length,1);
  r=await remove(failed);assert.equal(r.status,200);person=(await r.json()).entity;
  // A database rollback after removing bytes restores the unused file as well.
  const rollbackSrc=await upload(),rollbackPath=path.join(config.peopleUploadDir,path.basename(rollbackSrc)),rollbackBytes=fs.readFileSync(rollbackPath),rollbackVersion=person.version;
  const {deletePersonMedia}=await import('../services/people-media.service.js'),actor=await db.admin.findUnique({where:{login:'owner'}});
  const failingDb={$transaction:run=>db.$transaction(async tx=>{await run(tx);throw Error('Commit simulation');})};
  await assert.rejects(deletePersonMedia(failingDb,config,{params:{id:person.id,file:path.basename(rollbackSrc)},body:{version:person.version},user:actor}),/Commit simulation/);
  assert.deepEqual(fs.readFileSync(rollbackPath),rollbackBytes);assert.equal(await db.personAsset.count({where:{id:path.basename(rollbackSrc)}}),1);assert.equal((await db.person.findUnique({where:{id:person.id}})).version,rollbackVersion);
  r=await remove(rollbackSrc);assert.equal(r.status,200);person=(await r.json()).entity;

  // Removing a photo in the working copy does not allow deleting the live site's photo.
  assert.equal((await save({...person,portrait:'/site/img/athlete-profile-hero.webp',gallery:[],coachPortrait:'',storyImage:'',version:person.version})).status,200);
  rows=await media();assert.deepEqual(rows.find(a=>a.src===src).working,[]);assert.ok(rows.find(a=>a.src===src).published.length>0);assert.equal((await remove(src)).status,409);assert.equal((await anon.request(src)).status,200);
  assert.equal((await action('publish')).status,200);r=await remove(src);assert.equal(r.status,200);person=(await r.json()).entity;assert.ok(!fs.existsSync(path.join(config.peopleUploadDir,path.basename(src))));assert.equal((await anon.request(src)).status,404);
 });

 await t.test('Второе фото легенды: индивидуальное назначение, публикация и защита удаления',async()=>{
  const png=await sharp({create:{width:32,height:32,channels:3,background:'#44aa66'}}).png().toBuffer();
  let r=await editor.request('/api/admin/people/'+person.id+'/upload',{method:'POST',headers:{'content-type':'image/png'},body:png});assert.equal(r.status,201);const hoverSrc=(await r.json()).src;
  assert.equal((await save({...person,athleteLegend:true,coachLegend:false,primaryRole:'athlete',hallHoverPhoto:hoverSrc,version:person.version})).status,200);
  assert.equal((await anon.request(hoverSrc)).status,404);
  assert.equal((await save({...person,hallHoverPhoto:'/../../secret.png',version:person.version})).status,422);
  const draftHtml=await(await owner.request('/admin/person-edit?id='+person.id)).text();assert.ok(draftHtml.includes('/site/scripts/admin/person-edit.js'));
  assert.equal((await action('publish')).status,200);
  let html=await(await anon.request('/hall-of-fame')).text();assert.ok(html.includes('hall-legend__photo--swap'));assert.ok(html.includes('class="hall-legend__photo-hover" src="'+hoverSrc+'"'));assert.ok(!html.includes('/site/img/natasha2.png'));
  assert.equal((await anon.request(hoverSrc)).status,200);
  const assets=(await(await owner.request('/api/admin/people/'+person.id+'/media')).json()).assets;const photo=assets.find(x=>x.src===hoverSrc);assert.ok(photo.working.some(x=>x.includes('Второе фото')));assert.ok(photo.published.some(x=>x.includes('Второе фото')));assert.equal(photo.canDelete,false);
  const del=()=>editor.json('/api/admin/people/'+person.id+'/media/'+path.basename(hoverSrc),'DELETE',{version:person.version});assert.equal((await del()).status,409);
  assert.equal((await save({...person,hallHoverPhoto:'',version:person.version})).status,200);
  html=await(await anon.request('/hall-of-fame')).text();assert.ok(html.includes('class="hall-legend__photo-hover" src="'+hoverSrc+'"'));assert.equal((await del()).status,409);
  assert.equal((await action('publish')).status,200);html=await(await anon.request('/hall-of-fame')).text();assert.ok(!html.includes('class="hall-legend__photo-hover" src="'+hoverSrc+'"'));
  r=await del();assert.equal(r.status,200);person=(await r.json()).entity;assert.equal((await anon.request(hoverSrc)).status,404);assert.ok(!fs.existsSync(path.join(config.peopleUploadDir,path.basename(hoverSrc))));
 });

});
