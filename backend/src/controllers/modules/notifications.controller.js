const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const notificationsService = require("../../services/modules/notifications.service");

exports.listNotifications = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    notificationsService.listNotifications(req.user.sub, req.user.team_id, req.query),
    "Notifications fetched."
  );
});

exports.markAsRead = asyncHandler(async (req, res) => {
  sendSuccess(res, notificationsService.markAsRead(req.user.sub, req.params.id), "Notification updated.");
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  sendSuccess(res, notificationsService.markAllAsRead(req.user.sub, req.user.team_id), "Notifications updated.");
});
