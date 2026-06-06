import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import * as ctrl from "../controllers/team.controller.js";

const router = Router();

router.get("/:id", verifyToken, ctrl.getTeam);
router.patch("/:id", verifyToken, ctrl.updateTeam);
router.get("/:id/members", verifyToken, ctrl.listMembers);
router.post("/:id/invite", verifyToken, requireRole(["admin", "superadmin", "manager"]), ctrl.inviteMember);
router.patch("/:id/members/:userId/role", verifyToken, requireRole(["admin", "superadmin", "manager"]), ctrl.updateMemberRole);
router.delete("/:id/members/:userId", verifyToken, requireRole(["admin", "superadmin", "manager"]), ctrl.removeMember);
router.get("/:id/usage", verifyToken, ctrl.getUsage);

export default router;
