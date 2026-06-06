import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/hashtag.controller.js";

const router = Router();

router.get("/", verifyToken, ctrl.listHashtags);
router.get("/stats", verifyToken, ctrl.stats);
router.post("/ai/content-ideas", verifyToken, ctrl.generateContentIdeasCtrl);
router.get("/ai/post-sentiment/:postId", verifyToken, ctrl.analyzePostSentimentCtrl);
router.get("/ai/campaign-strategy/:campaignId", verifyToken, ctrl.getCampaignStrategyCtrl);
router.post("/captions/suggestions", verifyToken, ctrl.suggestCaptionsCtrl);
router.get("/recommendations/:postId", verifyToken, ctrl.recommendations);
router.get("/:id/analytics", verifyToken, ctrl.analytics);
router.post("/", verifyToken, ctrl.createHashtags);
router.put("/:id", verifyToken, ctrl.updateHashtag);
router.delete("/:id", verifyToken, ctrl.deleteHashtag);

export default router;
