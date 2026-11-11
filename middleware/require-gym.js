import {canGym} from '../services/permissions.js';
export default function(req,res,next){if(canGym(req.user))return next();res.status(403).json({success:false,message:'Учёт зала недоступен.'});}
