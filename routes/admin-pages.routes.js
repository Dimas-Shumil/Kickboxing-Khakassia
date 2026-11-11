import {Router} from 'express';
import path from 'node:path';
import {asyncHandler} from '../lib/http.js';
function createAdminPagesRouter({db,config,requireAuth}){
 const router=Router(),dir=path.join(config.ROOT,'admin-pages');
 const send=(res,file,status=200)=>res.status(status).sendFile(path.join(dir,file+'.html'));
 router.get('/login',(_req,res)=>send(res,'login'));
 router.get('/',requireAuth.page,(_req,res)=>res.redirect(302,'/admin/dashboard'));
 const pages=['finances','access','dashboard','activity','gym','groups','group','trainings','training','attendance','students','student','payments','payment','news','news-edit','news-preview','people','person-edit','competitions','competition-edit','history','history-edit','site-pages','site-page-edit','site-documents','site-document-edit','site-media'];
 for(const page of pages)router.get('/'+page,requireAuth.page,asyncHandler(async(req,res)=>{
  if(page==='access'&&req.user.role!=='OWNER')return send(res,'forbidden',403);
  if(['finances','gym','groups','group','trainings','training','attendance','students','student','payments','payment'].includes(page)&&!['OWNER','TRAINER'].includes(req.user.role))return send(res,'forbidden',403);
  if(page==='site-page-edit'&&!['home','federation','contacts'].includes(req.query.key))return send(res,'not-found',404);
  if(page==='news-preview'&&(!req.query.id||req.query.id==='working'))return send(res,'not-found',404);
  if(['person-edit','competition-edit','history-edit','site-document-edit'].includes(page)&&Object.hasOwn(req.query,'id')&&(typeof req.query.id!=='string'||!req.query.id))return send(res,'not-found',404);
  if(['group','training','attendance'].includes(page)&&req.query.id&&(typeof req.query.id!=='string'||!await db[page==='group'?'trainingGroup':'gymSession'].findUnique({where:{id:req.query.id},select:{id:true}})))return send(res,'not-found',404);
  if(page==='attendance'&&!req.query.id)return send(res,'not-found',404);
  const model=['student','payment','news-edit','news-preview','person-edit','competition-edit','history-edit','site-document-edit'].includes(page)?(page==='site-document-edit'?'federationDocument':page==='history-edit'?'historyMaterial':page==='competition-edit'?'competition':page==='person-edit'?'person':page.startsWith('news')?'news':page):null;
  if(model&&req.query.id&&(typeof req.query.id!=='string'||!await db[model].findUnique({where:{id:req.query.id},select:{id:true}})))return send(res,'not-found',404);
  return send(res,page);
 }));
 // Старые закладки патчей 08.1/08.2 продолжают работать.
 router.get('/:page.html',(req,res,next)=>pages.includes(req.params.page)?res.redirect(302,'/admin/'+req.params.page+(req.url.includes('?')?'?'+req.url.split('?')[1]:'')):next());
 router.use((_req,res)=>send(res,'not-found',404));return router;
}
export default createAdminPagesRouter;
