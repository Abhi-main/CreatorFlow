const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const adminService = require("../../services/modules/admin.service");

exports.listUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, adminService.listUsers(req.query), "Users fetched.");
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, adminService.updateUserStatus(req.params.id, req.body.status), "User status updated.");
});

exports.listLogs = asyncHandler(async (req, res) => {
  sendSuccess(res, adminService.listLogs(req.query), "Logs fetched.");
});

exports.createReport = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    adminService.createReport(req.user.sub, req.user.team_id, req.body),
    "Report queued.",
    201
  );
});

exports.listReports = asyncHandler(async (req, res) => {
  sendSuccess(res, adminService.listReports(req.user.team_id, req.query), "Reports fetched.");
});
