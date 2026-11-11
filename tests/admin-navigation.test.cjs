const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');const {randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');const {JSDOM,VirtualConsole}=require('jsdom');

test('Постоянная админка: реальный API + DOM, переходы, формы, история, гонки, изоляция',async t=>{
 let dom;
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-navigation-')),url='file:'+path.join(dir,'test.db');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}});const {hashPassword}=await import('../services/password.service.js');const {createApp}=await import('../lib/app.js');
 const password=randomBytes(24).toString('base64url');await db.admin.create({data:{login:'nav-owner',name:'Владелец',role:'OWNER',passwordHash:await hashPassword(password)}});
 await db.student.createMany({data:[{name:'Ученик 12',gymId:'school-12',start:'2026-11-01',price:100000,status:'active'},{name:'Ученик 25',gymId:'school-25',start:'2026-11-01',price:100000,status:'active'}]});
 const config={ROOT:root,production:false,origin:'http://127.0.0.1'};
 const server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;config.origin=base;
 const nativeFetch=global.fetch;
 t.after(async()=>{dom?.window.close();global.fetch=nativeFetch;await new Promise(r=>server.close(r));await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true});});
const login=await nativeFetch(base+'/api/admin/auth/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({login:'nav-owner',password})});
 const authCookie=login.headers.getSetCookie().find(x=>x.startsWith('fed_admin_session=')).split(';')[0];
 const virtualConsole=new VirtualConsole(),errors=[];virtualConsole.on('jsdomError',error=>errors.push(error.message));
 dom=new JSDOM('<!doctype html><html><body class="admin"><div id="admin-root">Загрузка…</div></body></html>',{url:base+'/admin/dashboard',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const win=dom.window;win.document.cookie='fed_gym=school-12; Path=/';win.scrollTo=()=>{};win.HTMLElement.prototype.scrollIntoView=function(){};
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let reduce=false;win.matchMedia=()=>({matches:reduce,addEventListener(){},removeEventListener(){}});win.confirm=()=>true;win.setInterval=()=>1;win.clearInterval=()=>{};
 const requests=[];let delayPath=null,failPath=null,blockWrite=null;
 const bridge=async(href,options={})=>{
  const endpoint=new URL(href,base);requests.push(endpoint.pathname+endpoint.search);
  if(failPath&&endpoint.pathname===failPath)throw new TypeError('test network failure');
  if(delayPath&&endpoint.pathname===delayPath)await new Promise(r=>setTimeout(r,90));
  if(blockWrite&&options.method==='POST'&&endpoint.pathname==='/api/admin/finances')await blockWrite;
  return nativeFetch(endpoint,{...options,headers:{...options.headers,cookie:authCookie+'; '+win.document.cookie,origin:base}});
 };
 win.fetch=bridge;
 for(const [key,value] of Object.entries({window:win,document:win.document,history:win.history,location:win.location,matchMedia:win.matchMedia,requestAnimationFrame:win.requestAnimationFrame.bind(win),FormData:win.FormData,sessionStorage:win.sessionStorage,confirm:win.confirm,fetch:bridge}))global[key]=value;
 win.eval(fs.readFileSync(path.join(root,'site/scripts/admin/session-guard.js'),'utf8'));
 const waitFor=async(predicate,label='condition')=>{const until=Date.now()+6000;while(Date.now()<until){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out: '+label+' '+win.document.body.textContent.slice(-500));};
 const select=s=>win.document.querySelector(s);const click=s=>select(s).dispatchEvent(new win.MouseEvent('click',{bubbles:true,button:0,cancelable:true}));
 await import('../site/scripts/admin/dashboard.js');const {navigation}=await import('../site/scripts/admin/navigation.js');

 await waitFor(()=>select('#analytics-root')&&select('#sidebar'),'initial screen');
 const sidebar=select('#sidebar'),topbar=select('.topbar');
 await t.test('Переходы по ссылкам сохраняют меню, шапку и единственную сессию',async()=>{
  click('.navigation a[href="/admin/news"]');await waitFor(()=>select('h1')?.textContent==='Новости'&&!win.document.body.classList.contains('admin--navigating'));
  assert.equal(select('#sidebar'),sidebar);assert.equal(select('.topbar'),topbar);assert.equal(win.location.pathname,'/admin/news');assert.equal(select('.navigation [aria-current]').pathname,'/admin/news');assert.ok(select('.navigation__indicator'));
  await navigation.go('/admin/competitions');await navigation.go('/admin/site-documents');await navigation.go('/admin/site-media');await navigation.go('/admin/news');
  assert.equal(select('#sidebar'),sidebar);assert.equal(requests.filter(x=>x==='/api/admin/auth/session').length,1);assert.equal(requests.filter(x=>x==='/api/admin/auth/csrf').length,1);
 });
 await t.test('Все разделы монтируются повторно без перезагрузки и без чужих данных',async()=>{
  for(const page of ['students','student','payments','payment','gym','groups','group','trainings','training','finances','access','people','person-edit','history','history-edit','competition-edit','news-edit','site-pages','site-page-edit?key=home','site-documents','site-document-edit','site-media','activity','dashboard']){
   assert.equal(await navigation.go('/admin/'+page),true,page);assert.equal(select('#sidebar'),sidebar,page);assert.equal(select('.topbar'),topbar,page);assert.ok(select('#admin-view-slot h1'),page);
   assert.ok(!select('#admin-view-slot').textContent.includes('Ученик 25'),page);
  }
 });
 await t.test('Несохранённая форма: Отмена сохраняет URL и ввод, подтверждение открывает раздел',async()=>{
  await navigation.go('/admin/student');const name=select('[name=name]');name.value='Не потерять';name.dispatchEvent(new win.Event('input',{bubbles:true}));
  const leaving=navigation.go('/admin/news');await waitFor(()=>select('#leave-dialog').open);click('#stay');assert.equal(await leaving,false);assert.equal(win.location.pathname,'/admin/student');assert.equal(select('[name=name]').value,'Не потерять');
  const confirmed=navigation.go('/admin/news');await waitFor(()=>select('#leave-dialog').open);click('#leave');assert.equal(await confirmed,true);assert.equal(win.location.pathname,'/admin/news');
 });
 await t.test('Сохранение ученика возвращает карточку без перезагрузки; повторные входы не дублируют submit',async()=>{
  await navigation.go('/admin/student');const form=select('#student-form');form.elements.name.value='Создан из плавной админки';form.elements.name.dispatchEvent(new win.Event('input',{bubbles:true}));form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>win.location.search.includes('saved=1')&&!win.document.body.classList.contains('admin--navigating'),'student saved');
  assert.equal(await db.student.count({where:{name:'Создан из плавной админки'}}),1);assert.equal(select('#sidebar'),sidebar);assert.equal(select('[name=name]').value,'Создан из плавной админки');
  await navigation.go('/admin/students');await navigation.go('/admin/student');await navigation.go('/admin/students');assert.equal(await db.student.count({where:{name:'Создан из плавной админки'}}),1);
 });
 await t.test('Создание и публикация новости через форму сохраняют постоянную оболочку',async()=>{
  await navigation.go('/admin/news-edit');const form=select('#news-form');form.elements.title.value='Публикация из плавной панели';form.elements.lead.value='Анонс';form.elements.text.value='Текст новости';form.elements.title.dispatchEvent(new win.Event('input',{bubbles:true}));form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>win.location.pathname==='/admin/news-edit'&&win.location.search.includes('id=')&&!win.document.body.classList.contains('admin--navigating'),'news saved');
  click('[data-action=publish]');await waitFor(()=>select('#news-status')?.textContent.includes('Опубликовано')||select('#admin-view-slot')?.textContent.includes('Опубликовано'),'news published');
  await waitFor(()=>!win.document.body.classList.contains('admin--navigating'));assert.equal((await db.news.findFirst({where:{title:'Публикация из плавной панели'}})).status,'published');assert.equal(select('#sidebar'),sidebar);
 });
 await t.test('Быстрые переходы: запоздавший запрос не заменяет новый экран',async()=>{
  delayPath='/api/admin/site/documents';const slow=navigation.go('/admin/site-documents');await new Promise(r=>setTimeout(r,15));const fast=navigation.go('/admin/news');await Promise.all([slow,fast]);await new Promise(r=>setTimeout(r,120));delayPath=null;
  assert.equal(win.location.pathname,'/admin/news');assert.equal(select('h1').textContent,'Новости');assert.equal(select('#sidebar'),sidebar);
 });
 await t.test('Ошибка соединения сохраняет прежний экран и возможность работать',async()=>{
  failPath='/admin/people';assert.equal(await navigation.go('/admin/people'),false);failPath=null;assert.equal(win.location.pathname,'/admin/news');assert.equal(select('h1').textContent,'Новости');assert.ok(select('#feedback').textContent);assert.equal(await navigation.go('/admin/people'),true);
 });
 await t.test('Назад/Вперёд восстанавливают разделы, отмена Назад сохраняет форму и адрес',async()=>{
  await navigation.go('/admin/news');await navigation.go('/admin/people');win.history.back();await waitFor(()=>win.location.pathname==='/admin/news'&&select('h1')?.textContent==='Новости'&&!win.document.body.classList.contains('admin--navigating'),'Back');
  win.history.forward();await waitFor(()=>win.location.pathname==='/admin/people'&&select('h1')?.textContent==='Люди'&&!win.document.body.classList.contains('admin--navigating'),'Forward');
  await navigation.go('/admin/student');select('[name=name]').value='Вернуться без потерь';select('[name=name]').dispatchEvent(new win.Event('input',{bubbles:true}));win.history.back();await waitFor(()=>select('#leave-dialog').open,'Back confirmation');click('#stay');await new Promise(r=>setTimeout(r,30));assert.equal(win.location.pathname,'/admin/student');assert.equal(select('[name=name]').value,'Вернуться без потерь');
  const leave=navigation.go('/admin/finances');await waitFor(()=>select('#leave-dialog').open);click('#leave');await leave;
 });
 await t.test('Сохранение финансов блокирует уход до ответа; итог и одна запись сохраняются',async()=>{
  const form=select('#finance-form');form.elements.amount.value='1200';form.elements.category.value='Инвентарь';
  let release;blockWrite=new Promise(r=>{release=r;});form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,10));assert.equal(await navigation.go('/admin/news'),false);assert.equal(win.location.pathname,'/admin/finances');release();blockWrite=null;await waitFor(()=>select('#finance-list').textContent.includes('Инвентарь'),'finance saved');assert.equal(await db.financeEntry.count(),1);
 });
 await t.test('Снижение анимации, GET-фильтр журнала и смена месяца работают без перезагрузки',async()=>{
  reduce=true;await navigation.go('/admin/activity');const f=select('#activity-filters');f.elements.month.value='2026-11';f.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>win.location.search.includes('month=2026-11')&&!win.document.body.classList.contains('admin--navigating'));
  await navigation.go('/admin/gym');select('#month').value='2026-10';select('#month').dispatchEvent(new win.Event('change',{bubbles:true}));await waitFor(()=>win.location.search.includes('month=2026-10')&&!win.document.body.classList.contains('admin--navigating'));assert.equal(select('#sidebar'),sidebar);
 });
 await t.test('Смена зала требует отдельной загрузки и не переиспользует старую область',async()=>{
  let destination=null;navigation.hard=href=>{destination=href;};select('#gym-switch').value='school-25';select('#gym-switch').dispatchEvent(new win.Event('change',{bubbles:true}));await waitFor(()=>destination!==null);assert.equal(destination,'/admin/gym');assert.ok(win.document.cookie.includes('fed_gym=school-25'));
 });
 assert.deepEqual(errors,[]);
});
