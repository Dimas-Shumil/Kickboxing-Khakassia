import {gymContext} from '../lib/gym-scope.js';
import {hashToken,csrfForToken} from '../services/session.service.js';
import {asyncHandler} from '../lib/http.js';
function createRequireAuth(db,security){
 const reject=(res,page)=>{res.clearCookie(security.cookieName,security.cookieOptions);return page?res.redirect(303,'/admin/login'):res.status(401).json({success:false,message:'Требуется авторизация.'});};
 const authenticate=page=>asyncHandler(async(req,res,next)=>{
  const raw=req.cookies?.[security.cookieName];if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))return reject(res,page);
  const session=await db.adminSession.findUnique({where:{tokenHash:hashToken(raw)},include:{admin:{select:{id:true,login:true,name:true,role:true,gymId:true,isActive:true,lastLoginAt:true}}}});
  if(!session)return reject(res,page);
  const now=Date.now();if(!session.admin.isActive||!['OWNER','EDITOR','TRAINER'].includes(session.admin.role)||session.expiresAt.getTime()<=now||session.lastUsedAt.getTime()+security.idleTtlMs<=now){await db.adminSession.deleteMany({where:{id:session.id}});return reject(res,page);}
  if(session.lastUsedAt.getTime()+security.touchIntervalMs<=now)await db.adminSession.updateMany({where:{id:session.id},data:{lastUsedAt:new Date(now)}});
  req.auth={admin:session.admin,session:{id:session.id,csrfTokenHash:session.csrfTokenHash,expiresAt:session.expiresAt},csrfToken:csrfForToken(raw)};
  req.user=session.admin;
  if(req.user.role==='TRAINER'&&!req.user.gymId)return res.status(403).json({success:false,message:'Владелец должен назначить вам зал.'});
  let gymId=req.user.role==='TRAINER'?req.user.gymId:null;
  if(req.user.role==='OWNER'){
   const selected=req.get('x-gym-id')||req.cookies.fed_gym;
   if(selected&&selected!=='unassigned'){
    if(typeof selected!=='string'||!await db.gym.findUnique({where:{id:selected}}))return res.status(422).json({success:false,message:'Неизвестный зал.'});
    gymId=selected;
   }
  }
  req.gymId=gymId;
  gymContext.run({gymId,role:req.user.role},next);
 });
 const requireAuth=authenticate(false);requireAuth.page=authenticate(true);return requireAuth;
}
export {createRequireAuth};
