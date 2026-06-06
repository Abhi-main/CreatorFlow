const express = require("express");
const controller = require("../controllers/modules/posts.controller");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/posts", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.createPost);
router.get("/posts", verifyToken, controller.listPosts);
router.get("/posts/:id", verifyToken, controller.getPost);
router.put("/posts/:id", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.updatePost);
router.delete("/posts/:id", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.deletePost);
router.post("/posts/:id/publish-now", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.publishNow);

router.post("/schedules/recurring", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.createRecurringSchedule);
router.get("/schedules/recurring", verifyToken, controller.listRecurringSchedules);
router.delete("/schedules/recurring/:id", verifyToken, requireRole(["admin", "manager", "creator", "superadmin"]), controller.deleteRecurringSchedule);

module.exports = router;
