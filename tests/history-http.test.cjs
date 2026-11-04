const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),{PrismaClient}=require('@prisma/client'),sharp=require('sharp');
test('08.7 HTTP integration: материалы, права, галерея 50, поиск, 404, приватность и публикации',async t=>{
 const {createApp}=await import('../lib/app.js'),{hashPassword}=await import('../services/password.service.js');
 const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fed-history-http-')),url='file:'+path.join(tmp,'test.db').replaceAll('\\','/');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}}),password=randomBytes(24).toString('hex'),hash=await hashPassword(password);
 await db.admin.createMany({data:['OWNER','EDITOR'].map(role=>({login:role.toLowerCase(),name:role,passwordHash:hash,role}))});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1',historyUploadDir:path.join(tmp,'history-media'),peopleUploadDir:path.join(tmp,'people-media'),competitionUploadDir:path.join(tmp,'competition-media'),newsUploadDir:path.join(tmp,'news-media')};
 const server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();await fs.promises.rm(tmp,{recursive:true,force:true,maxRetries:10,retryDelay:150});});
 function client(){let cookie='',csrf='';return {async request(route,opts={}){const r=await fetch(base+route,{redirect:'manual',...opts,headers:{origin:base,cookie,'x-csrf-token':csrf,...opts.headers}});const c=r.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session='));if(c)cookie=c.split(';')[0];return r;},json(route,method,body,headers={}){return this.request(route,{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});},async login(name){const r=await this.json('/api/admin/auth/login','POST',{login:name,password});assert.equal(r.status,200);csrf=(await r.json()).csrfToken;}};}
 const anon=client(),owner=client(),editor=client();await owner.login('owner');await editor.login('editor');
 const draft={title:'ИСТОРИЯПУБЛИКУЕМАЯ',section:'competitions',dateType:'period',date:'',period:'1990-е',lead:'Исторический анонс',body:'ОПУБЛИКОВАННЫЙТЕКСТ <script>evil()</script>',author:'Автор',cover:'',coverAlt:'',coverCaption:'',coverCredit:'',gallery:[],sources:[{title:'Свидетельство',url:'https://example.org',note:'Описание'}],people:[],competitions:[],detail:true};
 let p,slug,first;
 const save=async(body,who=editor)=>{const r=await who.json('/api/admin/history'+(p?'/'+p.id:''),p?'PATCH':'POST',body);if(r.ok)p=(await r.json()).entity;return r;};
 const action=async(name,who=owner,v=p.version)=>{const r=await who.json('/api/admin/history/'+p.id+'/'+name,'POST',{version:v});if(r.ok)p=(await r.json()).entity;return r;};
 const upload=(bytes,mime='image/png',who=editor)=>who.request('/api/admin/history/'+p.id+'/upload-image',{method:'POST',headers:{'content-type':mime},body:bytes});
 await t.test('Пустая история, закрытые административные страницы и корректные 404',async()=>{
  assert.deepEqual((await(await anon.request('/api/history')).json()).materials,[]);
  assert.equal((await anon.request('/api/admin/history')).status,401);
  assert.equal((await anon.request('/admin/history')).status,303);
  assert.equal((await anon.request('/admin/history-preview?id=missing')).status,303);
  assert.equal((await owner.request('/admin/history-preview?id=missing')).status,404);
  assert.equal((await owner.request('/admin/history-edit?id=missing')).status,404);
  assert.equal((await anon.request('/history/invalid')).status,404);
  const html=await(await anon.request('/history')).text();assert.ok(!html.includes('Демонстрационная глава'));assert.ok(html.includes('пока не опубликован'));
 });
 await t.test('Сохранение редактором, CSRF, версия и валидация',async()=>{
  assert.equal((await save(draft)).status,201);
  for(const patch of [{title:''},{dateType:'exact',date:'2025-02-30'},{section:'unknown'},{sources:[{title:'bad',url:'javascript:alert(1)'}]},{people:['private-student']},{gallery:Array(51).fill({src:'/media/history/'+'a'.repeat(48)+'.webp'})}])assert.equal((await save({...draft,...patch,version:p.version})).status,422);
  assert.equal((await editor.json('/api/admin/history/'+p.id,'PATCH',{...draft,version:p.version},{origin:'https://invalid.example'})).status,403);
  assert.equal((await editor.json('/api/admin/history/'+p.id,'PATCH',{...draft,version:p.version},{'x-csrf-token':'invalid'})).status,403);
  assert.equal((await action('publish',editor)).status,403);
  assert.deepEqual((await(await anon.request('/api/history/search?q=ИСТОРИЯПУБЛИКУЕМАЯ')).json()).items,[]);
 });
 await t.test('Типы, сигнатуры, размер, 50 загрузок и отсутствие публичного доступа до публикации',async()=>{
  const image=await sharp({create:{width:18,height:13,channels:3,background:'#445588'}}).png().toBuffer();
  for(const [bytes,mime,status] of [[Buffer.from('<svg/>'),'image/svg+xml',422],[image,'image/jpeg',422],[Buffer.from('bad'),'image/png',422],[Buffer.alloc(8*1024*1024+1),'image/png',413]])assert.equal((await upload(bytes,mime)).status,status);
  assert.equal((await upload(image,'image/png',anon)).status,401);
  const gallery=[];for(let i=0;i<50;i++){const r=await upload(image);assert.equal(r.status,201,'Upload '+i);const {src}=await r.json();gallery.push({src,alt:'Фото '+(i+1),caption:'Снимок '+(i+1),credit:'Федерация'});}
  first=gallery[0].src;
  assert.equal((await anon.request(first)).status,404);
  assert.equal((await anon.request(first.replace('/media/history/','/api/admin/history/media/'))).status,401);
  assert.equal((await editor.request(first.replace('/media/history/','/api/admin/history/media/'))).status,200);
  assert.equal((await save({...draft,cover:first,gallery,version:p.version})).status,200);
  assert.equal((await save({...draft,gallery:[...gallery,gallery[0]],version:p.version})).status,422);
  const media=await(await editor.request('/api/admin/history/'+p.id+'/media')).json();assert.equal(media.assets.length,50);assert.equal(media.assets.find(x=>x.src===first).canDelete,false);
  assert.equal((await editor.json('/api/admin/history/'+p.id+'/media/'+path.basename(first),'DELETE',{version:p.version})).status,409);
  assert.equal((await anon.request('/admin/history-preview?id='+p.id)).status,303);
  const preview=await(await editor.request('/admin/history-preview?id='+p.id)).text();assert.ok(preview.includes('/api/admin/history/media/'));assert.ok(!preview.includes('<script>evil()</script>'));
 });
 await t.test('Публикация, чистый адрес, единый публичный источник и безопасный поиск',async()=>{
  assert.equal((await action('publish')).status,200);slug=p.slug;
  assert.ok(slug.startsWith('archive-'));
  assert.equal((await anon.request(first)).status,200);
  const html=await(await anon.request('/history/'+slug)).text();assert.ok(html.includes('ОПУБЛИКОВАННЫЙТЕКСТ'));assert.ok(!html.includes('<script>evil()</script>'));assert.ok(html.includes('Снимок 1'));
  const index=await(await anon.request('/history')).text();assert.ok(index.includes(draft.title));assert.ok(index.includes('Фотоархив'));
  assert.equal((await(await anon.request('/api/history/search?q=ИСТОРИЯПУБЛИКУЕМАЯ')).json()).items.length,1);
  assert.equal((await action('unpublish',editor)).status,403);
 });
 await t.test('Неопубликованные связи исключены, рабочая версия не меняет публичную',async()=>{
  const person=await db.person.create({data:{name:'ЗАКРЫТЫЙСПОРТСМЕН',payload:JSON.stringify({name:'ЗАКРЫТЫЙСПОРТСМЕН'})}}),competition=await db.competition.create({data:{title:'ЗАКРЫТЫЙТУРНИР',payload:JSON.stringify({title:'ЗАКРЫТЫЙТУРНИР'})}});
  assert.equal((await save({...draft,title:'СЕКРЕТЧЕРНОВИКА',body:'НОВЫЙТЕКСТ',gallery:[],cover:'',people:[person.id],competitions:[competition.id],version:p.version})).status,200);
  const html=await(await anon.request('/history/'+slug)).text();assert.ok(html.includes('ОПУБЛИКОВАННЫЙТЕКСТ'));assert.ok(!html.includes('СЕКРЕТЧЕРНОВИКА'));assert.ok(!html.includes('ЗАКРЫТЫЙ'));
  assert.equal((await anon.request(first)).status,200);
  assert.equal((await(await anon.request('/api/history/search?q=СЕКРЕТЧЕРНОВИКА')).json()).items.length,0);
  assert.equal((await editor.json('/api/admin/history/'+p.id+'/media/'+path.basename(first),'DELETE',{version:p.version})).status,409);
  assert.equal((await action('publish',owner,p.version-1)).status,409);
  const v=p.version,results=await Promise.all(['A','B'].map(title=>editor.json('/api/admin/history/'+p.id,'PATCH',{...draft,title,version:v})));assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);p=(await(await owner.request('/api/admin/history/'+p.id)).json()).material;
 });
 await t.test('Обновление снимка, снятие, удаление файлов и восстановление без публикации',async()=>{
  assert.equal((await action('publish')).status,200);assert.equal(p.slug,slug);assert.equal((await anon.request(first)).status,404);
  const del=await editor.json('/api/admin/history/'+p.id+'/media/'+path.basename(first),'DELETE',{version:p.version});assert.equal(del.status,200);p=(await del.json()).entity;
  assert.equal((await action('unpublish')).status,200);assert.equal((await anon.request('/history/'+slug)).status,404);
  assert.equal((await action('archive',editor)).status,200);assert.equal((await action('restore',editor)).status,200);assert.equal(p.status,'draft');assert.equal(p.hasPublished,false);assert.equal((await anon.request('/history/'+slug)).status,404);
  for(const route of ['/api/admin/students','/api/admin/payments'])assert.equal((await editor.request(route)).status,403);
 });
});
