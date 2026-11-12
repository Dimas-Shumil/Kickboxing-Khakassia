const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');const {randomBytes}=require('node:crypto');const {JSDOM}=require('jsdom');const {PrismaClient}=require('@prisma/client');
const root=path.resolve(__dirname,'..');

test('Кнопка звонка доступна без JS на всех непустых публичных шаблонах, без изменений админки',()=>{
 let count=0;
 for(const file of fs.readdirSync(path.join(root,'public')).filter(f=>f.endsWith('.html'))){
  const html=fs.readFileSync(path.join(root,'public',file),'utf8');if(!html.trim())continue;
  const dom=new JSDOM(html),d=dom.window.document;const links=d.querySelectorAll('a.site-call');assert.equal(links.length,1,file);
  assert.equal(links[0].getAttribute('href'),'tel:+79233595555',file);assert.match(links[0].getAttribute('aria-label'),/923 359-55-55/);
  assert.ok(links[0].textContent.includes('Позвонить'));assert.equal(links[0].parentElement,d.body);assert.equal(d.querySelectorAll('link[href^="/site/css/contact-button.min.css"]').length,1,file);dom.window.close();count++;
 }
 assert.equal(count,18);
 for(const folder of ['people','history'])for(const file of fs.readdirSync(path.join(root,'views',folder)).filter(f=>f.endsWith('.html'))){const dom=new JSDOM(fs.readFileSync(path.join(root,'views',folder,file),'utf8'));assert.equal(dom.window.document.querySelectorAll('a.site-call[href="tel:+79233595555"]').length,1,'views/'+folder+'/'+file);dom.window.close();}
 for(const file of fs.readdirSync(path.join(root,'admin-pages')).filter(f=>f.endsWith('.html')))assert.ok(!fs.readFileSync(path.join(root,'admin-pages',file),'utf8').includes('site-call'),file);
});

test('Смена домена: проверка и атомарная запись сохраняют DB, настройки и резервную копию, без вывода секретов',t=>{
 const temp=fs.mkdtempSync(path.join(root,'.domain-test-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));fs.mkdirSync(path.join(temp,'scripts'));fs.copyFileSync(path.join(root,'scripts/set-production-origin.js'),path.join(temp,'scripts/set-production-origin.js'));
 const script=path.join(temp,'scripts/set-production-origin.js'),file=path.join(temp,'.env');const original='NODE_ENV=production\r\nDATABASE_URL="file:./federation-demo.db"\r\n# keep comment\r\nAPP_ORIGIN=https://kickboxing-federation.shumdev.ru\r\nSESSION_SECRET=KEEP-THIS-SECRET\r\nSESSION_HOURS=4\r\n';fs.writeFileSync(file,original);
 const run=(...args)=>execFileSync(process.execPath,[script,...args],{cwd:temp,encoding:'utf8',stdio:'pipe'});
 const check=run('--check','--transition');assert.ok(!check.includes('KEEP-THIS-SECRET'));assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(fs.readdirSync(temp).filter(n=>n.startsWith('.env.before-')).length,0);
 let out=run('--transition');assert.ok(!out.includes('KEEP-THIS-SECRET'));let text=fs.readFileSync(file,'utf8');assert.ok(text.includes('APP_ORIGIN=https://kickboxing19.ru,https://kickboxing-federation.shumdev.ru'));assert.ok(text.includes('DATABASE_URL="file:./federation-demo.db"\r\n'));assert.ok(text.includes('SESSION_SECRET=KEEP-THIS-SECRET\r\n'));assert.ok(text.includes('# keep comment\r\n'));
 const backups=fs.readdirSync(temp).filter(n=>n.startsWith('.env.before-'));assert.equal(backups.length,1);assert.equal(fs.readFileSync(path.join(temp,backups[0]),'utf8'),original);
 out=run();text=fs.readFileSync(file,'utf8');assert.match(text,/APP_ORIGIN=https:\/\/kickboxing19.ru\r\n/);assert.ok(!text.includes('shumdev.ru'));const final=text;run();assert.equal(fs.readFileSync(file,'utf8'),final);
 fs.writeFileSync(file,original.replace('production','development'));assert.throws(()=>run());assert.ok(fs.readFileSync(file,'utf8').includes('NODE_ENV=development'));
});

test('Новый origin: вход, CSRF, secure cookie, публичная кнопка, отсутствие кнопки в админке',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fed-domain-')),url='file:'+path.join(dir,'test.db');execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'});
 const db=new PrismaClient({datasources:{db:{url}}});const {hashPassword}=await import('../services/password.service.js'),{createApp}=await import('../lib/app.js');const password=randomBytes(24).toString('base64url');await db.admin.create({data:{login:'domain-owner',name:'Owner',role:'OWNER',passwordHash:await hashPassword(password)}});
 const config={ROOT:root,production:true,origin:'https://kickboxing19.ru',origins:['https://kickboxing19.ru']};const server=await new Promise(r=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true});});
 let r=await fetch(base+'/api/admin/auth/login',{method:'POST',headers:{origin:config.origin,'content-type':'application/json'},body:JSON.stringify({login:'domain-owner',password})});assert.equal(r.status,200);const cookie=r.headers.getSetCookie().find(c=>c.startsWith('__Host-fed_admin_session='));assert.ok(cookie.includes('Secure'));assert.ok(cookie.includes('HttpOnly'));assert.ok(!cookie.includes('Domain='));const auth=cookie.split(';')[0],data=await r.json();assert.ok(data.csrfToken);
 r=await fetch(base+'/api/admin/auth/csrf',{method:'POST',headers:{origin:config.origin,cookie:auth}});assert.equal(r.status,200);
 r=await fetch(base+'/api/admin/auth/csrf',{method:'POST',headers:{origin:'https://kickboxing-federation.shumdev.ru',cookie:auth}});assert.equal(r.status,403);
 for(const route of ['/','/news','/coaches','/hall-of-fame','/competitions','/history','/documents','/contacts','/missing']){r=await fetch(base+route);assert.equal(r.status,route==='/missing'?404:200,route);const html=await r.text();assert.equal((html.match(/class="site-call"/g)||[]).length,1,route);}
 r=await fetch(base+'/admin/dashboard',{headers:{cookie:auth}});assert.equal(r.status,200);assert.ok(!(await r.text()).includes('site-call'));
 r=await fetch(base+'/site/css/contact-button.min.css');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/css/);
});
