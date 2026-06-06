const express = require("express");
const controller = require("../controllers/modules/hashtags.controller");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, controller.listHashtags);
router.post("/", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.createHashtag);
router.put("/:id", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.updateHashtag);
router.delete("/:id", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.deleteHashtag);
router.get("/recommendations/:postId", verifyToken, controller.getRecommendations);
router.get("/:id/analytics", verifyToken, controller.getAnalytics);

module.exports = router;
