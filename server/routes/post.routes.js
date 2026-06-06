import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/post.controller.js";

const router = Router();

router.get("/", verifyToken, ctrl.listPosts);
router.get("/stats", verifyToken, ctrl.stats);
router.get("/calendar", verifyToken, ctrl.getCalendarPosts);
router.get("/:id", verifyToken, ctrl.getPost);
router.post("/", verifyToken, ctrl.createPost);
router.put("/:id", verifyToken, ctrl.updatePost);
router.patch("/:id/reschedule", verifyToken, ctrl.reschedulePost);
router.delete("/:id", verifyToken, ctrl.deletePost);
router.post("/:id/publish-now", verifyToken, ctrl.publishNow);
router.post("/:id/duplicate", verifyToken, ctrl.duplicate);

export default router;
