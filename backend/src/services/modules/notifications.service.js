const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const { demoState } = require("./store");

function listNotifications(userId, teamId, query) {
  const { page, pageSize } = parsePagination(query);
  const notifications = demoState.notifications.filter(
    (item) => Number(item.user_id || userId) === Number(userId) || Number(item.team_id) === Number(teamId)
  );
  return paginate(notifications, page, pageSize);
}

function markAsRead(userId, notificationId) {
  const notification = demoState.notifications.find(
    (item) => Number(item.id) === Number(notificationId) && Number(item.user_id || userId) === Number(userId)
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  notification.is_read = true;
  return notification;
}

function markAllAsRead(userId, teamId) {
  demoState.notifications.forEach((notification) => {
    if (Number(notification.user_id || userId) === Number(userId) || Number(notification.team_id) === Number(teamId)) {
      notification.is_read = true;
    }
  });

  return { updated: true };
}

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead
};
