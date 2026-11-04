import express,{Router} from 'express';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {rateLimit} from 'express-rate-limit';
import {asyncHandler} from '../lib/http.js';
import {HttpError} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createCompetitionWriter,competitionDTO,competitionMediaDir} from '../services/competitions.service.js';
import {listCompetitionMedia,deleteCompetitionMedia} from '../services/competitions-media.service.js';
import {validatePDF} from '../services/competition-pdf.service.js';
export function sendCompetitionFile(res,config,file){
 const pdf=file.endsWith('.pdf');res.set({'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
 if(pdf)res.set({'Content-Disposition':'attachment; filename="competition-document.pdf"','Content-Security-Policy':"default-src 'none'; sandbox"});
 res.type(pdf?'pdf':'webp').sendFile(path.join(competitionMediaDir(config),file),{cacheControl:false},err=>{if(err&&!res.headersSent)res.status(404).end();});
}
export default function createCompetitionsRouter({db,config,requireAuth,validateOrigin}){
 const router=Router(),write=createCompetitionWriter(db,config);router.use(requireAuth);
 router.get('/',asyncHandler(async(_req,res)=>res.json({success:true,competitions:(await db.competition.findMany({orderBy:{updatedAt:'desc'}})).map(competitionDTO)})));
 router.get('/media/:file',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.(webp|pdf)$/.test(req.params.file)||!await db.competitionAsset.findUnique({where:{id:req.params.file}}))throw new HttpError(404,'Файл не найден.');sendCompetitionFile(res,config,req.params.file);}));
 router.get('/:id',asyncHandler(async(req,res)=>{const row=await db.competition.findUnique({where:{id:req.params.id}});if(!row)throw new HttpError(404,'Соревнование не найдено.');res.json({success:true,competition:competitionDTO(row)});}));
 router.get('/:id/media',asyncHandler(async(req,res)=>res.json({success:true,...await listCompetitionMedia(db,req.params.id)})));
 router.use(validateOrigin,requireCsrf);
 router.delete('/:id/media/:file',asyncHandler(async(req,res)=>res.json({success:true,entity:await deleteCompetitionMedia(db,config,req)})));
 const limiter=rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Слишком много загрузок. Повторите через минуту.'}});
 for(const kind of ['image','document'])router.post('/:id/upload-'+kind,limiter,express.raw({type:()=>true,limit:kind==='image'?'8mb':'10mb'}),asyncHandler(async(req,res)=>{
  const parent=await db.competition.findUnique({where:{id:req.params.id}});if(!parent)throw new HttpError(404,'Соревнование не найдено.');if(parent.status==='archived')throw new HttpError(422,'Сначала восстановите соревнование.');
  if(await db.competitionAsset.count({where:{competitionId:parent.id}})>=150)throw new HttpError(422,'Максимум 150 загрузок на соревнование. Удалите неиспользуемые файлы.');
  const mime=req.get('content-type')?.split(';')[0];if(!Buffer.isBuffer(req.body)||!req.body.length)throw new HttpError(422,'Выберите файл.');let bytes;
  if(kind==='image'){
   if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new HttpError(422,'Только JPEG, PNG или WebP до 8 МиБ.');
   try{const image=sharp(req.body,{limitInputPixels:40000000,failOn:'warning',animated:true}),m=await image.metadata();if(!['jpeg','png','webp'].includes(m.format)||'image/'+m.format!==mime||m.pages>1||!m.width||!m.height)throw Error();bytes=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}catch{throw new HttpError(422,'Повреждённое, слишком большое, анимированное изображение или подмена формата.');}
  }else{if(mime!=='application/pdf')throw new HttpError(422,'Только PDF до 10 МиБ.');await validatePDF(req.body);bytes=req.body;}
  const id=randomBytes(24).toString('hex')+(kind==='image'?'.webp':'.pdf'),file=path.join(competitionMediaDir(config),id);await mkdir(competitionMediaDir(config),{recursive:true});await writeFile(file,bytes,{flag:'wx',mode:0o600});
  try{await db.competitionAsset.create({data:{id,competitionId:parent.id,kind:kind==='image'?'image':'pdf',size:bytes.length}});}catch(err){await unlink(file).catch(()=>{});throw err;}
  res.status(201).json({success:true,src:'/media/competitions/'+id});
 }));
 router.post('/',asyncHandler(async(req,res)=>res.status(201).json({success:true,entity:competitionDTO(await write(req,'save'))})));
 router.patch('/:id',asyncHandler(async(req,res)=>res.json({success:true,entity:competitionDTO(await write(req,'save'))})));
 router.post('/:id/:action',asyncHandler(async(req,res)=>res.json({success:true,entity:competitionDTO(await write(req,req.params.action))})));
 return router;
}
