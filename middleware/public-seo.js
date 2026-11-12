import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {pageSeo,injectSeo,indexAllowed} from '../services/seo.service.js';

export function publicSeo({db,config}){
 const publicRoot=path.resolve(config.ROOT,'public')+path.sep;
 return (req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method)||/^\/(?:api|admin|admin-pages|health|site|components|media)(?:\/|$)/.test(req.path))return next();
  const originalSend=res.send,originalFile=res.sendFile;
  res.send=function(body){
   const isHtml=typeof body==='string'&&(/html/i.test(res.get('Content-Type')||'')||/^\s*<!doctype html/i.test(body));
   if(!isHtml||res.statusCode>=300&&res.statusCode<400)return originalSend.call(this,body);
   const status=res.statusCode;
   Promise.resolve().then(async()=>{
    const meta=status===200?await pageSeo(db,req.path):null;
    const allowed=status===200&&meta?.eligible&&indexAllowed(config,req);
    res.set('X-Robots-Tag',allowed?'index, follow':'noindex, follow');
    let contacts={};
    if(meta){const row=await db.sitePage.findUnique({where:{key:'contacts'}});if(row?.publishedPayload){try{contacts=JSON.parse(row.publishedPayload);}catch{}}}
    const verification=config.seoVerification||{};
    originalSend.call(res,injectSeo(body,meta,{indexable:!!allowed,contacts,verification}));
   }).catch(next);
   return this;
  };
  res.sendFile=function(file,options,callback){
   const absolute=path.resolve(options?.root||'',file);
   if(path.extname(absolute)!=='.html'||!absolute.startsWith(publicRoot))return originalFile.call(this,file,options,callback);
   // Public templates need server-side metadata too; assets and private files keep sendFile.
   readFile(absolute,'utf8').then(html=>{res.type('html').send(html);}).catch(error=>{const cb=typeof options==='function'?options:callback;if(cb)cb(error);else next(error);});
   return this;
  };
  next();
 };
}
