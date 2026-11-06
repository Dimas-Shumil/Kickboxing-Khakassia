import {Router} from 'express';
import {asyncHandler} from '../lib/http.js';
import {period} from '../lib/validation.js';
import {analyticsOverview,analyticsActivity,parseActivityFilter} from '../services/analytics.service.js';

function createAnalyticsRouter({db,requireAuth}){
 const router=Router();
 router.use(requireAuth);
 router.get('/overview',asyncHandler(async(req,res)=>res.json({success:true,overview:await analyticsOverview(db,req.user.role,period(req.query.month))})));
 router.get('/activity',asyncHandler(async(req,res)=>res.json({success:true,activity:await analyticsActivity(db,req.user.role,parseActivityFilter(req.query,req.user.role))})));
 return router;
}
export default createAnalyticsRouter;
