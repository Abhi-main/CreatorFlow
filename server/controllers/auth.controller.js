import bcrypt from "bcrypt";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../config/jwt.js";
import { sendPasswordReset, sendWelcome } from "../services/emailService.js";
import { asyncController, fail, getRoleId, getUserById, ok, sha256 } from "./_helpers.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function publicUser(user) {
  return {
    id: user.user_id || user.id,
    name: user.name || user.full_name,
    full_name: user.full_name || user.name,
    email: user.email,
    role: user.role_name,
    role_name: user.role_name,
    team_id: user.team_id,
    timezone: user.timezone,
    avatar_url: user.avatar_url
  };
}

async function createSession(req, res, user) {
  const payload = {
    sub: user.user_id || user.id,
    id: user.user_id || user.id,
    email: user.email,
    role_name: user.role_name,
    team_id: user.team_id
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ ...payload, jti: uuidv4() });
  await pool.query(
    `INSERT INTO Sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY), UTC_TIMESTAMP())`,
    [payload.sub, sha256(refreshToken), req.ip, req.headers["user-agent"] || ""]
  );
  res.cookie("refreshToken", refreshToken, cookieOptions);
  return { accessToken, refreshToken };
}

export const register = asyncController(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password || password.length < 8) {
    return fail(res, "firstName, lastName, email, and password (8+ chars) are required", 400);
  }

  const [[existing]] = await pool.query("SELECT user_id FROM Users WHERE email = ? LIMIT 1", [email]);
  if (existing) return fail(res, "Email already registered", 409);

  const roleId = await getRoleId("manager");
  const passwordHash = await bcrypt.hash(password, 12);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [userResult] = await conn.query(
      `INSERT INTO Users (role_id, first_name, last_name, email, password_hash, timezone, email_verified, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, false, true, UTC_TIMESTAMP())`,
      [roleId, firstName, lastName, email, passwordHash, req.body.timezone || "UTC"]
    );
    const userId = userResult.insertId;
    const [teamResult] = await conn.query(
      "INSERT INTO Teams (owner_id, team_name, plan, max_members, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
      [userId, `${firstName}'s Team`, "starter", 5]
    );
    await conn.query("UPDATE Users SET team_id = ? WHERE user_id = ?", [teamResult.insertId, userId]);
    await conn.query(
      "INSERT INTO TeamMembers (team_id, user_id, role_id, joined_at, status) VALUES (?, ?, ?, UTC_TIMESTAMP(), 'active')",
      [teamResult.insertId, userId, roleId]
    );
    await conn.commit();
    await sendWelcome(email, firstName);

    const user = await getUserById(userId);
    const { accessToken } = await createSession(req, res, user);
    return ok(res, { user: publicUser(user), accessToken }, "Registered", 201);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

export const login = asyncController(async (req, res) => {
  const { email, password } = req.body;
  const [[row]] = await pool.query(
    `SELECT u.user_id, u.password_hash, u.is_active, r.role_name, u.team_id, u.email
       FROM Users u JOIN Roles r ON r.role_id = u.role_id
      WHERE u.email = ? LIMIT 1`,
    [email]
  );
  if (!row || !row.is_active) return fail(res, "Invalid email or password", 401);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return fail(res, "Invalid email or password", 401);

  await pool.query("UPDATE Users SET last_login_at = UTC_TIMESTAMP() WHERE user_id = ?", [row.user_id]);
  const user = await getUserById(row.user_id);
  const { accessToken } = await createSession(req, res, user);
  return ok(res, { user: publicUser(user), accessToken }, "Logged in");
});

export const refresh = asyncController(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return fail(res, "No refresh token", 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return fail(res, "Invalid refresh token", 401);
  }

  const tokenHash = sha256(token);
  const [[session]] = await pool.query(
    "SELECT session_id, user_id FROM Sessions WHERE refresh_token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1",
    [tokenHash]
  );
  if (!session) return fail(res, "Refresh token expired", 401);

  await pool.query("DELETE FROM Sessions WHERE session_id = ?", [session.session_id]);
  const user = await getUserById(decoded.sub || session.user_id);
  const { accessToken } = await createSession(req, res, user);
  return ok(res, { user: publicUser(user), accessToken }, "Token refreshed");
});

export const logout = asyncController(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await pool.query("DELETE FROM Sessions WHERE refresh_token_hash = ?", [sha256(token)]);
  res.clearCookie("refreshToken", cookieOptions);
  return ok(res, {}, "Logged out");
});

export const forgotPassword = asyncController(async (req, res) => {
  const { email } = req.body;
  const [[user]] = await pool.query("SELECT user_id, first_name FROM Users WHERE email = ? LIMIT 1", [email]);
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO PasswordResets (user_id, token_hash, expires_at, used_at, created_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR), NULL, UTC_TIMESTAMP())`,
      [user.user_id, sha256(rawToken)]
    );
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;
    await sendPasswordReset(email, resetUrl);
  }
  return ok(res, {}, "If that email exists, a reset link has been sent");
});

export const resetPassword = asyncController(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8) return fail(res, "Password must be at least 8 characters", 400);

  const [[reset]] = await pool.query(
    `SELECT reset_id, user_id FROM PasswordResets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
      LIMIT 1`,
    [sha256(token)]
  );
  if (!reset) return fail(res, "Invalid or expired reset token", 400);

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query("UPDATE Users SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?", [passwordHash, reset.user_id]);
  await pool.query("UPDATE PasswordResets SET used_at = UTC_TIMESTAMP() WHERE reset_id = ?", [reset.reset_id]);
  await pool.query("DELETE FROM Sessions WHERE user_id = ?", [reset.user_id]);
  return ok(res, {}, "Password updated");
});
