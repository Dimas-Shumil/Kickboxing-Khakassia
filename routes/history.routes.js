import express,{Router} from 'express';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {rateLimit} from 'express-rate-limit';
import {asyncHandler} from '../lib/http.js';
import {HttpError} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createHistoryWriter,historyDTO,historyMediaDir} from '../services/history.service.js';
import {listHistoryMedia,deleteHistoryMedia} from '../services/history-media.service.js';
export function sendHistoryFile(res,c,file){res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.type('webp').sendFile(path.join(historyMediaDir(c),file),{cacheControl:false},err=>{if(err&&!res.headersSent)res.status(404).end();});}
export default function createHistoryRouter({db,config,requireAuth,validateOrigin}){
 const r=Router(),write=createHistoryWriter(db,config);r.use(requireAuth);
 r.get('/',asyncHandler(async(_req,res)=>res.json({success:true,materials:(await db.historyMaterial.findMany({orderBy:{updatedAt:'desc'}})).map(historyDTO)})));
 r.get('/media/:file',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.webp$/.test(req.params.file)||!await db.historyAsset.findUnique({where:{id:req.params.file}}))throw new HttpError(404,'Файл не найден.');sendHistoryFile(res,config,req.params.file);}));
 r.get('/:id',asyncHandler(async(req,res)=>{const row=await db.historyMaterial.findUnique({where:{id:req.params.id}});if(!row)throw new HttpError(404,'Материал не найден.');res.json({success:true,material:historyDTO(row)});}));
 r.get('/:id/media',asyncHandler(async(req,res)=>res.json({success:true,...await listHistoryMedia(db,req.params.id)})));
 r.use(validateOrigin,requireCsrf);
 r.delete('/:id/media/:file',asyncHandler(async(req,res)=>res.json({success:true,entity:await deleteHistoryMedia(db,config,req)})));
 const limiter=rateLimit({windowMs:60_000,limit:65,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Слишком много загрузок. Повторите позже.'}});
 r.post('/:id/upload-image',limiter,express.raw({type:()=>true,limit:'8mb'}),asyncHandler(async(req,res)=>{
  const parent=await db.historyMaterial.findUnique({where:{id:req.params.id}});if(!parent)throw new HttpError(404,'Материал не найден.');if(parent.status==='archived')throw new HttpError(422,'Восстановите материал для загрузки.');
  if(await db.historyAsset.count({where:{materialId:parent.id}})>=100)throw new HttpError(422,'Максимум 100 загруженных файлов на материал; удалите неиспользуемые.');
  const mime=req.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Buffer.isBuffer(req.body)||!req.body.length)throw new HttpError(422,'Допустимы JPEG, PNG или WebP до 8 МиБ.');
  let bytes;try{const im=sharp(req.body,{limitInputPixels:40_000_000,failOn:'warning',animated:true}),m=await im.metadata();if(!['jpeg','png','webp'].includes(m.format)||'image/'+m.format!==mime||m.pages>1||!m.width||!m.height)throw Error('invalid');bytes=await im.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}catch{throw new HttpError(422,'Повреждённое, анимированное, слишком большое изображение или подмена формата.');}
  const id=randomBytes(24).toString('hex')+'.webp',file=path.join(historyMediaDir(config),id);await mkdir(historyMediaDir(config),{recursive:true});await writeFile(file,bytes,{flag:'wx',mode:0o600});
  try{await db.historyAsset.create({data:{id,materialId:parent.id,size:bytes.length}});}catch(err){await unlink(file).catch(()=>{});throw err;}
  res.status(201).json({success:true,src:'/media/history/'+id});
 }));
 r.post('/',asyncHandler(async(req,res)=>res.status(201).json({success:true,entity:historyDTO(await write(req,'save'))})));
 r.patch('/:id',asyncHandler(async(req,res)=>res.json({success:true,entity:historyDTO(await write(req,'save'))})));
 r.post('/:id/:action',asyncHandler(async(req,res)=>{if(!['publish','unpublish','archive','restore'].includes(req.params.action))throw new HttpError(404,'Действие не найдено.');res.json({success:true,entity:historyDTO(await write(req,req.params.action))});}));
 return r;
}
