import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/analytics.controller.js";

const router = Router();

router.get("/dashboard", verifyToken, ctrl.dashboard);
router.get("/posts/:accountId", verifyToken, ctrl.postAnalytics);
router.get("/daily/:accountId", verifyToken, ctrl.daily);
router.get("/weekly/:accountId", verifyToken, ctrl.weekly);
router.get("/followers/:accountId", verifyToken, ctrl.followers);
router.get("/best-times/:accountId", verifyToken, ctrl.bestTimes);

export default router;
