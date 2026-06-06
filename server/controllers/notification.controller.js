import pool from "../config/db.js";
import { asyncController, ok } from "./_helpers.js";
import { emitToUser } from "../socket/index.js";
import { EVENTS } from "../socket/events.js";

export const listNotifications = asyncController(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const clauses = ["user_id = ?"];
  const params = [req.user.sub || req.user.id];
  if (req.query.is_read !== undefined) {
    clauses.push("is_read = ?");
    params.push(req.query.is_read === "true" || req.query.is_read === true);
  }
  const [rows] = await pool.query(`SELECT * FROM Notifications WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`, [...params, limit]);
  return ok(res, rows, "Notifications fetched");
});

export const markRead = asyncController(async (req, res) => {
  await pool.query("UPDATE Notifications SET is_read = true WHERE notification_id = ? AND user_id = ?", [req.params.id, req.user.sub || req.user.id]);
  emitToUser(req.io, req.user.sub || req.user.id, EVENTS.NOTIFICATION_READ, {
    notificationId: Number(req.params.id)
  });
  return ok(res, {}, "Notification read");
});

export const markAllRead = asyncController(async (req, res) => {
  await pool.query("UPDATE Notifications SET is_read = true WHERE user_id = ?", [req.user.sub || req.user.id]);
  emitToUser(req.io, req.user.sub || req.user.id, EVENTS.NOTIFICATION_READ_ALL, {});
  return ok(res, {}, "Notifications read");
});
