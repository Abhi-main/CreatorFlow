import { Router } from "express";
import { body } from "express-validator";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as ctrl from "../controllers/auth.controller.js";
import { updatePassword, listSessions, deleteSession } from "../controllers/user.controller.js";

const router = Router();

router.post("/register", body("email").isEmail(), body("password").isLength({ min: 8 }), validate, ctrl.register);
router.post("/login", body("email").isEmail(), validate, ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/logout", ctrl.logout);
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password/:token", ctrl.resetPassword);
router.put("/password", verifyToken, updatePassword);
router.get("/sessions", verifyToken, listSessions);
router.delete("/sessions/:id", verifyToken, deleteSession);

export default router;
