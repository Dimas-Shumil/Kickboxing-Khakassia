import express,{Router} from 'express';
import {listPersonMedia,deletePersonMedia} from '../services/people-media.service.js';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {rateLimit} from 'express-rate-limit';
import {asyncHandler} from '../lib/http.js';
import {HttpError} from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createPeopleWriter,personDTO,peopleMediaDir,comparePeople} from '../services/people.service.js';
export default function createPeopleRouter({db,config,requireAuth,validateOrigin}){
 const router=Router(),write=createPeopleWriter(db,config);router.use(requireAuth);
 router.get('/',asyncHandler(async(_req,res)=>res.json({success:true,people:(await db.person.findMany({orderBy:{name:'asc'}})).map(personDTO).sort(comparePeople)})));
 router.get('/media/:file',asyncHandler(async(req,res)=>{if(!/^[a-f0-9]{48}\.webp$/.test(req.params.file)||!await db.personAsset.findUnique({where:{id:req.params.file}}))throw new HttpError(404,'Файл не найден.');res.sendFile(path.join(peopleMediaDir(config),req.params.file));}));
 router.get('/:id',asyncHandler(async(req,res)=>{const p=await db.person.findUnique({where:{id:req.params.id}});if(!p)throw new HttpError(404,'Человек не найден.');res.json({success:true,person:personDTO(p)});}));
 router.get('/:id/media',asyncHandler(async(req,res)=>res.json({success:true,...await listPersonMedia(db,req.params.id)})));
 router.use(validateOrigin,requireCsrf);
 router.delete('/:id/media/:file',asyncHandler(async(req,res)=>res.json({success:true,entity:await deletePersonMedia(db,config,req),message:'Неиспользуемая фотография удалена.'})));
 router.post('/:id/upload',rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Слишком много загрузок. Повторите через минуту.'}}),express.raw({type:()=>true,limit:'8mb'}),asyncHandler(async(req,res)=>{
  const person=await db.person.findUnique({where:{id:req.params.id}});if(!person)throw new HttpError(404,'Человек не найден.');if(person.status==='archived')throw new HttpError(422,'Сначала восстановите профиль.');
  if(await db.personAsset.count({where:{personId:person.id}})>=150)throw new HttpError(422,'Лимит загрузок: 150 файлов для человека.');
  const mime=req.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Buffer.isBuffer(req.body)||!req.body.length)throw new HttpError(422,'Загрузите JPEG, PNG или WebP до 8 МиБ.');
  let bytes;try{const image=sharp(req.body,{limitInputPixels:40000000,failOn:'warning',animated:true}),m=await image.metadata();if(!['jpeg','png','webp'].includes(m.format)||'image/'+m.format!==mime||m.pages>1||!m.width||!m.height)throw Error();bytes=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}catch{throw new HttpError(422,'Повреждённое, слишком большое, анимированное изображение или подмена типа файла.');}
  const id=randomBytes(24).toString('hex')+'.webp',file=path.join(peopleMediaDir(config),id);await mkdir(peopleMediaDir(config),{recursive:true});await writeFile(file,bytes,{flag:'wx',mode:0o600});
  try{await db.personAsset.create({data:{id,personId:person.id,size:bytes.length}});}catch(err){await unlink(file).catch(()=>{});throw err;}
  res.status(201).json({success:true,src:'/media/people/'+id});
 }));
 router.post('/',asyncHandler(async(req,res)=>res.status(201).json({success:true,entity:personDTO(await write(req,'save'))})));
 router.patch('/:id',asyncHandler(async(req,res)=>res.json({success:true,entity:personDTO(await write(req,'save'))})));
 router.post('/:id/:action',asyncHandler(async(req,res)=>res.json({success:true,entity:personDTO(await write(req,req.params.action))})));
 return router;
}
