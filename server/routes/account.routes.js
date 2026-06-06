import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/account.controller.js";

const router = Router();

router.get("/", verifyToken, ctrl.listAccounts);
router.post("/", verifyToken, ctrl.createAccount);
router.delete("/:id", verifyToken, ctrl.deleteAccount);
router.post("/:id/sync", verifyToken, ctrl.sync);

export default router;
