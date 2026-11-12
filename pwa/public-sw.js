// Only this application's technical offline shell is cached. No runtime cache.
const CACHE='fkh19-public-shell-v1';
const OWNED=/^fkh19-public-shell-v[0-9]+$/;
const OFFLINE='/pwa/offline';
const SHELL=[OFFLINE,'/site/css/pwa.min.css','/site/scripts/pwa-offline.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const url of SHELL){
  const response=await fetch(url,{cache:'no-store',credentials:'omit'});
  if(!response.ok||response.redirected)throw Error('Offline shell unavailable');
  if(/no-store/i.test(response.headers.get('cache-control')||''))throw Error('Shell marked no-store');
  const headers=new Headers(response.headers);
  await cache.put(url,new Response(await response.arrayBuffer(),{status:200,headers}));
 }
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(OWNED.test(key)&&key!==CACHE)await caches.delete(key);
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(SHELL.includes(url.pathname)&&!url.search){
  event.respondWith(fetch(req).catch(async()=>await caches.match(url.pathname,{cacheName:CACHE})||Response.error()));return;
 }
 if(req.mode!=='navigate')return;
 const privatePath=/^\/(?:admin|admin-pages|api|media|health)(?:\/|$)/.test(url.pathname);
 if(true&&privatePath)return; // Root worker must never intercept private navigation.
 event.respondWith((async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{return await fetch(req,{cache:'no-store',signal:controller.signal});}
  catch{return await caches.match(OFFLINE,{cacheName:CACHE})||new Response('Для работы нужно подключение к интернету.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  finally{clearTimeout(timer);}
 })());
});
// No skipWaiting, clients.claim, replay queue or automatic reload.
