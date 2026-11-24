import express, {Router} from 'express';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {rateLimit} from 'express-rate-limit';
import sharp from 'sharp';
import {asyncHandler} from '../lib/http.js';
import {HttpError} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {catalog,consentVersion,createShopRequest,getShopSettings,imageId,requestStatuses,saveProduct,saveSettings,shopProduct} from '../services/shop.service.js';
import {renderShop} from '../services/shop-render.service.js';

const noStore = (_req,res,next) => {res.set('Cache-Control','no-store');next();};
const owner = (req,_res,next) => {
 if (req.user.role!=='OWNER') return next(new HttpError(403,'Управление магазином доступно владельцу.'));
 next();
};
const json = (req,_res,next) => req.is('application/json') && req.body && typeof req.body==='object' && !Array.isArray(req.body)
 ? next() : next(new HttpError(415,'Ожидаются данные JSON.'));
const limit = (count,message) => rateLimit({windowMs:15*60*1000,limit:count,standardHeaders:'draft-7',legacyHeaders:false,message:{success:false,message}});
const dir = config => config.shopUploadDir || path.resolve(config.ROOT,'var/shop-media');
const file = (config,id) => path.join(dir(config),id+'.webp');
const validName = value => /^[a-f0-9]{48}\.webp$/.test(value);
const sendImage = (res,config,name) => res.type('webp').sendFile(path.join(dir(config),name),{cacheControl:false},err=>{if(err&&!res.headersSent)res.status(404).end();});

export function shopPublicRouter({db,config,validateOrigin}) {
 const r = Router();
 r.get('/api/shop/products',noStore,asyncHandler(async(_req,res)=>res.json({products:await catalog(db)})));
 r.post('/api/shop/requests',noStore,validateOrigin,json,limit(15,'Слишком много заявок. Попробуйте позже.'),asyncHandler(async(req,res)=>{
  res.status(201).json({success:true,...await createShopRequest(db,req.body)});
 }));
 r.get('/media/shop/:name',noStore,asyncHandler(async(req,res)=>{
  const name = req.params.name;
  if (!validName(name) || !await db.shopProduct.findFirst({where:{image:name.slice(0,-5),published:true},select:{id:true}})) return res.status(404).end();
  sendImage(res,config,name);
 }));
 r.get(['/shop','/shop/:slug','/cart','/shop-policy','/shop-consent'],noStore,asyncHandler(async(req,res)=>{
  const canonical = req.params.slug ? '/shop/'+encodeURIComponent(req.params.slug) : req.path.replace(/\/+$/,'').toLowerCase();
  if (req.path!==canonical) {
   const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
   return res.redirect(301,canonical+query);
  }
  const settings = await getShopSettings(db);
  const products = req.path==='/shop' ? await catalog(db) : [];
  const product = req.params.slug ? await db.shopProduct.findFirst({where:{slug:req.params.slug,published:true}}) : null;
  if (req.params.slug && !product) return res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
  if (req.path!=='/shop' || !products.length) res.set('X-Robots-Tag','noindex, follow');
  const template = await readFile(path.join(config.ROOT,'views/shop.html'),'utf8');
  res.type('html').send(renderShop(template,{path:req.path,query:req.query,settings,products,product:product&&shopProduct(product)}));
 }));
 return r;
}

export function shopAdminRouter({db,config,requireAuth,validateOrigin}) {
 const r = Router();
 r.use(requireAuth,owner);
 r.get('/products',asyncHandler(async(_req,res)=>{
  res.json({products:await db.shopProduct.findMany({orderBy:{updatedAt:'desc'}})});
 }));
 const product = async(req,res) => {
  const entity = await saveProduct(db,req.body,req.params.id,async id=>access(file(config,id)).then(()=>true,()=>false));
  res.status(req.params.id?200:201).json({entity});
 };
 r.post('/products',validateOrigin,requireCsrf,json,asyncHandler(product));
 r.patch('/products/:id',validateOrigin,requireCsrf,json,asyncHandler(product));
 r.delete('/products/:id', validateOrigin, requireCsrf, json, asyncHandler(async (req, res) => {
 const version = req.body.version;
 if (!Number.isSafeInteger(version) || version < 1) {
  throw new HttpError(422, 'Обновите список товаров.');
 }

 const result = await db.shopProduct.deleteMany({
  where: { id: req.params.id, version }
 });
 if (!result.count) {
  throw new HttpError(409, 'Товар уже изменён или удалён. Обновите список.');
 }

 res.json({ success: true });
}));
 r.post('/images',validateOrigin,requireCsrf,limit(40,'Слишком много загрузок. Попробуйте позже.'),
  express.raw({type:['image/jpeg','image/png','image/webp'],limit:'6mb'}),asyncHandler(async(req,res)=>{
   if (!Buffer.isBuffer(req.body)) throw new HttpError(415,'Выберите JPEG, PNG или WebP.');
   let buffer;
   try {
    const source = sharp(req.body,{limitInputPixels:24000000});
    const metadata = await source.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages||1)>1) throw Error();
    buffer = await source.rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
   }
   catch {throw new HttpError(422,'Изображение не удалось прочитать.');}
   const id = randomBytes(24).toString('hex');
   await mkdir(dir(config),{recursive:true});
   await writeFile(file(config,id),buffer,{flag:'wx'});
   res.status(201).json({id});
  }));
 r.get('/images/:name',(req,res)=>validName(req.params.name) ? sendImage(res,config,req.params.name) : res.status(404).end());
 r.get('/settings',asyncHandler(async(_req,res)=>res.json({settings:await getShopSettings(db)})));
 r.put('/settings',validateOrigin,requireCsrf,json,asyncHandler(async(req,res)=>res.json({settings:await saveSettings(db,req.body)})));
 r.get('/requests',asyncHandler(async(req,res)=>{
  const page = typeof req.query.page==='string' && /^\d{1,6}$/.test(req.query.page) ? Number(req.query.page) : 0;
  const rows = await db.shopRequest.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],skip:page*30,take:31,
   select:{id:true,number:true,name:true,phone:true,items:true,total:true,status:true,createdAt:true}});
  res.json({requests:rows.slice(0,30),hasMore:rows.length>30});
 }));
 r.patch('/requests/:id',validateOrigin,requireCsrf,json,asyncHandler(async(req,res)=>{
  if (![req.body.status,req.body.previous].every(status=>requestStatuses.includes(status))) throw new HttpError(422,'Неизвестный статус.');
  const result = await db.shopRequest.updateMany({where:{id:req.params.id,status:req.body.previous},data:{status:req.body.status}});
  if (!result.count) throw new HttpError(409,'Статус уже изменился. Обновите список.');
  res.json({success:true});
 }));
 r.delete('/requests/:id',validateOrigin,requireCsrf,json,asyncHandler(async(req,res)=>{
  if (!requestStatuses.includes(req.body.previous)) throw new HttpError(422,'Обновите список заявок.');
  const result = await db.shopRequest.deleteMany({where:{id:req.params.id,status:req.body.previous}});
  if (!result.count) throw new HttpError(409,'Заявка уже изменена или удалена. Обновите список.');
  res.json({success:true});
 }));
 return r;
}
