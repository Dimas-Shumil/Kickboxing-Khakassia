import {createHash,randomBytes} from 'node:crypto';
function hashToken(value){return createHash('sha256').update(String(value),'utf8').digest('hex');}
// Стабильный CSRF для одной сессии: вкладки не отзывают токены друг друга.
function csrfForToken(rawToken){return hashToken('federation-csrf:'+rawToken);}
function createSessionService(db,security){
 return {
 async createAdminSession({adminId,req}){
  const sessionToken=randomBytes(32).toString('base64url'),csrfToken=csrfForToken(sessionToken),now=new Date();
  const expiresAt=new Date(now.getTime()+security.absoluteTtlMs);
  const session=await db.$transaction(async tx=>{
   await tx.adminSession.deleteMany({where:{OR:[{expiresAt:{lte:now}},{lastUsedAt:{lte:new Date(now.getTime()-security.idleTtlMs)}}]}});
   const overflow=await tx.adminSession.findMany({where:{adminId},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:security.maxSessions-1,select:{id:true}});
   if(overflow.length)await tx.adminSession.deleteMany({where:{id:{in:overflow.map(s=>s.id)}}});
   return tx.adminSession.create({data:{adminId,tokenHash:hashToken(sessionToken),csrfTokenHash:hashToken(csrfToken),expiresAt,lastUsedAt:now,ipAddress:String(req.ip||'').slice(0,64),userAgent:String(req.get('user-agent')||'').slice(0,512)},select:{id:true,expiresAt:true}});
  });return {session,sessionToken,csrfToken};
 },
 async deleteAdminSession(id){await db.adminSession.deleteMany({where:{id}});}
 };
}
export {hashToken,csrfForToken,createSessionService};
