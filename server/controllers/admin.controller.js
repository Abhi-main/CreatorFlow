import crypto from "crypto";
import pool from "../config/db.js";
import { sendPasswordReset } from "../services/emailService.js";
import { asyncController, insertAdminAction, insertLog, ok, paged, pageParams, sha256 } from "./_helpers.js";

export const stats = asyncController(async (req, res) => {
  const [[[users]], [[teams]], [[posts]], [[today]], [[accounts]], [[failed]]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS totalUsers FROM Users"),
    pool.query("SELECT COUNT(*) AS activeTeams FROM Teams"),
    pool.query("SELECT COUNT(*) AS totalPosts FROM Posts"),
    pool.query("SELECT COUNT(*) AS postsPublishedToday FROM Posts WHERE status = 'published' AND DATE(published_at) = UTC_DATE()"),
    pool.query("SELECT COUNT(*) AS connectedAccounts FROM SocialAccounts WHERE is_active = true"),
    pool.query("SELECT COUNT(*) AS failedPosts FROM Posts WHERE status = 'failed'")
  ]);
  return ok(res, { ...users, ...teams, ...posts, ...today, ...accounts, ...failed }, "Admin stats fetched");
});

export const registrations = asyncController(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS users
       FROM Users
      WHERE created_at >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
    [days]
  );
  return ok(res, rows, "Registrations fetched");
});

export const postsByPlatform = asyncController(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT DATE(p.created_at) AS date, pf.name AS platform, COUNT(*) AS post_count
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pf ON pf.platform_id = sa.platform_id
      WHERE p.created_at >= DATE_SUB(UTC_DATE(), INTERVAL 7 DAY)
      GROUP BY DATE(p.created_at), pf.platform_id
      ORDER BY date ASC`
  );
  return ok(res, rows, "Posts by platform fetched");
});

export const listUsers = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const clauses = ["1 = 1"];
  const params = [];
  if (req.query.search) { clauses.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)"); params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`); }
  if (req.query.role) { clauses.push("r.role_name = ?"); params.push(req.query.role); }
  if (req.query.status) { clauses.push("u.is_active = ?"); params.push(req.query.status === "active"); }
  const where = clauses.join(" AND ");
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM Users u JOIN Roles r ON r.role_id = u.role_id WHERE ${where}`, params);
  const [rows] = await pool.query(
    `SELECT u.user_id AS id, u.user_id, u.first_name, u.last_name, CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            u.email, u.is_active, IF(u.is_active, 'active', 'banned') AS status, u.last_login_at, u.created_at,
            r.role_name, t.team_name
       FROM Users u
       JOIN Roles r ON r.role_id = u.role_id
       LEFT JOIN Teams t ON t.team_id = u.team_id
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return ok(res, paged(rows, total, page, limit), "Users fetched");
});

export const exportUsers = asyncController(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT CONCAT(u.first_name, ' ', u.last_name) AS name, u.email, r.role_name, IF(u.is_active, 'active', 'banned') AS status
       FROM Users u JOIN Roles r ON r.role_id = u.role_id ORDER BY u.created_at DESC`
  );
  const csv = ["Name,Email,Role,Status", ...rows.map((row) => `"${row.name}","${row.email}","${row.role_name}","${row.status}"`)].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=users.csv");
  return res.send(csv);
});

export const changeUserRole = asyncController(async (req, res) => {
  const [[role]] = await pool.query("SELECT role_id FROM Roles WHERE role_name = ? LIMIT 1", [req.body.role_name || req.body.role]);
  await pool.query("UPDATE Users SET role_id = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?", [role.role_id, req.params.id]);
  await insertAdminAction({ adminUserId: req.user.sub || req.user.id, action: "change_role", targetType: "Users", targetId: req.params.id, metadata: req.body });
  return ok(res, {}, "Role updated");
});

export const updateUserStatus = asyncController(async (req, res) => {
  const active = req.body.status ? req.body.status === "active" : Boolean(req.body.is_active);
  await pool.query("UPDATE Users SET is_active = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?", [active, req.params.id]);
  await insertAdminAction({ adminUserId: req.user.sub || req.user.id, action: active ? "unban_user" : "ban_user", targetType: "Users", targetId: req.params.id });
  return ok(res, {}, "User status updated");
});

export const resetUserPassword = asyncController(async (req, res) => {
  const [[user]] = await pool.query("SELECT email FROM Users WHERE user_id = ? LIMIT 1", [req.params.id]);
  const rawToken = crypto.randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO PasswordResets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR), UTC_TIMESTAMP())",
    [req.params.id, sha256(rawToken)]
  );
  await sendPasswordReset(user.email, `${process.env.FRONTEND_URL}/reset-password/${rawToken}`);
  await insertAdminAction({ adminUserId: req.user.sub || req.user.id, action: "reset_password", targetType: "Users", targetId: req.params.id });
  return ok(res, {}, "Reset email sent");
});

export const deleteUser = asyncController(async (req, res) => {
  await insertAdminAction({ adminUserId: req.user.sub || req.user.id, action: "delete_user", targetType: "Users", targetId: req.params.id });
  await pool.query("DELETE FROM Users WHERE user_id = ?", [req.params.id]);
  return ok(res, {}, "User deleted");
});

export const logs = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const clauses = ["1 = 1"];
  const params = [];
  if (req.query.action) { clauses.push("action = ?"); params.push(req.query.action); }
  if (req.query.userId) { clauses.push("user_id = ?"); params.push(req.query.userId); }
  if (req.query.from) { clauses.push("created_at >= ?"); params.push(req.query.from); }
  if (req.query.to) { clauses.push("created_at <= ?"); params.push(req.query.to); }
  if (req.query.search) { clauses.push("message LIKE ?"); params.push(`%${req.query.search}%`); }
  const where = clauses.join(" AND ");
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM Logs WHERE ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM Logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return ok(res, paged(rows, total, page, limit), "Logs fetched");
});

export const reports = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM Reports");
  const [rows] = await pool.query("SELECT * FROM Reports ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset]);
  return ok(res, paged(rows, total, page, limit), "Reports fetched");
});

export const createReport = asyncController(async (req, res) => {
  const [created] = await pool.query(
    `INSERT INTO Reports (team_id, created_by, report_type, report_name, format, status, date_from, date_to, created_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, UTC_TIMESTAMP())`,
    [req.body.team_id || req.user.team_id, req.user.sub || req.user.id, req.body.report_type, req.body.report_name || `${req.body.report_type} report`, req.body.format || "pdf", req.body.date_from || null, req.body.date_to || null]
  );
  setTimeout(() => {
    pool.query("UPDATE Reports SET status = 'ready', generated_at = UTC_TIMESTAMP(), file_url = ? WHERE report_id = ?", [`/reports/${created.insertId}.${req.body.format || "pdf"}`, created.insertId]).catch(console.error);
  }, 5000);
  return ok(res, { report_id: created.insertId, id: created.insertId, status: "queued" }, "Report queued", 201);
});

export const deleteReport = asyncController(async (req, res) => {
  await pool.query("DELETE FROM Reports WHERE report_id = ?", [req.params.id]);
  return ok(res, {}, "Report deleted");
});

export const flaggedPosts = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const order = req.query.sort === "most_reported" ? "fp.report_count DESC" : req.query.sort === "highest_reach" ? "pa.reach DESC" : "fp.created_at DESC";
  const [rows] = await pool.query(
    `SELECT fp.*, p.caption, p.post_id, p.status, sa.account_handle, pf.name AS platform_name, pa.reach
       FROM FlaggedPosts fp
       JOIN Posts p ON p.post_id = fp.post_id
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pf ON pf.platform_id = sa.platform_id
       LEFT JOIN PostAnalytics pa ON pa.post_id = p.post_id
      WHERE (? IS NULL OR fp.status = ?) AND (? IS NULL OR pf.name = ?)
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [req.query.status || null, req.query.status || null, req.query.platform || null, req.query.platform || null, limit, offset]
  );
  return ok(res, paged(rows, rows.length, page, limit), "Flagged posts fetched");
});

export const moderatePost = asyncController(async (req, res) => {
  const action = req.body.action;
  const status = action === "approve" ? "approved" : action === "remove" ? "removed" : "under_review";
  await pool.query("UPDATE FlaggedPosts SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE post_id = ?", [status, req.user.sub || req.user.id, req.params.id]);
  if (action === "remove") await pool.query("UPDATE Posts SET status = 'cancelled' WHERE post_id = ?", [req.params.id]);
  await insertAdminAction({ adminUserId: req.user.sub || req.user.id, action: "moderate_content", targetType: "Posts", targetId: req.params.id, metadata: { action } });
  await insertLog({ action: "moderate_content", userId: req.user.sub || req.user.id, message: `Moderated post ${req.params.id} as ${status}`, metadata: { action } });
  return ok(res, {}, "Post moderated");
});
