const express = require("express");
const controller = require("../controllers/modules/notifications.controller");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, controller.listNotifications);
router.patch("/:id/read", verifyToken, controller.markAsRead);
router.patch("/read-all", verifyToken, controller.markAllAsRead);

module.exports = router;
