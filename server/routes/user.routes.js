import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/user.controller.js";

const router = Router();

router.get("/me", verifyToken, ctrl.getMe);
router.put("/me", verifyToken, ctrl.updateMe);
router.delete("/me", verifyToken, ctrl.deleteMe);
router.put("/me/notifications", verifyToken, ctrl.updateNotifications);

export default router;
