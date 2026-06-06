const express = require("express");
const controller = require("../controllers/modules/users.controller");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.get("/me", verifyToken, controller.getMe);
router.put("/me", verifyToken, controller.updateMe);

module.exports = router;
