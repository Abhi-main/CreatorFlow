const express = require("express");
const controller = require("../controllers/modules/analytics.controller");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", verifyToken, controller.dashboard);
router.get("/posts/:accountId", verifyToken, controller.posts);
router.get("/daily/:accountId", verifyToken, controller.daily);
router.get("/weekly/:accountId", verifyToken, controller.weekly);
router.get("/followers/:accountId", verifyToken, controller.followers);
router.get("/best-times/:accountId", verifyToken, controller.bestTimes);

module.exports = router;
