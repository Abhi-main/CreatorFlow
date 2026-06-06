const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const analyticsService = require("../../services/modules/analytics.service");

exports.dashboard = asyncHandler(async (req, res) => {
  sendSuccess(res, analyticsService.getDashboard(req.user.team_id), "Dashboard analytics fetched.");
});

exports.posts = asyncHandler(async (req, res) => {
  sendSuccess(res, analyticsService.getPostAnalytics(req.user.team_id, req.params.accountId), "Post analytics fetched.");
});

exports.daily = asyncHandler(async (req, res) => {
  sendSuccess(res, analyticsService.getDailyAnalytics(req.user.team_id, req.params.accountId, req.query), "Daily analytics fetched.");
});

exports.weekly = asyncHandler(async (req, res) => {
  sendSuccess(res, analyticsService.getWeeklyAnalytics(req.user.team_id, req.params.accountId), "Weekly analytics fetched.");
});

exports.followers = asyncHandler(async (req, res) => {
  sendSuccess(res, analyticsService.getFollowerHistory(req.user.team_id, req.params.accountId), "Follower history fetched.");
});

exports.bestTimes = asyncHandler(async (req, res) => {
  sendSuccess(res, analyticsService.getBestTimes(req.user.team_id, req.params.accountId), "Best posting times fetched.");
});
