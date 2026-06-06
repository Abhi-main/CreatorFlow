const express = require("express");
const controller = require("../controllers/modules/admin.controller");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken, requireRole(["admin", "superadmin"]));

router.get("/users", controller.listUsers);
router.patch("/users/:id/status", controller.updateUserStatus);
router.get("/logs", controller.listLogs);
router.post("/reports", controller.createReport);
router.get("/reports", controller.listReports);

module.exports = router;
