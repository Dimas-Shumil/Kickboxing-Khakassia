const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {execFileSync}=require('node:child_process');const {randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');const sharp=require('sharp');
test('08.4: полный цикл новостей на отдельной базе и в отдельной папке файлов',async t=>{
 const {createApp}=await import('../lib/app.js');const {hashPassword}=await import('../services/password.service.js');
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-news-')),url='file:'+path.join(dir,'test.db');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}}),password=randomBytes(24).toString('base64url'),passwordHash=await hashPassword(password);
 await db.admin.createMany({data:['OWNER','EDITOR'].map(role=>({login:role.toLowerCase(),name:role,passwordHash,role}))});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1',uploadDir:path.join(dir,'media')};
 const server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});});
 function client(){let cookie='',csrf='';return {async request(route,options={}){const r=await fetch(base+route,{redirect:'manual',...options,headers:{cookie,origin:base,'x-csrf-token':csrf,...options.headers}});const c=r.headers.getSetCookie().find(s=>s.startsWith('fed_admin_session='));if(c)cookie=c.split(';')[0];return r;},async json(route,method,body,headers={}){return this.request(route,{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});},async login(login){const r=await this.json('/api/admin/auth/login','POST',{login,password});assert.equal(r.status,200);csrf=(await r.json()).csrfToken;}};}
 const anon=client(),owner=client(),editor=client();await owner.login('owner');await editor.login('editor');
 const draft={title:'Исходный заголовок <script> $&',category:'Федерация',publishedAt:'2026-11-04',author:'Автор',lead:'Публичный анонс',text:'Первая строка\n\n<script>window.XSS=1</script> $&',status:'draft',cover:'',alt:'',coverCaption:'',coverCredit:'',gallery:[],source:{title:'Источник',url:'https://example.com/'}};
 let n,src,slug;
 const row=async()=>{const r=await owner.request('/api/admin/news/'+n.id);assert.equal(r.status,200);return (await r.json()).news;};
 const action=async(name,who=owner,version=n.version)=>{const r=await who.json('/api/admin/news/'+n.id+'/'+name,'POST',{version});if(r.ok)n=(await r.json()).entity;return r;};
 const png=await sharp({create:{width:20,height:15,channels:3,background:'#cc2244'}}).png().toBuffer();
 await t.test('Пустая SQLite: нет демоновостей; HTTP 404 неизвестных/неопубликованных страниц',async()=>{
  assert.deepEqual((await(await anon.request('/api/news')).json()).news,[]);
  assert.equal((await anon.request('/news/no-such-slug')).status,404);assert.equal((await anon.request('/news-item?id=demo-calendar')).status,404);
  for(const route of ['/','/news']){const r=await anon.request(route);assert.equal(r.status,200);const html=await r.text();assert.ok(!html.includes('demo-calendar'));assert.ok(!html.includes('Навстречу новым стартам'));}
  assert.equal((await anon.request('/admin/news-preview?id=working')).status,303);
 });
 await t.test('Создание редактором, валидация, закрытый предпросмотр, приватность поиска',async()=>{
  let r=await editor.json('/api/admin/news','POST',draft);assert.equal(r.status,201);n=(await r.json()).entity;
  for(const [key,value]of [['title',''],['publishedAt','2026-02-30'],['cover','/../../secret'],['source',{url:'javascript:alert(1)'}],['gallery',Array(31).fill({src:''})]])assert.equal((await editor.json('/api/admin/news','POST',{...draft,[key]:value})).status,422,key);
  assert.equal((await owner.request('/admin/news-preview?id='+n.id)).status,200);
  assert.equal((await anon.request('/api/admin/news/'+n.id)).status,401);
  assert.equal((await anon.request('/news-item?id='+n.id)).status,404);
  assert.deepEqual((await(await anon.request('/api/news/search?q=Исходный')).json()).items,[]);
  for(const name of ['publish','unpublish'])assert.equal((await action(name,editor)).status,403,name);
  assert.equal((await editor.json('/api/admin/news/'+n.id,'PATCH',{...draft,status:'published',version:n.version})).status,422);
  assert.equal((await action('archive',editor)).status,200);assert.equal((await action('restore',editor)).status,200);assert.equal(n.status,'draft');
 });
 await t.test('Загрузка: роль/Origin/CSRF/тип/сигнатура/размер; перекодирование и приватность файла',async()=>{
  const route='/api/admin/news/'+n.id+'/upload',upload=(who,bytes=png,mime='image/png',headers={})=>who.request(route,{method:'POST',body:bytes,headers:{'content-type':mime,...headers}});
  assert.equal((await upload(anon)).status,401);assert.equal((await upload(editor,png,'image/png',{'x-csrf-token':'bad'})).status,403);
  assert.equal((await upload(editor,png,'image/png',{origin:'https://evil.invalid'})).status,403);
  for(const [bytes,mime]of [[Buffer.from('<svg onload="evil()"/>'),'image/svg+xml'],[Buffer.from('bad'),'image/png'],[png,'image/jpeg'],[png.subarray(0,45),'image/png']])assert.equal((await upload(editor,bytes,mime)).status,422);
  assert.equal((await upload(editor,Buffer.alloc(8*1024*1024+1))).status,413);
  const r=await upload(editor);assert.equal(r.status,201);src=(await r.json()).src;assert.match(src,/^\/media\/news\/[a-f0-9]{48}\.webp$/);
  const bytes=fs.readFileSync(path.join(config.uploadDir,path.basename(src)));const meta=await sharp(bytes).metadata();assert.equal(meta.format,'webp');assert.ok(!meta.exif);
  assert.equal((await anon.request(src)).status,404);assert.equal((await anon.request('/api/admin/news/media/'+path.basename(src))).status,401);
  assert.equal((await editor.request('/api/admin/news/media/'+path.basename(src))).status,200);
  let saved=await editor.json('/api/admin/news/'+n.id,'PATCH',{...draft,cover:src,gallery:[{src,caption:'Подпись',alt:'Описание',source:'Фото'}],version:n.version});assert.equal(saved.status,200);n=(await saved.json()).entity;
  const other=await(await editor.json('/api/admin/news','POST',draft)).json();assert.equal((await editor.json('/api/admin/news/'+other.entity.id,'PATCH',{...draft,cover:src,version:other.entity.version})).status,422);
 });
 await t.test('Публикация владельцем и единый публичный источник; безопасный HTML',async()=>{
  assert.equal((await action('publish')).status,200);slug=n.slug;assert.ok(slug);assert.equal(n.hasPublished,true);
  const published=(await(await anon.request('/api/news')).json()).news;assert.equal(published.length,1);assert.equal(published[0].title,draft.title);assert.equal(published[0].slug,slug);assert.ok(!('version'in published[0]));
  const detail=await anon.request('/news/'+slug);assert.equal(detail.status,200);const html=await detail.text();assert.ok(html.includes('&lt;script&gt;window.XSS=1&lt;/script&gt; $&'));assert.ok(!html.includes('<script>window.XSS=1'));assert.ok(html.includes('Первая строка'));
  assert.equal((await anon.request('/news-item?id='+n.id)).headers.get('location'),'/news/'+slug);
  for(const route of ['/','/news']){const html=await(await anon.request(route)).text();assert.ok(html.includes('Исходный заголовок'));assert.ok(!html.includes('window.XSS=1</script>'));}
  assert.equal((await anon.request(src)).status,200);assert.equal((await anon.request(src)).headers.get('cache-control'),'no-store');
  assert.equal((await(await anon.request('/api/news/search?q=Первая')).json()).items.length,1);
 });
 await t.test('Правки отдельно: опубликованный снимок и поиск сохраняются; старые версии получают 409',async()=>{
  const stale=n.version;let r=await editor.json('/api/admin/news/'+n.id,'PATCH',{...n,title:'СЕКРЕТНЫЙ ЧЕРНОВИК',text:'СЕКРЕТНЫЙ ТЕКСТ',status:'draft',version:n.version});assert.equal(r.status,200);n=(await r.json()).entity;assert.equal(n.status,'published');assert.equal(n.hasChanges,true);
  assert.equal((await action('publish',owner,stale)).status,409);assert.equal((await action('unpublish',owner,stale)).status,409);
  assert.equal((await editor.json('/api/admin/news/'+n.id,'PATCH',{...draft,version:stale})).status,409);
  const text=await(await anon.request('/news/'+slug)).text();assert.ok(!text.includes('СЕКРЕТНЫЙ'));assert.ok(text.includes('Исходный заголовок'));
  for(const route of ['/api/news','/api/news/search?q=СЕКРЕТНЫЙ','/','/news'])assert.ok(!(await(await anon.request(route)).text()).includes('СЕКРЕТНЫЙ'));
  assert.equal((await editor.json('/api/admin/news/'+n.id,'PATCH',{...n,status:'archived',version:n.version})).status,403);
  assert.equal((await action('publish')).status,200);assert.equal(n.slug,slug);assert.equal(n.hasChanges,false);assert.ok((await(await anon.request('/news/'+slug)).text()).includes('СЕКРЕТНЫЙ ЧЕРНОВИК'));
 });
 await t.test('Одновременные сохранения: одно успешно, другое 409; нет потерянных правок',async()=>{
  const version=n.version;const responses=await Promise.all(['A','B'].map(title=>editor.json('/api/admin/news/'+n.id,'PATCH',{...n,title,status:'draft',version})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);n=await row();
 });
 await t.test('Снятие, архив, восстановление не публикуют автоматически; slug остаётся постоянным',async()=>{
  assert.equal((await action('unpublish')).status,200);assert.equal((await anon.request('/news/'+slug)).status,404);assert.equal((await anon.request(src)).status,404);assert.equal((await(await anon.request('/api/news/search?q=СЕКРЕТНЫЙ')).json()).items.length,0);
  assert.equal((await action('publish')).status,200);assert.equal((await action('archive')).status,200);assert.equal((await anon.request('/news/'+slug)).status,404);assert.equal((await action('publish')).status,422);
  assert.equal((await action('restore')).status,200);assert.equal(n.status,'draft');assert.equal((await anon.request('/news/'+slug)).status,404);assert.equal(n.slug,slug);
  assert.equal((await action('publish')).status,200);assert.equal(n.slug,slug);
 });
 await t.test('Отсутствующий файл: публикация отклонена, публичный снимок не испорчен',async()=>{
  const before=await db.news.findUnique({where:{id:n.id}});fs.unlinkSync(path.join(config.uploadDir,path.basename(src)));
  assert.equal((await action('publish')).status,422);const after=await db.news.findUnique({where:{id:n.id}});assert.equal(after.version,before.version);assert.equal(after.publishedPayload,before.publishedPayload);
  for(const route of ['/api/admin/news/missing','/admin/news-preview?id=missing','/admin/news-edit?id=missing'])assert.equal((await owner.request(route)).status,404);
  assert.equal((await owner.request('/admin/news-preview')).status,404);
  assert.ok(await db.auditLog.count({where:{scope:'news',action:'publish'}})>0);
 });
});
