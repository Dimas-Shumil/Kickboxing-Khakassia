import express,{Router} from 'express';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {rateLimit} from 'express-rate-limit';
import {asyncHandler,newsDTO} from '../lib/http.js';
import {HttpError} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createNewsService,mediaDir} from '../services/news.service.js';
function createNewsRouter({db,config,requireAuth,validateOrigin}){
 const router=Router(),write=createNewsService(db,config);router.use(requireAuth);
 router.get('/',asyncHandler(async(_req,res)=>res.json({success:true,news:(await db.news.findMany({orderBy:{updatedAt:'desc'}})).map(newsDTO)})));
 router.get('/media/:file',asyncHandler(async(req,res)=>{
  if(!/^[a-f0-9]{48}\.webp$/.test(req.params.file)||!await db.newsAsset.findUnique({where:{id:req.params.file}}))throw new HttpError(404,'Файл не найден.');
  res.sendFile(path.join(mediaDir(config),req.params.file));
 }));
 router.get('/:id',asyncHandler(async(req,res)=>{const news=await db.news.findUnique({where:{id:req.params.id}});if(!news)throw new HttpError(404,'Новость не найдена.');res.json({success:true,news:newsDTO(news)});}));
 router.use(validateOrigin,requireCsrf);
 router.post('/:id/upload',rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Слишком много загрузок. Повторите через минуту.'}}),express.raw({type:()=>true,limit:'8mb'}),asyncHandler(async(req,res)=>{
  if(!await db.news.findUnique({where:{id:req.params.id}}))throw new HttpError(404,'Новость не найдена.');
  if(await db.newsAsset.count({where:{newsId:req.params.id}})>=150)throw new HttpError(422,'Лимит загрузок новости: 150 файлов.');
  const mime=req.get('content-type')?.split(';')[0];
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Buffer.isBuffer(req.body)||!req.body.length)throw new HttpError(422,'Загрузите JPEG, PNG или WebP до 8 МБ.');
  let bytes;
  try{
   const image=sharp(req.body,{limitInputPixels:40000000,failOn:'warning',animated:true});const meta=await image.metadata();
   if(!['jpeg','png','webp'].includes(meta.format)||'image/'+meta.format!==mime||meta.pages>1||!meta.width||!meta.height)throw Error();
   bytes=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();
  }catch{throw new HttpError(422,'Файл повреждён, слишком большой, анимирован или не соответствует типу изображения.');}
  const id=randomBytes(24).toString('hex')+'.webp',file=path.join(mediaDir(config),id);await mkdir(mediaDir(config),{recursive:true});await writeFile(file,bytes,{flag:'wx',mode:0o600});
  try{await db.newsAsset.create({data:{id,newsId:req.params.id,size:bytes.length}});}catch(error){await unlink(file).catch(()=>{});throw error;}
  res.status(201).json({success:true,src:'/media/news/'+id});
 }));
 router.post('/',asyncHandler(async(req,res)=>res.status(201).json({success:true,entity:newsDTO(await write(req,'save'))})));
 router.patch('/:id',asyncHandler(async(req,res)=>res.json({success:true,entity:newsDTO(await write(req,'save'))})));
 router.post('/:id/:action',asyncHandler(async(req,res)=>res.json({success:true,entity:newsDTO(await write(req,req.params.action))})));
 return router;
}
export default createNewsRouter;
