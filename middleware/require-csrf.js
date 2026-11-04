import {timingSafeEqual} from 'node:crypto';
import {hashToken} from '../services/session.service.js';
function requireCsrf(req,res,next){
 const token=req.get('x-csrf-token'),expected=req.auth?.session?.csrfTokenHash;
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!expected||!timingSafeEqual(Buffer.from(hashToken(token),'hex'),Buffer.from(expected,'hex')))return res.status(403).json({success:false,message:'CSRF-проверка не пройдена. Обновите страницу.'});
 next();
}
export default requireCsrf;
