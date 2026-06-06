const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const { demoState, getUserById, sanitizeUser, nextId, createLog } = require("./store");

function listUsers(query) {
  const { page, pageSize } = parsePagination(query);
  return paginate(demoState.users.map(sanitizeUser), page, pageSize);
}

function updateUserStatus(userId, status) {
  const user = getUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  user.status = status;
  createLog({
    source: "admin",
    message: `User ${user.email} status changed to ${status}.`,
    metadata: { userId: user.id }
  });

  return sanitizeUser(user);
}

function listLogs(query) {
  const { page, pageSize } = parsePagination(query);
  let logs = [...demoState.logs];

  if (query.source) {
    logs = logs.filter((item) => item.source === query.source);
  }
  if (query.level) {
    logs = logs.filter((item) => item.level === query.level);
  }

  return paginate(logs, page, pageSize);
}

function createReport(userId, teamId, payload) {
  const report = {
    id: nextId("reports"),
    team_id: Number(teamId),
    user_id: Number(userId),
    report_type: payload.report_type,
    report_name: payload.report_name,
    file_path: `/reports/${Date.now()}-${payload.report_type}.${payload.format || "pdf"}`,
    format: payload.format || "pdf",
    status: "queued",
    generated_at: new Date().toISOString()
  };

  demoState.reports.unshift(report);
  return report;
}

function listReports(teamId, query) {
  const { page, pageSize } = parsePagination(query);
  const reports = demoState.reports.filter((report) => Number(report.team_id) === Number(teamId));
  return paginate(reports, page, pageSize);
}

module.exports = {
  listUsers,
  updateUserStatus,
  listLogs,
  createReport,
  listReports
};
