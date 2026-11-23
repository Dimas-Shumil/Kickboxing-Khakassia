const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');const {randomBytes}=require('node:crypto');const {PrismaClient}=require('@prisma/client');
test('Удаление контента и медиа: роли, версии, CSRF, публичные выборки и используемые файлы',async t=>{
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

 const {scopedDatabase,gymContext}=await import('../lib/gym-scope.js');const scoped=scopedDatabase(db);
 for(const [route,model] of [['people','person'],['news','news'],['competitions','competition'],['history','historyMaterial'],['site/documents','federationDocument']]){
  const item=await db[model].create({data:{...(model==='person'?{name:'Удаляемый человек'}:{title:'Удаляемый материал'}),status:'published',payload:'{}',publishedPayload:'{}',...(model!=='federationDocument'?{slug:'deleted-'+model}:{})}});
  const endpoint='/api/admin/'+route+'/'+item.id;
  assert.equal((await a.request(endpoint,'DELETE',{version:1},{'x-csrf-token':'invalid'})).status,403);
  assert.equal((await editor.request(endpoint,'DELETE',{version:1})).status,403);
  assert.equal((await a.request(endpoint,'DELETE',{version:99})).status,409);
  await a.json(endpoint,'DELETE',{version:1});
  assert.equal(await scoped[model].findUnique({where:{id:item.id}}),null);
  assert.equal((await a.request(endpoint)).status,404);
  assert.equal((await db[model].findUnique({where:{id:item.id}})).status,'deleted');
  assert.equal((await db[model].findUnique({where:{id:item.id}})).publishedPayload,null);
  assert.equal((await a.request(endpoint,'DELETE',{version:2})).status,404);
  assert.ok(await db.auditLog.findFirst({where:{entityId:item.id,action:'delete'}}));
 }
 const filename='a'.repeat(48)+'.webp';
 const news=await db.news.create({data:{title:'Фото',payload:JSON.stringify({cover:'/media/news/'+filename})}});
 await db.newsAsset.create({data:{id:filename,newsId:news.id,size:100}});
 let files=(await a.json('/api/admin/content-media')).files;assert.equal(files.find(x=>x.id===filename).canDelete,false);
 assert.equal((await a.request('/api/admin/content-media/news/'+filename,'DELETE',{version:1})).status,409);
 assert.equal((await editor.request('/api/admin/content-media/news/'+filename,'DELETE',{version:1})).status,403);
 await a.json('/api/admin/news/'+news.id,'DELETE',{version:1});
 files=(await a.json('/api/admin/content-media')).files;assert.equal(files.find(x=>x.id===filename).canDelete,true);
 await a.json('/api/admin/content-media/news/'+filename,'DELETE',{version:0});assert.equal(await db.newsAsset.count(),0);
});
