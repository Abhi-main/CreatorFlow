const express = require("express");
const controller = require("../controllers/modules/campaigns.controller");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, controller.listCampaigns);
router.post("/", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.createCampaign);
router.get("/:id", verifyToken, controller.getCampaign);
router.put("/:id", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.updateCampaign);
router.delete("/:id", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.deleteCampaign);
router.get("/:id/analytics", verifyToken, controller.getCampaignAnalytics);

module.exports = router;
