import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as ctrl from "../controllers/schedule.controller.js";

const router = Router();

router.post("/", verifyToken, ctrl.createSchedule);
router.get("/recurring", verifyToken, ctrl.listRecurring);
router.post("/recurring", verifyToken, ctrl.createRecurring);
router.delete("/recurring/:id", verifyToken, ctrl.deleteRecurring);

export default router;
