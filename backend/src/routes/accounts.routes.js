const express = require("express");
const controller = require("../controllers/modules/accounts.controller");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, controller.listAccounts);
router.post("/", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.createAccount);
router.delete("/:id", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.deleteAccount);
router.post("/:id/sync", verifyToken, requireRole(["admin", "manager", "superadmin"]), controller.syncAccount);

module.exports = router;
