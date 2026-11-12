const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');const {PrismaClient}=require('@prisma/client');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');

test('SEO/AEO/GEO: публичные снимки, SSR, Schema.org, canonical, sitemap и запрет приватной индексации',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-seo-')),url='file:'+path.join(dir,'test.db');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}}),{createApp}=await import('../lib/app.js');const when=new Date('2026-11-10T10:00:00Z');
 const news={title:'Публичная новость <script>alert(7)</script>',category:'Федерация',publishedAt:'2026-11-09',author:'Федерация',lead:'Публичный анонс',text:'Текст опубликованной новости',cover:'',alt:'',source:null,gallery:[]};
 const n=await db.news.create({data:{title:'DRAFT-NEWS-SECRET',payload:JSON.stringify({...news,title:'DRAFT-NEWS-SECRET'}),publishedPayload:JSON.stringify(news),status:'published',slug:'public-news',publishedOn:when}});
 await db.news.create({data:{title:'PRIVATE-DRAFT-NEWS',payload:JSON.stringify({...news,title:'PRIVATE-DRAFT-NEWS'}),status:'draft'}});
 const {validatePerson}=await import('../services/people.service.js');const person=validatePerson({name:'Публичный спортсмен',isAthlete:true,isCoach:true,athleteLegend:false,coachLegend:false,primaryRole:'athlete',coachTitle:'Тренер по кикбоксингу',bio:'Биография',summary:'Подтверждённая биография',portrait:'/site/img/athlete-profile-hero.webp',athleteAwards:[],coachAwards:[],timeline:[],methods:[],publicPupils:[],gallery:[]});
 await db.person.create({data:{name:'DRAFT-PERSON-SECRET',payload:JSON.stringify({...person,name:'DRAFT-PERSON-SECRET'}),publishedPayload:JSON.stringify(person),status:'published',slug:'public-person',publishedOn:when}});
 const {validateCompetition}=await import('../services/competitions.service.js');const competition=validateCompetition({title:'Публичный турнир',startDate:'2026-11-20',endDate:'2026-11-21',location:'Абакан',description:'Описание турнира',eventStatus:'upcoming',disciplines:['Лоу-кик'],program:[],documents:[],results:[],photos:[],participants:[]});
 await db.competition.create({data:{title:'DRAFT-COMPETITION-SECRET',payload:JSON.stringify({...competition,title:'DRAFT-COMPETITION-SECRET'}),publishedPayload:JSON.stringify(competition),status:'published',slug:'public-event',publishedOn:when}});
 const {validateHistory}=await import('../services/history.service.js');const history=validateHistory({title:'Публичная история',section:'story',dateType:'period',period:'1990-е',lead:'Анонс истории',body:'Текст исторического материала',gallery:[],sources:[],people:[],competitions:[],detail:true});
 await db.historyMaterial.create({data:{title:'DRAFT-HISTORY-SECRET',payload:JSON.stringify({...history,title:'DRAFT-HISTORY-SECRET'}),publishedPayload:JSON.stringify(history),status:'published',slug:'public-history',publishedOn:when}});
 await db.sitePage.create({data:{key:'contacts',payload:'{"email":"private@example.org"}',publishedPayload:'{"phone":"+7 923 359-55-55","email":"public@example.org","address":"Опубликованный адрес","socials":[{"name":"Сообщество","url":"https://example.org/federation"}]}',publishedOn:when}});
 await db.sitePage.create({data:{key:'federation',payload:'{"intro":"PRIVATE-ABOUT"}',publishedPayload:'{"intro":"Опубликованные сведения","activities":[],"leaders":[],"clubs":[]}',publishedOn:when}});
 await db.student.create({data:{name:'PRIVATE-STUDENT-SECRET',start:'2026-11-01',price:100000,status:'active'}});
 const config={ROOT:root,production:true,origin:'https://kickboxing19.ru',origins:['https://kickboxing19.ru'],seoIndexable:true,seoVerification:{'google-site-verification':'google-test','yandex-verification':'yandex-test','msvalidate.01':'bing-test'}};
 const server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true});});
 const request=(route,host='kickboxing19.ru')=>new Promise((resolve,reject)=>{const r=require('node:http').get(base+route,{headers:{host}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));});r.on('error',reject);});
 const html=async route=>{const r=await request(route);assert.equal(r.status,200,route);return {response:r,text:await r.text()};};
 const parse=text=>{const d=new JSDOM(text);const doc=d.window.document;const graph=[...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>JSON.parse(s.textContent)['@graph']);return {doc,graph,close:()=>d.window.close()};};
 await t.test('Метаданные в HTML, один canonical, домен без query, OG и существующая обложка',async()=>{
  const {response,text}=await html('/news/public-news?utm_source=test');assert.equal(response.headers.get('x-robots-tag'),'index, follow');const p=parse(text);
  assert.equal(p.doc.querySelectorAll('link[rel=canonical]').length,1);assert.equal(p.doc.querySelector('link[rel=canonical]').href,'https://kickboxing19.ru/news/public-news');
  assert.equal(p.doc.querySelector('meta[property="og:url"]').content,'https://kickboxing19.ru/news/public-news');assert.equal(p.doc.querySelector('meta[name="twitter:card"]').content,'summary_large_image');assert.equal(p.doc.querySelector('meta[name="google-site-verification"]').content,'google-test');
  assert.equal(p.doc.querySelectorAll('meta[name=description]').length,1);assert.ok(!text.includes('DRAFT-NEWS-SECRET'));assert.ok(!text.includes('<script>alert(7)</script>'));assert.equal(p.graph.find(g=>g['@type']==='NewsArticle').headline,news.title);p.close();
  const cover=await request('/site/img/seo-share.png');assert.equal(cover.status,200);assert.match(cover.headers.get('content-type'),/png/);
 });
 await t.test('Корректные типы Person, ProfilePage, SportsEvent, Article и BreadcrumbList',async()=>{
  for(const [route,type]of [['/athlete-profile/public-person','Person'],['/coach-profile/public-person','ProfilePage'],['/competitions/public-event','SportsEvent'],['/history/public-history','Article']]){
   const p=parse((await html(route)).text);assert.ok(p.graph.some(g=>g['@type']===type),route);assert.ok(p.graph.some(g=>g['@type']==='BreadcrumbList'));assert.ok(!JSON.stringify(p.graph).includes('DRAFT-'));assert.ok(!JSON.stringify(p.graph).includes('aggregateRating'));p.close();
  }
 });
 await t.test('Главная содержит видимые ответы, совпадающие с разметкой; контакты только опубликованные',async()=>{
  const p=parse((await html('/')).text),faq=p.graph.find(g=>g['@type']==='FAQPage');assert.equal(faq.mainEntity.length,5);for(const q of faq.mainEntity){assert.ok(p.doc.querySelector('main').textContent.includes(q.name));assert.ok(p.doc.querySelector('main').textContent.includes(q.acceptedAnswer.text));}
  const org=p.graph.find(g=>g['@type']==='SportsOrganization');assert.equal(org.telephone,'+79233595555');assert.equal(org.email,'public@example.org');assert.ok(!JSON.stringify(p.graph).includes('private@example.org'));assert.equal(org.areaServed.name,'Республика Хакасия');p.close();
 });
 await t.test('Каталоги и главная содержат ссылки и названия публикаций без выполнения JS',async()=>{
  for(const [route,selector,href]of [['/news','#news-featured','/news/public-news'],['/competitions','#event-groups','/competitions/public-event'],['/','.home-feed__news-list','/news/public-news']]){const p=parse((await html(route)).text);assert.ok(p.doc.querySelector(selector+' a[href="'+href+'"]'),route);p.close();}
 });
 await t.test('Sitemap только с опубликованными каноническими URL, обе роли профиля, lastmod публикации',async()=>{
  const r=await request('/sitemap.xml');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/xml/);const text=await r.text();const doc=new JSDOM(text,{contentType:'application/xml'});const urls=[...doc.window.document.querySelectorAll('loc')].map(n=>n.textContent);
  for(const route of ['/news/public-news','/athlete-profile/public-person','/coach-profile/public-person','/competitions/public-event','/history/public-history'])assert.ok(urls.includes('https://kickboxing19.ru'+route),route);
  assert.ok(!urls.some(u=>/admin|api|student|\.html|\?/.test(u)));assert.ok(!text.includes('PRIVATE-'));assert.ok(text.includes(when.toISOString()));assert.equal(new Set(urls).size,urls.length);doc.window.close();
  await db.news.update({where:{id:n.id},data:{payload:JSON.stringify({...news,title:'LATER-DRAFT-SECRET'})}});assert.equal(await(await request('/sitemap.xml')).text(),text);
 });
 await t.test('Robots разрешает публичный сайт; приватные страницы, 404 и пустые разделы noindex',async()=>{
  const robots=await(await request('/robots.txt')).text();assert.ok(robots.includes('Sitemap: https://kickboxing19.ru/sitemap.xml'));assert.ok(robots.includes('Disallow: /admin'));assert.ok(!robots.includes('Disallow: /site'));
  const empty=await html('/documents');assert.ok(empty.response.headers.get('x-robots-tag').startsWith('noindex'));
  const missing=await request('/missing');assert.equal(missing.status,404);const doc=new JSDOM(await missing.text());assert.equal(doc.window.document.querySelector('meta[name=robots]').content,'noindex,follow');assert.equal(doc.window.document.querySelectorAll('link[rel=canonical]').length,0);doc.window.close();
  const login=await request('/admin/login');assert.match(login.headers.get('x-robots-tag'),/noindex/);assert.ok(!(await login.text()).includes('application/ld+json'));assert.equal((await request('/api/admin/students')).status,401);
 });
 await t.test('Демо, localhost и выключенный SEO не открывают индексацию',async()=>{
  assert.equal(await(await request('/robots.txt','kickboxing-federation.shumdev.ru')).text(),'User-agent: *\nDisallow: /\n');
  config.seoIndexable=false;assert.equal(await(await request('/robots.txt')).text(),'User-agent: *\nDisallow: /\n');assert.ok(!(await(await request('/sitemap.xml')).text()).includes('<loc>'));config.seoIndexable=true;
  config.production=false;assert.equal(await(await request('/robots.txt')).text(),'User-agent: *\nDisallow: /\n');config.production=true;
 });
 await t.test('RSS и llms.txt не раскрывают черновики и учеников; снятие публикации обновляет sitemap',async()=>{
  for(const route of ['/feed.xml','/llms.txt']){const r=await request(route);assert.equal(r.status,200);const text=await r.text();assert.ok(text.includes('public-news'));assert.ok(!text.includes('DRAFT-'));assert.ok(!text.includes('PRIVATE-'));}
  await db.news.update({where:{id:n.id},data:{status:'draft',publishedPayload:null}});assert.ok(!(await(await request('/sitemap.xml')).text()).includes('/news/public-news'));assert.equal((await request('/news/public-news')).status,404);
 });
});

test('Включение SEO: безопасная проверка, резервная копия, отключение, запрет преждевременной индексации',t=>{
 const temp=fs.mkdtempSync(path.join(root,'.seo-test-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));fs.mkdirSync(path.join(temp,'scripts'));fs.copyFileSync(path.join(root,'scripts/set-seo-indexing.js'),path.join(temp,'scripts/set-seo-indexing.js'));const file=path.join(temp,'.env'),script=path.join(temp,'scripts/set-seo-indexing.js');
 const source='NODE_ENV=production\nAPP_ORIGIN=https://kickboxing19.ru\nDATABASE_URL=file:./KEEP.db\nSECRET=KEEP-SECRET\nSEO_INDEXABLE=false\n';fs.writeFileSync(file,source);const run=(...args)=>execFileSync(process.execPath,[script,...args],{cwd:temp,encoding:'utf8',stdio:'pipe'});
 run('--check');assert.equal(fs.readFileSync(file,'utf8'),source);const output=run();assert.ok(!output.includes('KEEP-SECRET'));assert.ok(fs.readFileSync(file,'utf8').includes('SEO_INDEXABLE=true'));assert.ok(fs.readFileSync(file,'utf8').includes('DATABASE_URL=file:./KEEP.db'));assert.equal(fs.readdirSync(temp).filter(n=>n.startsWith('.env.before-seo')).length,1);run('--disable');assert.ok(fs.readFileSync(file,'utf8').includes('SEO_INDEXABLE=false'));
 fs.writeFileSync(file,source.replace('https://kickboxing19.ru','https://kickboxing-federation.shumdev.ru'));assert.throws(()=>run());assert.ok(fs.readFileSync(file,'utf8').includes('SEO_INDEXABLE=false'));
});
