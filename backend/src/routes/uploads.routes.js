const express = require("express");
const controller = require("../controllers/modules/uploads.controller");
const { verifyToken } = require("../middleware/auth");
const { upload } = require("../config/multer");

const router = express.Router();

router.post("/media", verifyToken, upload.array("files", 10), controller.uploadMedia);

module.exports = router;
