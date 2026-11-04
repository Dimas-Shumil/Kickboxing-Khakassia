function requireOwner(req,res,next){if(req.auth?.admin?.role==='OWNER')return next();return res.status(403).json({success:false,message:'Раздел доступен только владельцу.'});}
export default requireOwner;
