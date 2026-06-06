import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import * as ctrl from "../controllers/admin.controller.js";

const router = Router();

router.use(verifyToken, requireRole(["admin", "superadmin"]));
router.get("/stats", ctrl.stats);
router.get("/stats/registrations", ctrl.registrations);
router.get("/stats/posts-by-platform", ctrl.postsByPlatform);
router.get("/users", ctrl.listUsers);
router.get("/users/export", ctrl.exportUsers);
router.patch("/users/:id/role", ctrl.changeUserRole);
router.patch("/users/:id/status", ctrl.updateUserStatus);
router.post("/users/:id/reset-password", ctrl.resetUserPassword);
router.delete("/users/:id", ctrl.deleteUser);
router.get("/logs", ctrl.logs);
router.get("/reports", ctrl.reports);
router.post("/reports", ctrl.createReport);
router.delete("/reports/:id", ctrl.deleteReport);
router.get("/posts/flagged", ctrl.flaggedPosts);
router.patch("/posts/:id/moderate", ctrl.moderatePost);

export default router;
