const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');const source=f=>fs.readFileSync(path.join(root,f),'utf8');
test('PWA manifests, PNG sizes, distinct identity, scope and maskable icons',()=>{
 const manifests=['public','admin'].map(kind=>JSON.parse(source('pwa/'+kind+'.webmanifest')));
 assert.notEqual(manifests[0].id,manifests[1].id);assert.deepEqual(manifests.map(m=>m.start_url),['/','/admin/dashboard']);assert.deepEqual(manifests.map(m=>m.scope),['/','/admin/']);
 for(const m of manifests){assert.equal(m.display,'standalone');assert.ok(m.icons.some(i=>i.purpose==='maskable'));for(const icon of m.icons){const png=fs.readFileSync(path.join(root,'public',icon.src));const [width,height]=icon.sizes.split('x').map(Number);assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);}}
});
test('Service workers: only shell cache; private GET and all POST never cached or replayed',async()=>{
 for(const kind of ['public','admin']){
  const handlers={},stored=new Map(),deleted=[];let down=false;let calls=0;
  const cache={put:async(key,response)=>stored.set(key,response),keys:async()=>[...stored.keys()]};
  const context={self:{location:{origin:'https://kickboxing19.ru'},addEventListener:(name,fn)=>handlers[name]=fn},URL,Headers,Response,AbortController,setTimeout,clearTimeout,caches:{open:async()=>cache,keys:async()=>['unrelated-cache','fkh19-'+kind+'-shell-v0'],delete:async k=>deleted.push(k),match:async key=>stored.get(key)},fetch:async()=>{calls++;if(down)throw Error('offline');return new Response('generic shell',{headers:{'content-type':'text/html'}});}};
  vm.runInNewContext(source('pwa/'+kind+'-sw.js'),context);let job;handlers.install({waitUntil:p=>job=p});await job;assert.equal(stored.size,3);
  handlers.activate({waitUntil:p=>job=p});await job;assert.deepEqual(deleted,['fkh19-'+kind+'-shell-v0']);
  for(const [url,method,mode] of [['/api/admin/students','GET','cors'],['/api/admin/payments','POST','cors'],['/media/news/private.webp','GET','cors'],['/site/img/logo-fed.png','GET','cors']]){
   let intercepted=false;handlers.fetch({request:{url:'https://kickboxing19.ru'+url,method,mode},respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);
  }
  down=true;let response;handlers.fetch({request:{url:'https://kickboxing19.ru'+(kind==='admin'?'/admin/students':'/news'),method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await(await response).text(),'generic shell');assert.equal(stored.size,3);
  if(kind==='public'){let intercepted=false;handlers.fetch({request:{url:'https://kickboxing19.ru/admin/students',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
  assert.ok(!source('pwa/'+kind+'-sw.js').includes('self.skipWaiting('));
 }
});
function installer(mode,{standalone=false,ios=false,ready=true}={}){
 const d=new JSDOM(`<head><script data-fed-pwa="${mode}"></script></head><body></body>`,{url:'https://kickboxing19.ru'+(mode==='public'?'/':'/admin/dashboard'),runScripts:'outside-only',pretendToBeVisual:true});const w=d.window,timers=[];
 Object.defineProperty(w.document,'currentScript',{value:w.document.querySelector('script')});w.matchMedia=()=>({matches:standalone});w.setTimeout=(fn,ms)=>{timers.push({fn,ms});return 1;};if(ios)Object.defineProperty(w.navigator,'userAgent',{value:'Mozilla/5.0 (iPhone) Version/18.0 Mobile/15 Safari/604.1'});
 w.FederationAdminSession={ready:Promise.resolve(ready)};w.eval(source('site/scripts/pwa.js'));
 const prompt=()=>{const e=new w.Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{};e.userChoice=Promise.resolve({outcome:'dismissed'});w.dispatchEvent(e);};
 return {w,d,timers,prompt,run:()=>timers.filter(t=>t.ms===10000).forEach(t=>t.fn())};
}
test('Installer: 10 seconds, real install event, separate seven-day dismissal, standalone and iOS instructions',async()=>{
 const app=installer('public');app.run();assert.equal(app.w.document.querySelector('.pwa-install'),null);app.prompt();assert.ok(app.w.document.querySelector('.pwa-install'));app.w.document.querySelector('[data-later]').click();assert.ok(app.w.localStorage.getItem('fkh19:public:install:later'));assert.equal(app.w.localStorage.getItem('fkh19:admin:install:later'),null);app.prompt();assert.equal(app.w.document.querySelector('.pwa-install'),null);
 app.w.localStorage.setItem('fkh19:public:install:later',Date.now()-8*86400000);app.prompt();assert.ok(app.w.document.querySelector('.pwa-install'));app.d.window.close();
 for(const mode of ['login','private']){const a=installer(mode);await Promise.resolve();a.prompt();a.run();assert.equal(a.w.document.querySelector('.pwa-install'),null);a.d.window.close();}
 for(const ready of [true,false]){const a=installer('admin',{ready});await new Promise(resolve=>setImmediate(resolve));a.prompt();assert.equal(a.w.document.querySelector('.pwa-install'),null);a.run();assert.equal(!!a.w.document.querySelector('.pwa-install'),ready);a.d.window.close();}
 const s=installer('public',{standalone:true});s.prompt();s.run();assert.equal(s.w.document.querySelector('.pwa-install'),null);s.d.window.close();
 const i=installer('public',{ios:true});i.run();i.w.document.querySelector('[data-install]').click();assert.match(i.w.document.querySelector('[data-instructions]').textContent,/Поделиться/);i.d.window.close();
});
test('PWA endpoints, MIME, injection and private no-store without authentication bypass',async t=>{
 const {createApp}=await import('../lib/app.js');const db={};const app=createApp(db,{ROOT:root,production:false,origin:'http://127.0.0.1'});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));const base='http://127.0.0.1:'+server.address().port;
 for(const url of ['/manifest.webmanifest','/admin/manifest.webmanifest']){const response=await fetch(base+url);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/manifest\+json/);}
 for(const url of ['/sw.js','/admin/sw.js']){const response=await fetch(base+url);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);assert.match(response.headers.get('cache-control'),/no-store/);}
 for(const url of ['/pwa/offline','/admin/offline']){const response=await fetch(base+url);assert.equal(response.status,200);assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.ok(!(await response.text()).includes('data-fed-pwa'));}
 const response=await fetch(base+'/admin/login');assert.match(response.headers.get('cache-control'),/no-store/);const html=await response.text();assert.match(html,/data-fed-pwa="login"/);assert.match(html,/href="\/admin\/manifest.webmanifest"/);assert.equal((await fetch(base+'/pwa/assets/admin-maskable-512.png')).status,200);
});
test('Session guard: offline and history restoration conceal data; another account/expiry clears panel',async()=>{
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>{assert.match(error.message,/Not implemented: navigation/);});
 const d=new JSDOM('<body><div id="admin-root">PRIVATE STUDENT AND PAYMENT</div></body>',{virtualConsole,url:'https://kickboxing19.ru/admin/students',runScripts:'outside-only',pretendToBeVisual:true});const w=d.window;let account='owner',status=200;
 w.setInterval=()=>1;w.fetch=async url=>({ok:status===200,status,json:async()=>url.endsWith('/csrf')?{csrfToken:'test-only'}:{authenticated:status===200,admin:{id:account}}});
 w.eval(source('site/scripts/admin/session-guard.js'));await w.FederationAdminSession.ready;
 w.dispatchEvent(new w.Event('offline'));assert.ok(w.document.documentElement.classList.contains('admin-locked'));
 w.dispatchEvent(new w.Event('online'));await new Promise(r=>setImmediate(r));assert.ok(!w.document.documentElement.classList.contains('admin-locked'));
 w.dispatchEvent(new w.Event('pagehide'));assert.ok(w.document.documentElement.classList.contains('admin-locked'));
 account='trainer-school-25';const restored=new w.Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});w.dispatchEvent(restored);await new Promise(r=>setImmediate(r));assert.ok(w.document.documentElement.classList.contains('admin-locked'));assert.equal(w.document.querySelector('#admin-root').textContent,'');d.window.close();
});

test('Installer with real header: hidden search does not block; open search defers then releases offer',async()=>{
 const app=installer('public');
 app.w.document.body.insertAdjacentHTML('beforeend',source('components/header.html'));
 app.prompt();app.run();assert.ok(app.w.document.querySelector('.pwa-install'),'hidden search must allow installation banner');
 const search=app.w.document.querySelector('#site-search');search.hidden=false;
 await new Promise(resolve=>setImmediate(resolve));assert.equal(app.w.document.querySelector('.pwa-install'),null,'open search hides the banner');
 search.hidden=true;await new Promise(resolve=>setImmediate(resolve));assert.ok(app.w.document.querySelector('.pwa-install'),'closing search must release the waiting banner');
 app.d.window.close();
});
test('Installer: closed native dialogs and CSS-hidden modal ancestors do not block',async()=>{
 const app=installer('public');app.w.document.body.insertAdjacentHTML('beforeend','<dialog aria-modal="true">Closed</dialog><div style="display:none"><div aria-modal="true">Hidden</div></div>');
 app.prompt();app.run();assert.ok(app.w.document.querySelector('.pwa-install'));app.d.window.close();
});
test('IDEAL-style notification: logo, close, Escape and swipe dismiss with seven-day state',()=>{
 for(const method of ['close','escape','swipe']){
  const app=installer('public');app.prompt();app.run();const banner=app.w.document.querySelector('.pwa-install');assert.ok(banner.querySelector('.pwa-install__logo'));assert.ok(banner.querySelector('[data-close]'));
  if(method==='close')banner.querySelector('[data-close]').click();
  if(method==='escape')banner.dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  if(method==='swipe'){
   const event=(name,touches,changedTouches)=>{const e=new app.w.Event(name,{bubbles:true});Object.defineProperties(e,{touches:{value:touches},changedTouches:{value:changedTouches}});banner.dispatchEvent(e);};
   event('touchstart',[{clientX:100,clientY:100}],[]);event('touchend',[],[{clientX:190,clientY:102}]);
  }
  assert.equal(app.w.document.querySelector('.pwa-install'),null);assert.ok(app.w.localStorage.getItem('fkh19:public:install:later'));app.d.window.close();
 }
});
