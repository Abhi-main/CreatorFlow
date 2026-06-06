import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { asyncController, fail, getUserById, ok } from "./_helpers.js";

export const getMe = asyncController(async (req, res) => {
  const user = await getUserById(req.user.sub || req.user.id);
  return ok(res, user, "User fetched");
});

export const updateMe = asyncController(async (req, res) => {
  const { firstName, lastName, full_name, timezone, avatar_url, bio } = req.body;
  let nextFirst = firstName;
  let nextLast = lastName;

  if ((!nextFirst || !nextLast) && full_name) {
    const parts = full_name.split(" ");
    nextFirst = parts[0];
    nextLast = parts.slice(1).join(" ");
  }

  await pool.query(
    `UPDATE Users
        SET first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            timezone = COALESCE(?, timezone),
            avatar_url = ?,
            bio = COALESCE(?, bio),
            updated_at = UTC_TIMESTAMP()
      WHERE user_id = ?`,
    [nextFirst || null, nextLast || null, timezone || null, avatar_url ?? null, bio || null, req.user.sub || req.user.id]
  );
  const user = await getUserById(req.user.sub || req.user.id);
  return ok(res, user, "Profile updated");
});

export const updatePassword = asyncController(async (req, res) => {
  const { currentPassword, current_password, newPassword, password } = req.body;
  const current = currentPassword || current_password;
  const next = newPassword || password;
  const [[user]] = await pool.query("SELECT password_hash FROM Users WHERE user_id = ? LIMIT 1", [req.user.sub || req.user.id]);
  const valid = user && (await bcrypt.compare(current, user.password_hash));
  if (!valid) return fail(res, "Current password is incorrect", 400);
  if (!next || next.length < 8) return fail(res, "New password must be at least 8 characters", 400);

  const hash = await bcrypt.hash(next, 12);
  await pool.query("UPDATE Users SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?", [hash, req.user.sub || req.user.id]);
  await pool.query("DELETE FROM Sessions WHERE user_id = ?", [req.user.sub || req.user.id]);
  return ok(res, {}, "Password updated");
});

export const deleteMe = asyncController(async (req, res) => {
  await pool.query("UPDATE Users SET is_active = false, updated_at = UTC_TIMESTAMP() WHERE user_id = ?", [req.user.sub || req.user.id]);
  await pool.query("DELETE FROM Sessions WHERE user_id = ?", [req.user.sub || req.user.id]);
  res.clearCookie("refreshToken");
  return ok(res, {}, "Account deleted");
});

export const listSessions = asyncController(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT session_id, ip_address, user_agent, expires_at, created_at
       FROM Sessions WHERE user_id = ? AND expires_at > UTC_TIMESTAMP()
      ORDER BY created_at DESC`,
    [req.user.sub || req.user.id]
  );
  return ok(res, rows, "Sessions fetched");
});

export const deleteSession = asyncController(async (req, res) => {
  await pool.query("DELETE FROM Sessions WHERE session_id = ? AND user_id = ?", [req.params.id, req.user.sub || req.user.id]);
  return ok(res, {}, "Session revoked");
});

export const updateNotifications = asyncController(async (req, res) => {
  await pool.query("UPDATE Users SET notification_preferences = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?", [
    JSON.stringify(req.body || {}),
    req.user.sub || req.user.id
  ]);
  return ok(res, req.body || {}, "Notification preferences saved");
});
