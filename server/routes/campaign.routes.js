import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/campaign.controller.js";

const router = Router();

router.get("/", verifyToken, ctrl.listCampaigns);
router.get("/stats", verifyToken, ctrl.stats);
router.get("/:id", verifyToken, ctrl.getCampaign);
router.get("/:id/analytics", verifyToken, ctrl.analytics);
router.post("/", verifyToken, ctrl.createCampaign);
router.put("/:id", verifyToken, ctrl.updateCampaign);
router.delete("/:id", verifyToken, ctrl.deleteCampaign);

export default router;
