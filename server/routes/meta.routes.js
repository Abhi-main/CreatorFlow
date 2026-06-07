import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as ctrl from '../controllers/meta.controller.js';

const router = Router();

router.get('/facebook/callback', ctrl.facebookCallback);
router.get('/instagram/callback', ctrl.instagramCallback);

router.get('/facebook/connect', verifyToken, ctrl.connectFacebook);
router.get('/instagram/connect', verifyToken, ctrl.connectInstagram);

router.post('/facebook/publish/:postId', verifyToken, ctrl.publishToFacebook);
router.post('/instagram/publish/:postId', verifyToken, ctrl.publishToInstagram);

router.get('/facebook/insights/:accountId', verifyToken, ctrl.getFacebookAccountInsights);
router.get('/instagram/insights/:accountId', verifyToken, ctrl.getInstagramAccountInsights);

router.post('/sync/:accountId', verifyToken, ctrl.syncMetaAccount);

export default router;
