import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import {SITE_ORIGIN,SITE_NAME,SITE_PHONE,publicEntries,indexAllowed} from '../services/seo.service.js';
const xml=s=>String(s??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export default function({db,config}){
 const router=Router();
 router.get('/robots.txt',(req,res)=>{
  const allow=indexAllowed(config,req);
  res.set('Cache-Control','no-store').type('text/plain').send(allow?`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nDisallow: /health\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
 });
 router.get('/sitemap.xml',asyncHandler(async(req,res)=>{
  const entries=indexAllowed(config,req)?await publicEntries(db):[];
  const urls=[...new Map(entries.map(r=>[r.path,r])).values()].map(r=>{
   const date=r.lastmod instanceof Date&&!Number.isNaN(r.lastmod.getTime())?`<lastmod>${r.lastmod.toISOString()}</lastmod>`:'';
   return `<url><loc>${xml(SITE_ORIGIN+r.path)}</loc>${date}</url>`;
  }).join('');
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex'}).type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
 }));
 router.get('/feed.xml',asyncHandler(async(req,res)=>{
  const rows=await db.news.findMany({where:{status:'published',publishedPayload:{not:null}},orderBy:{publishedOn:'desc'},take:50});
  const items=rows.filter(r=>r.slug).map(r=>{const p=JSON.parse(r.publishedPayload),url=SITE_ORIGIN+'/news/'+encodeURIComponent(r.slug);return `<item><title>${xml(p.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(p.lead)}</description>${r.publishedOn?`<pubDate>${r.publishedOn.toUTCString()}</pubDate>`:''}</item>`;}).join('');
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex'}).type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(SITE_NAME)}</title><link>${SITE_ORIGIN}/news</link><description>Опубликованные новости Федерации кикбоксинга Республики Хакасия</description><language>ru</language>${items}</channel></rss>`);
 }));
 router.get('/llms.txt',asyncHandler(async(_req,res)=>{
  const entries=await publicEntries(db),line=s=>String(s||'').replace(/[\r\n\[\]]/g,' ').trim();
  const list=entries.slice(0,250).map(r=>`- [${line(r.title)}](${SITE_ORIGIN+r.path})`).join('\n');
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex'}).type('text/plain').send(`# ${SITE_NAME}\n\n> Публичный сайт о кикбоксинге в Республике Хакасия.\n\nОсновной адрес: ${SITE_ORIGIN}/\nРегион: Республика Хакасия, Россия.\nТелефон: ${SITE_PHONE}.\n\n## Публичные материалы\n${list}\n\n## Машиночитаемые источники\n- Sitemap: ${SITE_ORIGIN}/sitemap.xml\n- RSS новостей: ${SITE_ORIGIN}/feed.xml\n\nСведения о соревнованиях и людях следует сверять с конкретной опубликованной страницей и указанными на ней источниками.\n`);
 }));
 return router;
}
