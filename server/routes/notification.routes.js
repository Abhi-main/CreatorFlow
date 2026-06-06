import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/notification.controller.js";

const router = Router();

router.get("/", verifyToken, ctrl.listNotifications);
router.patch("/read-all", verifyToken, ctrl.markAllRead);
router.patch("/:id/read", verifyToken, ctrl.markRead);

export default router;
