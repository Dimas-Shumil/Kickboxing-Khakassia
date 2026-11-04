import {Router} from 'express';
import {asyncHandler,newsDTO} from '../lib/http.js';
import * as v from '../lib/validation.js';
import requireCsrf from '../middleware/require-csrf.js';
import {createRecordWriter} from '../services/record.service.js';
function createNewsRouter({db,requireAuth,validateOrigin}){
 const router=Router(),write=createRecordWriter(db);router.use(requireAuth);
 router.get('/',asyncHandler(async(_req,res)=>res.json({success:true,news:(await db.news.findMany({orderBy:{updatedAt:'desc'}})).map(newsDTO)})));
 router.get('/:id',asyncHandler(async(req,res)=>{const news=await db.news.findUnique({where:{id:req.params.id}});if(!news)throw new v.HttpError(404,'Новость не найдена.');res.json({success:true,news:newsDTO(news)});}));
 router.use(validateOrigin,requireCsrf);
 router.post('/',asyncHandler(async(req,res)=>write(req,res,'news','news',v.news(req.body))));
 router.patch('/:id',asyncHandler(async(req,res)=>write(req,res,'news','news',v.news(req.body))));
 return router;
}
export default createNewsRouter;
