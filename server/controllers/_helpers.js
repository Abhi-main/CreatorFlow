import crypto from "crypto";
import pool from "../config/db.js";

export const ok = (res, data = {}, message = "OK", status = 200) =>
  res.status(status).json({ success: true, data, message });

export const fail = (res, error = "Bad request", code = 400) =>
  res.status(code).json({ success: false, error, code });

export const asyncController = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

export const pageParams = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit || query.pageSize, 10) || 20, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};

export const paged = (rows, total, page, limit) => ({
  data: rows,
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit)
});

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const normalizeTag = (tag) => {
  const clean = String(tag || "").trim().toLowerCase();
  if (!clean) return "";
  return clean.startsWith("#") ? clean : `#${clean}`;
};

export const isoRow = (row) => {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (out[key] instanceof Date) out[key] = out[key].toISOString();
  }
  return out;
};

export const normalizeUtcDateTime = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error("Invalid datetime value");
    err.status = 400;
    throw err;
  }

  const pad = (num) => String(num).padStart(2, "0");
  return [
    parsed.getUTCFullYear(),
    pad(parsed.getUTCMonth() + 1),
    pad(parsed.getUTCDate())
  ].join("-") + ` ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}:${pad(parsed.getUTCSeconds())}`;
};

const formatSqlPartsInTimeZone = (date, timeZone = "UTC") => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

export const normalizeScheduledDateTime = (value, timeZone = "UTC") => {
  if (value === undefined || value === null || value === "") return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return raw.replace("T", " ") + ":00";
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replace("T", " ");
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error("Invalid datetime value");
    err.status = 400;
    throw err;
  }

  return formatSqlPartsInTimeZone(parsed, timeZone || "UTC");
};

export const requireTeam = async (teamId, user) => {
  if (!teamId || Number(teamId) !== Number(user.team_id)) {
    const err = new Error("Team access denied");
    err.status = 403;
    throw err;
  }
};

export const getRoleId = async (roleName) => {
  const [rows] = await pool.query("SELECT role_id FROM Roles WHERE role_name = ? LIMIT 1", [roleName]);
  return rows[0]?.role_id;
};

export const getUserById = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.user_id AS id, u.user_id, u.first_name, u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            u.email, u.timezone, u.avatar_url, u.bio, u.email_verified,
            u.is_active, u.last_login_at, u.created_at,
            r.role_name, t.team_id, t.team_name, t.plan, t.max_members
       FROM Users u
       JOIN Roles r ON r.role_id = u.role_id
       LEFT JOIN Teams t ON t.team_id = u.team_id
      WHERE u.user_id = ?
      LIMIT 1`,
    [userId]
  );
  return rows[0] ? isoRow(rows[0]) : null;
};

export const insertLog = async ({ level = "info", action = "activity", userId = null, message, metadata = {} }) => {
  await pool.query(
    "INSERT INTO Logs (level, action, user_id, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())",
    [level, action, userId, message, JSON.stringify(metadata)]
  );
};

export const insertAdminAction = async ({ adminUserId, action, targetType, targetId, metadata = {} }) => {
  await pool.query(
    "INSERT INTO AdminActions (admin_user_id, action_type, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())",
    [adminUserId, action, targetType, targetId, JSON.stringify(metadata)]
  );
};

export const ensureTeamAccount = async (accountId, teamId) => {
  const [rows] = await pool.query("SELECT account_id FROM SocialAccounts WHERE account_id = ? AND team_id = ? LIMIT 1", [accountId, teamId]);
  if (!rows[0]) {
    const err = new Error("Account not found");
    err.status = 404;
    throw err;
  }
};
