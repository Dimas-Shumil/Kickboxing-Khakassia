import {Router} from 'express';
import requireCsrf from '../middleware/require-csrf.js';
function createHeartbeatRouter({requireAuth,validateOrigin}){const router=Router();router.post('/',validateOrigin,requireAuth,requireCsrf,(_req,res)=>res.status(204).end());return router;}
export default createHeartbeatRouter;
