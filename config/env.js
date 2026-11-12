import 'dotenv/config';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function readConfig(){
 if(!process.env.DATABASE_URL?.startsWith('file:'))throw new Error('В .env задайте DATABASE_URL="file:./federation-dev.db" для отдельной SQLite базы.');
 const production=process.env.NODE_ENV==='production';
 const origins=String(process.env.APP_ORIGIN||'http://localhost:3000,http://127.0.0.1:3000').split(',').map(x=>x.trim()).filter(Boolean);
 for(const origin of origins){const u=new URL(origin);if(u.origin!==origin||!['http:','https:'].includes(u.protocol)||(production&&u.protocol!=='https:'))throw Error('Проверьте APP_ORIGIN: только origin, в production — HTTPS.');}
 const seoIndexable=process.env.SEO_INDEXABLE==='true';
 const seoVerification=Object.fromEntries([['google-site-verification','GOOGLE_SITE_VERIFICATION'],['yandex-verification','YANDEX_SITE_VERIFICATION'],['msvalidate.01','BING_SITE_VERIFICATION']].map(([name,key])=>[name,String(process.env[key]||'').trim().slice(0,256)]));
 return {seoIndexable,seoVerification,ROOT,production,origins,origin:origins[0],host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT)||3000,sessionHours:Number(process.env.SESSION_HOURS)||4,sessionIdleMinutes:Number(process.env.SESSION_IDLE_MINUTES)||2};
}
export {ROOT,readConfig};
