function createValidateOrigin(config){return(req,res,next)=>{const allowed=new Set(config.origins||[config.origin]);if(!allowed.has(req.get('origin')))return res.status(403).json({success:false,message:'Недопустимый источник запроса.'});next();};}
export {createValidateOrigin};
