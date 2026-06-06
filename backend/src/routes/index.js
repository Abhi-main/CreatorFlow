const express = require("express");
const { sendSuccess } = require("../utils/response");
const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const teamsRoutes = require("./teams.routes");
const accountsRoutes = require("./accounts.routes");
const postsRoutes = require("./posts.routes");
const analyticsRoutes = require("./analytics.routes");
const campaignsRoutes = require("./campaigns.routes");
const hashtagsRoutes = require("./hashtags.routes");
const adminRoutes = require("./admin.routes");
const notificationsRoutes = require("./notifications.routes");
const uploadsRoutes = require("./uploads.routes");

const router = express.Router();

router.get("/health", (_req, res) => {
  sendSuccess(
    res,
    {
      status: "ok",
      timestamp: new Date().toISOString()
    },
    "API is healthy."
  );
});

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/teams", teamsRoutes);
router.use("/accounts", accountsRoutes);
router.use("/", postsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/campaigns", campaignsRoutes);
router.use("/hashtags", hashtagsRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/uploads", uploadsRoutes);

module.exports = router;
