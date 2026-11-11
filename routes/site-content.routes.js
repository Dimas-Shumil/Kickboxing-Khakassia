import express,{Router} from 'express';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {rateLimit} from 'express-rate-limit';
import {HttpError} from '../lib/validation.js';
import {asyncHandler} from '../lib/http.js';
import requireCsrf from '../middleware/require-csrf.js';
import {pageKeys,siteMediaDir,ownerPage,ownerDocument,pageDTO,docDTO,siteWriter,documentWriter,usageOf,siteAssetLocations} from '../services/site-content.service.js';

export function sendSiteMedia(res,config,id,download=false){
 res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(id.endsWith('.pdf')){res.set({'Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`attachment; filename="federation-${id}.pdf"`});res.type('application/pdf');}
 else {if(download)res.set('Content-Disposition',`attachment; filename="${id}"`);res.type('webp');}
 res.sendFile(path.join(siteMediaDir(config),id),{cacheControl:false},err=>{if(err&&!res.headersSent)res.status(404).end();});
}
export default function createSiteAdminRouter({db,config,requireAuth,validateOrigin}){
 const r=Router(),pageWrite=siteWriter(db,config),docWrite=documentWriter(db,config);
 r.use(requireAuth);
 r.get('/pages',asyncHandler(async(_req,res)=>res.json({success:true,pages:await Promise.all(pageKeys.map(async key=>pageDTO(await db.sitePage.findUnique({where:{key}}),key)))})));
 r.get('/pages/:key',asyncHandler(async(req,res)=>{if(!pageKeys.includes(req.params.key))throw new HttpError(404,'Страница не найдена.');res.json({success:true,page:pageDTO(await db.sitePage.findUnique({where:{key:req.params.key}}),req.params.key)});}));
 r.get('/documents',asyncHandler(async(_req,res)=>res.json({success:true,documents:(await db.federationDocument.findMany({orderBy:{updatedAt:'desc'}})).map(docDTO)})));
 r.get('/documents/:id',asyncHandler(async(req,res)=>{const row=await db.federationDocument.findUnique({where:{id:req.params.id}});if(!row)throw new HttpError(404,'Документ не найден.');res.json({success:true,document:docDTO(row)});}));
 const mediaData=async()=>{
  const assets=await db.siteAsset.findMany({orderBy:{createdAt:'desc'}});
  const pages=await db.sitePage.findMany(),docs=await db.federationDocument.findMany();
  return assets.map(a=>{const row=a.ownerKey.startsWith('page:')?pages.find(p=>p.key===a.ownerKey.slice(5)):docs.find(d=>a.ownerKey===ownerDocument(d.id));const used=usageOf(row,'/media/site/'+a.id);return {id:a.id,src:'/media/site/'+a.id,ownerKey:a.ownerKey,ownerName:a.ownerKey.startsWith('page:')?({home:'Главная',federation:'О Федерации',contacts:'Контакты'}[a.ownerKey.slice(5)]||a.ownerKey):'Документ: '+(row?.title||a.ownerKey.slice(9)),kind:a.kind,size:a.size,version:row?.version||0,...used,workingLocations:siteAssetLocations(row?.payload,'/media/site/'+a.id),publishedLocations:siteAssetLocations(row?.publishedPayload,'/media/site/'+a.id),canDelete:!used.working&&!used.published};});
 };
 r.get('/media',asyncHandler(async(_req,res)=>res.json({success:true,assets:await mediaData(),sections:{news:await db.newsAsset.count(),people:await db.personAsset.count(),competitions:await db.competitionAsset.count(),history:await db.historyAsset.count()}})));
 r.get('/media/:id',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.(webp|pdf)$/.test(req.params.id)||!await db.siteAsset.findUnique({where:{id:req.params.id}}))throw new HttpError(404,'Файл не найден.');sendSiteMedia(res,config,req.params.id);}));
 r.use(validateOrigin,requireCsrf);
 r.patch('/pages/:key',asyncHandler(async(req,res)=>res.json({success:true,page:await pageWrite(req,req.params.key,'save')})));
 r.post('/pages/:key/:action(publish|unpublish)',asyncHandler(async(req,res)=>res.json({success:true,page:await pageWrite(req,req.params.key,req.params.action)})));
 r.post('/documents',asyncHandler(async(req,res)=>res.status(201).json({success:true,document:await docWrite(req,null,'save')})));
 r.patch('/documents/:id',asyncHandler(async(req,res)=>res.json({success:true,document:await docWrite(req,req.params.id,'save')})));
 r.post('/documents/:id/:action(publish|unpublish|archive|restore)',asyncHandler(async(req,res)=>res.json({success:true,document:await docWrite(req,req.params.id,req.params.action)})));
 const uploads=rateLimit({windowMs:60_000,limit:70,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Слишком много загрузок. Попробуйте позже.'}});
 async function owner(req,kind){if(kind==='image'){
  if(!pageKeys.includes(req.params.key))throw new HttpError(404,'Страница не найдена.');return ownerPage(req.params.key);
 }const doc=await db.federationDocument.findUnique({where:{id:req.params.id}});if(!doc)throw new HttpError(404,'Документ не найден.');if(doc.status==='archived')throw new HttpError(422,'Сначала восстановите документ.');return ownerDocument(doc.id);}
 async function upload(req,res,kind){
  const ownerKey=await owner(req,kind);
  if(await db.siteAsset.count({where:{ownerKey}})>=100)throw new HttpError(422,'Максимум 100 файлов для одной записи. Удалите неиспользуемые.');
  const bytes=req.body,mime=req.get('content-type')?.split(';')[0];if(!Buffer.isBuffer(bytes)||!bytes.length)throw new HttpError(422,'Файл пуст или повреждён.');
  let prepared,ext;
  if(kind==='image'){
   if(bytes.length>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(mime))throw new HttpError(422,'Разрешены JPEG/PNG/WebP до 8 МиБ.');
   try{const image=sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning',animated:true});const m=await image.metadata();if(m.pages>1||!m.width||!m.height||'image/'+m.format!==mime)throw Error('format');prepared=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}catch{throw new HttpError(422,'Файл повреждён, анимирован или подменён его формат.');}ext='webp';
  }else{
   if(mime!=='application/pdf'||bytes.length>12*1024*1024||bytes.length<100||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-2048).includes(Buffer.from('%%EOF')))throw new HttpError(422,'Загрузите настоящий PDF до 12 МиБ.');
   try{const pdf=await PDFDocument.load(bytes,{updateMetadata:false});if(pdf.getPageCount()<1||pdf.getPageCount()>500)throw Error('pages');}catch{throw new HttpError(422,'PDF повреждён, зашифрован или не поддерживается.');}
   prepared=bytes;ext='pdf';
  }
  const id=randomBytes(24).toString('hex')+'.'+ext,file=path.join(siteMediaDir(config),id);
  await mkdir(siteMediaDir(config),{recursive:true});await writeFile(file,prepared,{flag:'wx',mode:0o600});
  try{await db.siteAsset.create({data:{id,ownerKey,kind,size:prepared.length}});}catch(e){await unlink(file).catch(()=>{});throw e;}
  res.status(201).json({success:true,src:'/media/site/'+id});
 }
 r.post('/pages/:key/upload-image',uploads,express.raw({type:()=>true,limit:'8mb'}),asyncHandler(async(req,res)=>upload(req,res,'image')));
 r.post('/documents/:id/upload-pdf',uploads,express.raw({type:()=>true,limit:'12mb'}),asyncHandler(async(req,res)=>upload(req,res,'pdf')));
 r.delete('/media/:id',asyncHandler(async(req,res)=>{
  if(!/^[a-f0-9]{48}\.(webp|pdf)$/.test(req.params.id))throw new HttpError(404,'Файл не найден.');
  const asset=await db.siteAsset.findUnique({where:{id:req.params.id}});if(!asset)throw new HttpError(404,'Файл не найден.');
  const isPage=asset.ownerKey.startsWith('page:'),key=asset.ownerKey.slice(5),model=isPage?'sitePage':'federationDocument';
  const row=await db[model].findUnique({where:isPage?{key}:{id:asset.ownerKey.slice(9)}});
  if(row&&row.version!==req.body?.version)throw new HttpError(409,'Версия записи устарела. Обновите список файлов.');
  const used=usageOf(row,'/media/site/'+asset.id);if(used.working||used.published)throw new HttpError(409,'Файл используется в рабочей или опубликованной версии. Сначала исключите его и сохраните запись.');
  await db.$transaction(async tx=>{
   const current=await tx[model].findUnique({where:isPage?{key}:{id:asset.ownerKey.slice(9)}});
   if(current){if(current.version!==row.version)throw new HttpError(409,'Версия изменилась.');const u=usageOf(current,'/media/site/'+asset.id);if(u.working||u.published)throw new HttpError(409,'Файл ещё используется.');const updated=await tx[model].updateMany({where:{...(isPage?{key}:{id:current.id}),version:row.version},data:{version:{increment:1}}});if(!updated.count)throw new HttpError(409,'Версия изменилась.');}
   await tx.siteAsset.delete({where:{id:asset.id}});
   await tx.auditLog.create({data:{actorId:req.user.id,scope:'site-media',entityId:asset.id,action:'delete'}});
  }).catch(err=>{if(['P2002','P2025','P2034','P2028'].includes(err?.code))throw new HttpError(409,'Файл был изменён или удалён в другой вкладке. Обновите список.');throw err;});
  await unlink(path.join(siteMediaDir(config),asset.id)).catch(err=>{if(err.code!=='ENOENT')console.error('Site media orphan:',asset.id,err.code);});
  res.json({success:true,message:'Файл удалён. Запись нужно перечитать перед следующим сохранением.'});
 }));
 return r;
}
