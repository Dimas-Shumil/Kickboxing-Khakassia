import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import {HttpError,text} from '../lib/validation.js';
import requireOwner from '../middleware/require-owner.js';
import requireCsrf from '../middleware/require-csrf.js';
import {hashPassword} from '../services/password.service.js';
export default function({db,requireAuth,validateOrigin}){
 const r=Router();r.use(requireAuth,requireOwner);
 r.get('/',asyncHandler(async(_req,res)=>res.json({success:true,users:await db.admin.findMany({select:{id:true,login:true,name:true,role:true,gymId:true,isActive:true},orderBy:{name:'asc'}}),gyms:await db.gym.findMany({orderBy:{id:'asc'}})})));
 r.use(validateOrigin,requireCsrf);
 const save=async(req,res)=>{
  const b=req.body;if(!['EDITOR','TRAINER'].includes(b.role))throw new HttpError(422,'Доступные роли: EDITOR, TRAINER.');
  if(typeof b.isActive!=='boolean')throw new HttpError(422,'Укажите состояние учётной записи.');
  const gymId=b.role==='TRAINER'?b.gymId:null;
  if(b.role==='TRAINER'&&(!gymId||!await db.gym.findUnique({where:{id:gymId}})))throw new HttpError(422,'Выберите зал тренера.');
  const login=text(b.login,'Логин',100,true).toLowerCase(),name=text(b.name,'Имя',180,true);
  if(!/^[a-z0-9._-]{3,100}$/.test(login))throw new HttpError(422,'Логин: от 3 символов латиницы, цифры, ._-');
  const data={login,name,role:b.role,gymId,isActive:b.isActive};
  if(b.password){if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)throw new HttpError(422,'Пароль: 12–256 символов.');data.passwordHash=await hashPassword(b.password);}
  if(!req.params.id&&!data.passwordHash)throw new HttpError(422,'Укажите пароль новой учётной записи.');
  try{await db.$transaction(async tx=>{
   if(req.params.id){const old=await tx.admin.findUnique({where:{id:req.params.id}});if(!old||old.role==='OWNER')throw new HttpError(403,'Эта учётная запись недоступна для изменения.');await tx.admin.update({where:{id:old.id},data});await tx.adminSession.deleteMany({where:{adminId:old.id}});}
   else await tx.admin.create({data});
  });}catch(e){if(e.code==='P2002')throw new HttpError(409,'Этот логин уже занят.');throw e;}
  res.json({success:true});
 };
 r.post('/',asyncHandler(save));r.patch('/:id',asyncHandler(save));return r;
}
