import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {randomBytes} from 'node:crypto';
import {hashPassword,verifyPassword} from '../services/password.service.js';
import {asyncHandler} from '../lib/http.js';
import requireCsrf from '../middleware/require-csrf.js';
function createAuthRouter({db,security,sessions,requireAuth,validateOrigin}){
 const router=Router();const dummy=hashPassword(randomBytes(32).toString('hex'));
 const limiter=rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,skipSuccessfulRequests:true,handler:(_req,res)=>res.status(429).json({success:false,message:'Слишком много попыток входа. Повторите через 15 минут.'})});
 router.post('/login',limiter,validateOrigin,asyncHandler(async(req,res)=>{
  const {login,password}=req.body||{};
  if(typeof login!=='string'||login.trim().length<3||login.length>100||typeof password!=='string'||!password||password.length>256)return res.status(400).json({success:false,message:'Проверьте логин и пароль.'});
  const admin=await db.admin.findUnique({where:{login:login.trim().toLowerCase()}});
  const valid=await verifyPassword(password,admin?.passwordHash||await dummy);
  if(!valid||!admin?.isActive||!['OWNER','EDITOR','TRAINER'].includes(admin.role))return res.status(401).json({success:false,message:'Неверный логин или пароль.'});
  // Пароль прежнего патча продолжает работать, при входе обновляем scrypt до Argon2id.
  const passwordHash=admin.passwordHash.startsWith('scrypt$')?await hashPassword(password):admin.passwordHash;
  await db.admin.update({where:{id:admin.id},data:{lastLoginAt:new Date(),passwordHash}});
  const {sessionToken,csrfToken}=await sessions.createAdminSession({adminId:admin.id,req});
  res.clearCookie('fed.sid',{path:'/'});res.cookie(security.cookieName,sessionToken,security.cookieOptions);
  res.json({success:true,message:'Авторизация выполнена.',admin:{id:admin.id,login:admin.login,name:admin.name,role:admin.role},csrfToken});
 }));
 router.get('/session',requireAuth,(req,res)=>res.json({success:true,authenticated:true,admin:req.auth.admin}));
 router.post('/csrf',validateOrigin,requireAuth,(req,res)=>res.json({success:true,csrfToken:req.auth.csrfToken}));
 router.post('/logout',validateOrigin,requireAuth,requireCsrf,asyncHandler(async(req,res)=>{await sessions.deleteAdminSession(req.auth.session.id);res.clearCookie(security.cookieName,security.cookieOptions);res.json({success:true,message:'Вы вышли из панели.'});}));
 return router;
}
export default createAuthRouter;
