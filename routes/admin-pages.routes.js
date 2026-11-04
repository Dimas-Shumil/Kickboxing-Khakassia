import {Router} from 'express';
import path from 'node:path';
import {asyncHandler} from '../lib/http.js';
function createAdminPagesRouter({db,config,requireAuth}){
 const router=Router(),dir=path.join(config.ROOT,'admin-pages');
 const send=(res,file,status=200)=>res.status(status).sendFile(path.join(dir,file+'.html'));
 router.get('/login',(_req,res)=>send(res,'login'));
 router.get('/',requireAuth.page,(_req,res)=>res.redirect(302,'/admin/dashboard'));
 const pages=['dashboard','gym','students','student','payments','payment','news','news-edit','news-preview'];
 for(const page of pages)router.get('/'+page,requireAuth.page,asyncHandler(async(req,res)=>{
  if(['gym','students','student','payments','payment'].includes(page)&&req.user.role!=='OWNER')return send(res,'forbidden',403);
  const model=['student','payment','news-edit','news-preview'].includes(page)?(page.startsWith('news')?'news':page):null;
  if(model&&req.query.id&&req.query.id!=='working'&&(typeof req.query.id!=='string'||!await db[model].findUnique({where:{id:req.query.id},select:{id:true}})))return send(res,'not-found',404);
  return send(res,page);
 }));
 // Старые закладки патчей 08.1/08.2 продолжают работать.
 router.get('/:page.html',(req,res,next)=>pages.includes(req.params.page)?res.redirect(302,'/admin/'+req.params.page+(req.url.includes('?')?'?'+req.url.split('?')[1]:'')):next());
 router.use((_req,res)=>send(res,'not-found',404));return router;
}
export default createAdminPagesRouter;
