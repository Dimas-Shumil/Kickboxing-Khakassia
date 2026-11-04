const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const service=import('../services/site-content.service.js');
const renderer=import('../services/site-content-render.service.js');
function mockDB(){
 const tables={sitePage:new Map(),federationDocument:new Map(),siteAsset:new Map(),auditLog:new Map()};let seq=0;
 const make=table=>({
  async findUnique({where}){return tables[table].get(where.id??where.key)||null;},
  async findFirst({where}){return [...tables[table].values()].find(r=>Object.entries(where).every(([k,v])=>r[k]===v))||null;},
  async findMany({where={},orderBy}={}){return [...tables[table].values()].filter(r=>Object.entries(where).every(([k,v])=>v&&typeof v==='object'&&'not'in v?r[k]!==v.not:r[k]===v));},
  async count({where={}}={}){return (await this.findMany({where})).length;},
  async create({data}){const id=data.id||data.key||'doc-'+(++seq);if(tables[table].has(id))throw Object.assign(new Error('unique'),{code:'P2002'});const row={id,version:1,createdAt:new Date(),updatedAt:new Date(),...(table==='federationDocument'?{status:'draft'}:{}),...data};tables[table].set(id,row);return row;},
  async updateMany({where,data}){const id=where.id??where.key,row=tables[table].get(id);if(!row||where.version!==row.version)return {count:0};const newRow={...row,...data,version:data.version?.increment?row.version+data.version.increment:row.version,updatedAt:new Date()};tables[table].set(id,newRow);return {count:1};}
 });
 const db={...Object.fromEntries(Object.keys(tables).map(k=>[k,make(k)])),tables};db.$transaction=async fn=>fn(db);return db;
}
const actor=role=>({user:{id:role+'-id',role},params:{},body:{}});
const fresh={subtitle:'First published caption',ctaTitle:'Kickboxing',ctaText:'Join',heroImage:'',ctaImage:'',version:0};
const doc={title:'Устав Федерации',category:'Регистрация',date:'2026-10-20',description:'Проверенный документ',author:'Федерация',source:'',file:''};
test('Структура главной и HTML-экранирование предотвращают инъекцию',async()=>{
 const m=await service,r=await renderer;
 const p=m.validatePage('home',{...fresh,subtitle:'<img src=x onerror=alert(1)>'});
 assert.equal(p.subtitle,'<img src=x onerror=alert(1)>');
 const html=r.renderHomeSite('<p class="hero__description">default</p>',p);
 assert.ok(html.includes('&lt;img'));
 assert.ok(!html.includes('<img src=x'));
});
test('Владелец публикует; редактор сохраняет рабочие правки без изменения публичной версии',async()=>{
 const s=await service,db=mockDB(),cfg={ROOT:'/tmp'};
 const write=s.siteWriter(db,cfg);
 const created=await write({...actor('EDITOR'),body:fresh},'home','save');
 assert.equal(created.version,1);
 assert.equal(await s.publishedPage(db,'home'),null);
 await assert.rejects(()=>write({...actor('EDITOR'),body:{version:1}},'home','publish'),e=>e.status===403);
 const public1=await write({...actor('OWNER'),body:{version:1}},'home','publish');
 assert.equal(public1.version,2);assert.equal(public1.hasPublished,true);
 assert.equal((await s.publishedPage(db,'home')).subtitle,fresh.subtitle);
 const edited=await write({...actor('EDITOR'),body:{...fresh,version:2,subtitle:'Новый черновик'}},'home','save');
 assert.equal(edited.hasChanges,true);
 assert.equal((await s.publishedPage(db,'home')).subtitle,fresh.subtitle);
 const public2=await write({...actor('OWNER'),body:{version:3}},'home','publish');
 assert.equal(public2.hasChanges,false);
 assert.equal((await s.publishedPage(db,'home')).subtitle,'Новый черновик');
});
test('Конфликт версии при повторном сохранении: HTTP 409',async()=>{
 const s=await service,db=mockDB(),write=s.siteWriter(db,{ROOT:'/tmp'});
 await write({...actor('EDITOR'),body:fresh},'home','save');
 await write({...actor('EDITOR'),body:{...fresh,version:1}},'home','save');
 await assert.rejects(()=>write({...actor('EDITOR'),body:{...fresh,version:1}},'home','save'),e=>e.status===409);
});
test('Неизвестная страница: HTTP 404',async()=>{
 const s=await service,db=mockDB();await assert.rejects(()=>s.siteWriter(db,{ROOT:'/tmp'})({...actor('OWNER'),body:fresh},'invalid','save'),e=>e.status===404);
});
test('Сервер запрещает файловый URL не из каталога /media/site/',async()=>{
 const s=await service;assert.throws(()=>s.validatePage('federation',{heroImage:'/admin/../secret.webp',activities:[],leaders:[],clubs:[]}),e=>e.status===422);
});
test('Проверка принадлежности фото к странице и наличия файла',async()=>{
 const s=await service,db=mockDB();const temp=await fs.mkdtemp(path.join(os.tmpdir(),'fed-site-088-'));
 try{const id='a'.repeat(48)+'.webp',f='/media/site/'+id;await fs.writeFile(path.join(temp,id),'sample');await db.siteAsset.create({data:{id,ownerKey:'page:home',kind:'image',size:6}});
  await s.checkFiles(db,{siteUploadDir:temp},'page:home',[f]);
  await assert.rejects(()=>s.checkFiles(db,{siteUploadDir:temp},'page:federation',[f]),e=>e.status===422);
  await fs.unlink(path.join(temp,id));await assert.rejects(()=>s.checkFiles(db,{siteUploadDir:temp},'page:home',[f]),e=>e.status===422);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('Рабочий и публичный файл отмечены используемыми независимо',async()=>{
 const s=await service,src='/media/site/'+'c'.repeat(48)+'.pdf';
 assert.deepEqual(s.usageOf({payload:JSON.stringify({...doc,file:''}),publishedPayload:JSON.stringify({...doc,file:src})},src),{working:false,published:true});
});
test('Публикация PDF требует файл, а не просто название',async()=>{
 const s=await service,db=mockDB(),write=s.documentWriter(db,{ROOT:'/tmp'});
 const p=await write({...actor('EDITOR'),body:doc},null,'save');
 assert.equal(p.status,'draft');
 await assert.rejects(()=>write({...actor('OWNER'),body:{version:p.version}},p.id,'publish'),e=>e.status===422);
});
test('Документ: снятие, архив и восстановление не публикуют запись',async()=>{
 const s=await service,db=mockDB(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'fed-pdf-088-'));
 try{
  const write=s.documentWriter(db,{siteUploadDir:temp}),p=await write({...actor('EDITOR'),body:doc},null,'save');
  const id='b'.repeat(48)+'.pdf',src='/media/site/'+id;await fs.writeFile(path.join(temp,id),'PDF');await db.siteAsset.create({data:{id,ownerKey:'document:'+p.id,kind:'pdf',size:3}});
  const revised=await write({...actor('EDITOR'),body:{...doc,file:src,version:p.version}},p.id,'save');
  await assert.rejects(()=>write({...actor('EDITOR'),body:{version:revised.version}},p.id,'publish'),e=>e.status===403);
  const published=await write({...actor('OWNER'),body:{version:revised.version}},p.id,'publish');
  assert.equal((await s.publishedDocuments(db)).length,1);
  await assert.rejects(()=>write({...actor('EDITOR'),body:{version:published.version}},p.id,'archive'),e=>e.status===403);
  const unpublished=await write({...actor('OWNER'),body:{version:published.version}},p.id,'unpublish');
  assert.equal((await s.publishedDocuments(db)).length,0);
  const archived=await write({...actor('EDITOR'),body:{version:unpublished.version}},p.id,'archive');
  assert.equal(archived.status,'archived');assert.equal(archived.hasPublished,false);
  const restored=await write({...actor('EDITOR'),body:{version:archived.version}},p.id,'restore');
  assert.equal(restored.status,'draft');assert.equal(restored.hasPublished,false);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('Неподходящая ссылка и нелегитимная дата документа запрещены',async()=>{
 const s=await service;assert.throws(()=>s.validateDocument({...doc,source:'javascript:alert(1)'}),e=>e.status===422);
 assert.throws(()=>s.validateDocument({...doc,date:'2026-02-30'}),e=>e.status===422);
});
test('Валидация координат и списка соцсетей',async()=>{
 const s=await service;assert.throws(()=>s.validatePage('contacts',{latitude:'91',socials:[]}),e=>e.status===422);
 assert.throws(()=>s.validatePage('contacts',{socials:[{name:'VK',url:'data:text/html,x'}]}),e=>e.status===422);
 const p=s.validatePage('contacts',{latitude:'53.7168',longitude:'91.4424',socials:[{name:'Группа',url:'https://vk.com/'}]});assert.equal(p.socials.length,1);
});
test('Шаблоны работают с HTML-исходником и не раскрывают статическую заглушку при публикации',async()=>{
 const r=await renderer;const pub=await fs.readFile(path.join(__dirname,'../public/federation.html'),'utf8');
 const html=r.renderFederation(pub,{heroTitle:'Федерация Хакасии',heroLead:'Утверждённая информация',intro:'Сведения опубликованы',activities:[],leaders:[],clubs:[]});
 assert.match(html,/Федерация Хакасии/);assert.ok(!html.includes('Раздел готовится к наполнению'));
 assert.match(html,/Данные пока не опубликованы/);
});
test('Документы на публичной странице содержат только переданные опубликованные файлы',async()=>{
 const r=await renderer,html=await fs.readFile(path.join(__dirname,'../public/documents.html'),'utf8');
 const result=r.renderDocuments(html,[{...doc,file:'/media/site/'+'e'.repeat(48)+'.pdf'}]);
 assert.match(result,/Скачать PDF/);assert.match(result,/Устав Федерации/);
 assert.ok(!result.includes('Файлы не предоставлены</span></article>'));
});
test('Одновременное создание страницы с версией 0 приводит ко второму 409, а не к 500',async()=>{
 const s=await service,db=mockDB(),write=s.siteWriter(db,{ROOT:'/tmp'});
 const outcomes=await Promise.allSettled([write({...actor('EDITOR'),body:fresh},'home','save'),write({...actor('EDITOR'),body:fresh},'home','save')]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.find(x=>x.status==='rejected').reason.status,409);
});
test('Изображения главной и руководства учитываются как используемые',async()=>{
 const s=await service,src='/media/site/'+'f'.repeat(48)+'.webp';
 assert.ok(s.usedPageFiles({heroImage:src,ctaImage:src,leaders:[{image:src}]}).length===3);
});
test('Медиатека показывает конкретное назначение фотографий и PDF',async()=>{
 const s=await service,src='/media/site/'+'f'.repeat(48)+'.webp';
 assert.deepEqual(s.siteAssetLocations({heroImage:src,ctaImage:'',leaders:[{name:'Иван',image:src}]},src),['Фон Hero','Руководство: Иван']);
 assert.deepEqual(s.siteAssetLocations({file:src},src),['PDF документа']);
});
