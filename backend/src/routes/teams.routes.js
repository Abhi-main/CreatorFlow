const express = require("express");
const controller = require("../controllers/modules/users.controller");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/:id/members", verifyToken, controller.listTeamMembers);
router.post("/:id/invite", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.inviteTeamMember);
router.delete("/:id/members/:userId", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.removeTeamMember);
router.patch("/:id/members/:userId/role", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.updateTeamMemberRole);

module.exports = router;
