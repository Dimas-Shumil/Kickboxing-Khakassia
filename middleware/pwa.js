import {Router} from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
export function pwaRoutes(config){
 const r=Router();
 for(const [url,file,type] of [
 ['/manifest.webmanifest','public.webmanifest','application/manifest+json'],
 ['/admin/manifest.webmanifest','admin.webmanifest','application/manifest+json'],
 ['/sw.js','public-sw.js','application/javascript'],
 ['/admin/sw.js','admin-sw.js','application/javascript'],
 ['/pwa/offline','public-offline.html','text/html'],
 ['/admin/offline','admin-offline.html','text/html']])r.get(url,(_req,res)=>res.set({'Cache-Control':file.endsWith('-offline.html')?'public, max-age=0, must-revalidate':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':type}).sendFile(path.join(config.ROOT,'pwa',file),{cacheControl:false}));
 r.use('/pwa/assets', (req,res,next)=>{res.set('X-Robots-Tag','noindex');next();});
 return r;
}
export function pwaHtml(config){return (req,res,next)=>{
 const requestPath=new URL(req.originalUrl,'http://localhost').pathname;
 const send=res.send,sendFile=res.sendFile;
 res.send=function(body){
  if(/html/i.test(res.get('Content-Type')||'')&&typeof body==='string'&&/<head[\s>]/i.test(body)&&!body.includes('data-fed-pwa')){
   const admin=/^\/admin(?:\/|$)/.test(requestPath);
   const mode=admin?(requestPath==='/admin/login'?'login':res.statusCode===200&&!/preview/.test(requestPath)?'admin':'private'):'public';
   const manifest=admin?'/admin/manifest.webmanifest':'/manifest.webmanifest';
   body=body.replace(/<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>/gi,'');
   if(admin&&mode==='private'&&!body.includes('/site/scripts/admin/session-guard.js'))body=body.replace(/<\/head>/i,'<script defer src="/site/scripts/admin/session-guard.js"></script></head>');
   body=body.replace(/<\/head>/i,`<meta name="theme-color" content="#111d37"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="${admin?'ФКХ · Управление':'Кикбоксинг Хакасии'}"><link rel="apple-touch-icon" href="/pwa/assets/${admin?'admin':'public'}-180.png"><link rel="manifest" href="${manifest}"><link rel="stylesheet" href="/site/css/pwa.min.css"><script defer data-fed-pwa="${mode}" src="/site/scripts/pwa.js"></script></head>`);
  }
  return send.call(this,body);
 };
 res.sendFile=function(file,options,callback){
  if(path.resolve(file).startsWith(path.join(config.ROOT,'admin-pages')+path.sep)&&path.extname(file)==='.html'){
   readFile(file,'utf8').then(body=>res.type('html').send(body)).catch(next);return this;
  }
  return sendFile.call(this,file,options,callback);
 };
 next();
};}
