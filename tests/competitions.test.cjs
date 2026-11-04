const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),{PrismaClient}=require('@prisma/client'),sharp=require('sharp');
test('08.6: соревнования, PDF, публикации, файлы и единый публичный источник',async t=>{
 const {createApp}=await import('../lib/app.js'),{hashPassword}=await import('../services/password.service.js');
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-competitions-')),url='file:'+path.join(dir,'test.db').replaceAll('\\','/');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}}),password=randomBytes(24).toString('hex'),passwordHash=await hashPassword(password);
 await db.admin.createMany({data:['OWNER','EDITOR'].map(role=>({login:role.toLowerCase(),name:role,passwordHash,role}))});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1',competitionUploadDir:path.join(dir,'media')},server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});});
 function client(){let cookie='',csrf='';return {async request(route,options={}){const r=await fetch(base+route,{redirect:'manual',...options,headers:{cookie,origin:base,'x-csrf-token':csrf,...options.headers}});const c=r.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(c)cookie=c.split(';')[0];return r;},async json(route,method,body,headers={}){return this.request(route,{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});},async login(login){const r=await this.json('/api/admin/auth/login','POST',{login,password});assert.equal(r.status,200);csrf=(await r.json()).csrfToken;}};}
 const anon=client(),owner=client(),editor=client();await owner.login('owner');await editor.login('editor');

 const {PDFDocument,PDFName}=require('pdf-lib');
 const draft={title:'Турнир <script> $&',lead:'Тестовый анонс',startDate:'2027-02-12',endDate:'2027-02-14',location:'Абакан',organizer:'Федерация',description:'ОПУБЛИКОВАННЫЙТЕКСТ <script>window.XSS=1</script>\nОписание',eventStatus:'upcoming',disciplines:['Лоу-кик'],program:[{time:'12 февраля, 09:00',title:'Взвешивание',description:'Проверка документов'}],image:'',documents:[],results:[],photos:[],participants:[]};
 let competition,src,pdf,slug;
 const save=async(body,who=editor)=>{const r=await who.json('/api/admin/competitions'+(competition?'/'+competition.id:''),competition?'PATCH':'POST',body);if(r.ok)competition=(await r.json()).entity;return r;};
 const action=async(name,who=owner,v=competition.version)=>{const r=await who.json('/api/admin/competitions/'+competition.id+'/'+name,'POST',{version:v});if(r.ok)competition=(await r.json()).entity;return r;};
 const upload=async(body,mime,kind='image',who=editor)=>who.request('/api/admin/competitions/'+competition.id+'/upload-'+kind,{method:'POST',headers:{'content-type':mime},body});
 const remove=async(s,v=competition.version)=>{const r=await editor.json('/api/admin/competitions/'+competition.id+'/media/'+path.basename(s),'DELETE',{version:v});if(r.ok)competition=(await r.json()).entity;return r;};
 const search=async(q)=> (await(await anon.request('/api/competitions/search?q='+encodeURIComponent(q))).json()).items;
 await t.test('Пустая база, 404, закрытые API, создание редактором, серверная валидация',async()=>{
  assert.equal((await anon.request('/api/admin/competitions')).status,401);assert.equal((await anon.request('/admin/competitions')).status,303);
  for(const route of ['/competition','/competition?id=demo-upcoming','/competitions/missing'])assert.equal((await anon.request(route)).status,404);
  for(const route of ['/admin/competition-edit?id=','/admin/competition-edit?id[]=x','/admin/competition-edit?id=missing','/admin/competition-preview'])assert.equal((await owner.request(route)).status,404);
  assert.deepEqual((await(await anon.request('/api/competitions')).json()).competitions,[]);assert.ok(!(await(await anon.request('/')).text()).includes('Демонстрационный календарь'));
  assert.equal((await save(draft)).status,201);
  for(const change of [{title:''},{endDate:'2027-01-01'},{startDate:'2027-02-30'},{eventStatus:'published'},{documents:[{title:'bad',url:'javascript:alert(1)'}]},{participants:['private-student']},{photos:Array(31).fill({src:'/media/competitions/'+ 'a'.repeat(48)+'.webp'})},{program:[null]},{disciplines:['x'.repeat(151)]}])assert.equal((await save({...draft,...change,version:competition.version})).status,422);
  assert.equal((await editor.json('/api/admin/competitions/'+competition.id,'PATCH',{...draft,version:competition.version},{origin:'https://evil.invalid'})).status,403);
  assert.equal((await editor.json('/api/admin/competitions/'+competition.id,'PATCH',{...draft,version:competition.version},{'x-csrf-token':'bad'})).status,403);
  assert.equal((await action('publish',editor)).status,403);assert.deepEqual(await search('Турнир'),[]);
 });
 await t.test('Загрузка фото: тип, сигнатура, размер, перекодирование, доступ и принадлежность',async()=>{
  const bytes=await sharp({create:{width:30,height:20,channels:3,background:'#445588'}}).png().toBuffer();
  for(const [b,mime,status]of [[Buffer.from('<svg/>'),'image/svg+xml',422],[bytes,'image/jpeg',422],[Buffer.from('bad'),'image/png',422],[Buffer.alloc(8*1024*1024+1),'image/png',413]])assert.equal((await upload(b,mime)).status,status);
  assert.equal((await upload(bytes,'image/png','image',anon)).status,401);
  for(const headers of [{origin:'https://evil.invalid'},{'x-csrf-token':'bad'}])assert.equal((await editor.request('/api/admin/competitions/'+competition.id+'/upload-image',{method:'POST',headers:{'content-type':'image/png',...headers},body:bytes})).status,403);
  let r=await upload(bytes,'image/png');assert.equal(r.status,201);src=(await r.json()).src;
  assert.equal((await anon.request(src)).status,404);assert.equal((await anon.request(src.replace('/media/competitions/','/api/admin/competitions/media/'))).status,401);
  r=await editor.request(src.replace('/media/competitions/','/api/admin/competitions/media/'));assert.equal(r.status,200);assert.equal((await sharp(Buffer.from(await r.arrayBuffer())).metadata()).format,'webp');
  assert.equal((await editor.json('/api/admin/competitions','POST',{...draft,image:src})).status,422);
 });
 await t.test('PDF: реальный разбор, размер, тип, JavaScript, формы и вложения отклоняются',async()=>{
  const doc=await PDFDocument.create();doc.addPage([200,200]);const bytes=await doc.save();
  for(const [b,mime,status]of [[Buffer.from('<html>bad</html>'),'application/pdf',422],[Buffer.from('%PDF-1.7\nbad'),'application/pdf',422],[bytes,'text/html',422],[Buffer.alloc(10*1024*1024+1),'application/pdf',413]])assert.equal((await upload(b,mime,'document')).status,status);
  const blank=await PDFDocument.create();assert.equal((await upload(await blank.save({addDefaultPage:false}),'application/pdf','document')).status,422);
  for(const key of ['OpenAction','AA','EmbeddedFiles','AcroForm']){const d=await PDFDocument.create();d.addPage();d.catalog.set(PDFName.of(key),d.context.obj({S:'JavaScript',JS:'alert(1)'}));assert.equal((await upload(await d.save(),'application/pdf','document')).status,422,key);}
  const r=await upload(bytes,'application/pdf','document');assert.equal(r.status,201);pdf=(await r.json()).src;assert.equal((await anon.request(pdf)).status,404);
  const privateFile=await owner.request(pdf.replace('/media/competitions/','/api/admin/competitions/media/'));assert.equal(privateFile.status,200);assert.match(privateFile.headers.get('content-disposition'),/^attachment/);assert.equal(privateFile.headers.get('x-content-type-options'),'nosniff');
 });
 await t.test('Сохранение файлов, закрытый предпросмотр и блокировка удаления используемых файлов',async()=>{
  assert.equal((await save({...competition,image:src,photos:[{src,alt:'Фото',caption:'Подпись',credit:'Автор',category:'Награждение'}],documents:[{title:'Положение',url:pdf}],results:[{title:'Протокол',url:pdf}],resultsText:'ИТОГИ ТУРНИРА',version:competition.version})).status,200);
  assert.equal((await anon.request('/admin/competition-preview?id='+competition.id)).status,303);
  const r=await editor.request('/admin/competition-preview?id='+competition.id);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const html=await r.text();assert.ok(html.includes('/api/admin/competitions/media/'));assert.ok(html.includes('&lt;script&gt;window.XSS=1&lt;/script&gt;'));assert.ok(html.includes('Турнир &lt;script&gt; $&'));assert.ok(!html.includes('<script>window.XSS=1</script>'));assert.ok(html.includes('competition.min.css'));
  assert.equal((await remove(src)).status,409);assert.equal((await remove(pdf)).status,409);
 });
 await t.test('Публикация владельцем, каталог, страница, главная, поиск и постоянные ссылки',async()=>{
  assert.equal((await action('publish')).status,200);slug=competition.slug;
  for(const route of ['/competitions','/competitions/'+slug,'/']){const r=await anon.request(route);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('Турнир'),route);assert.ok(!html.includes('demo-upcoming'));assert.ok(!html.includes('<script>window.XSS=1</script>'));}
  const html=await(await anon.request('/competitions/'+slug)).text();assert.ok(html.includes('ИТОГИ ТУРНИРА'));assert.ok(html.includes('Положение'));assert.ok(html.includes('Подпись'));assert.ok(html.includes('Автор'));
  assert.ok((await(await anon.request('/')).text()).includes('hero__event-details'));assert.ok((await(await anon.request('/')).text()).includes('hero__confirmed-date'));
  assert.equal((await anon.request('/competition?id='+competition.id)).headers.get('location'),'/competitions/'+slug);
  assert.equal((await search('ОПУБЛИКОВАННЫЙТЕКСТ')).length,1);assert.equal((await anon.request(src)).status,200);assert.equal((await anon.request(pdf)).status,200);
  assert.equal((await action('unpublish',editor)).status,403);assert.equal((await action('archive',editor)).status,403);
 });
 await t.test('Участники берутся только из опубликованных публичных профилей',async()=>{
  const payload={name:'ПУБЛИЧНЫЙУЧАСТНИК',primaryRole:'athlete',isAthlete:true,isCoach:false,athleteLegend:false,coachLegend:false};
  let person=await db.person.create({data:{name:payload.name,payload:JSON.stringify(payload)}});
  assert.equal((await save({...competition,participants:[person.id],version:competition.version})).status,200);assert.equal((await action('publish')).status,200);
  assert.ok(!(await(await anon.request('/competitions/'+slug)).text()).includes(payload.name));
  await db.person.update({where:{id:person.id},data:{status:'published',slug:'participant',publishedPayload:JSON.stringify(payload)}});
  assert.ok((await(await anon.request('/competitions/'+slug)).text()).includes('/athlete-profile/participant'));
  await db.person.update({where:{id:person.id},data:{status:'draft',publishedPayload:null}});
  assert.ok(!(await(await anon.request('/competitions/'+slug)).text()).includes(payload.name));
 });
 await t.test('Рабочие правки и файлы не меняют опубликованный снимок; конфликты 409',async()=>{
  const stale=competition.version;
  assert.equal((await save({...competition,title:'СЕКРЕТЧЕРНОВИКА',description:'Рабочий текст',documents:[],results:[],photos:[],image:'',version:competition.version})).status,200);
  assert.equal(competition.hasChanges,true);assert.deepEqual(await search('СЕКРЕТЧЕРНОВИКА'),[]);
  for(const route of ['/competitions','/competitions/'+slug,'/']){const html=await(await anon.request(route)).text();assert.ok(html.includes('Турнир'));assert.ok(!html.includes('СЕКРЕТЧЕРНОВИКА'));}
  assert.equal((await anon.request(src)).status,200);assert.equal((await anon.request(pdf)).status,200);assert.equal((await remove(pdf)).status,409);
  assert.equal((await action('publish',owner,stale)).status,409);assert.equal((await save({...competition,version:stale})).status,409);
  const v=competition.version,rs=await Promise.all(['A','B'].map(title=>editor.json('/api/admin/competitions/'+competition.id,'PATCH',{...competition,title,version:v})));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);competition=(await(await owner.request('/api/admin/competitions/'+competition.id)).json()).competition;
 });
 await t.test('Обновление публикации, удаление свободных файлов и архив / восстановление',async()=>{
  assert.equal((await action('publish')).status,200);assert.equal(competition.slug,slug);assert.equal((await anon.request(pdf)).status,404);
  const stale=competition.version;assert.equal((await remove(pdf)).status,200);assert.equal((await remove(src,stale)).status,409);assert.equal((await remove(src)).status,200);
  assert.equal(fs.existsSync(path.join(config.competitionUploadDir,path.basename(pdf))),false);
  assert.equal((await action('unpublish')).status,200);assert.equal((await anon.request('/competitions/'+slug)).status,404);assert.equal((await action('archive',editor)).status,200);assert.equal((await save({...competition})).status,422);assert.equal((await action('restore',editor)).status,200);assert.equal(competition.hasPublished,false);assert.equal((await anon.request('/competitions/'+slug)).status,404);assert.equal((await action('publish')).status,200);assert.equal(competition.slug,slug);
 });
 await t.test('Отсутствующий файл не портит публикацию; приватные ученики и оплаты недоступны',async()=>{
  const r=await upload(await sharp({create:{width:10,height:10,channels:3,background:'#775533'}}).png().toBuffer(),'image/png');assert.equal(r.status,201);const newSrc=(await r.json()).src;
  assert.equal((await save({...competition,image:newSrc,version:competition.version})).status,200);fs.unlinkSync(path.join(config.competitionUploadDir,path.basename(newSrc)));assert.equal((await action('publish')).status,422);assert.ok(!(await(await anon.request('/competitions/'+slug)).text()).includes(newSrc));
  const data=await(await editor.request('/api/admin/dashboard')).json();assert.deepEqual(data.students,[]);assert.deepEqual(data.payments,[]);for(const route of ['/api/admin/students','/api/admin/payments'])assert.equal((await editor.request(route)).status,403);
 });
});
