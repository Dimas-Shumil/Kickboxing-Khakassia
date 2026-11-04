import {hashToken,csrfForToken} from '../services/session.service.js';
import {asyncHandler} from '../lib/http.js';
function createRequireAuth(db,security){
 const reject=(res,page)=>{res.clearCookie(security.cookieName,security.cookieOptions);return page?res.redirect(303,'/admin/login'):res.status(401).json({success:false,message:'Требуется авторизация.'});};
 const authenticate=page=>asyncHandler(async(req,res,next)=>{
  const raw=req.cookies?.[security.cookieName];if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))return reject(res,page);
  const session=await db.adminSession.findUnique({where:{tokenHash:hashToken(raw)},include:{admin:{select:{id:true,login:true,name:true,role:true,isActive:true,lastLoginAt:true}}}});
  if(!session)return reject(res,page);
  const now=Date.now();if(!session.admin.isActive||!['OWNER','EDITOR'].includes(session.admin.role)||session.expiresAt.getTime()<=now||session.lastUsedAt.getTime()+security.idleTtlMs<=now){await db.adminSession.deleteMany({where:{id:session.id}});return reject(res,page);}
  if(session.lastUsedAt.getTime()+security.touchIntervalMs<=now)await db.adminSession.updateMany({where:{id:session.id},data:{lastUsedAt:new Date(now)}});
  req.auth={admin:session.admin,session:{id:session.id,csrfTokenHash:session.csrfTokenHash,expiresAt:session.expiresAt},csrfToken:csrfForToken(raw)};
  req.user=session.admin;next();
 });
 const requireAuth=authenticate(false);requireAuth.page=authenticate(true);return requireAuth;
}
export {createRequireAuth};
