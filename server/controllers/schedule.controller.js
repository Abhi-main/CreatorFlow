import pool from "../config/db.js";
import { asyncController, fail, ok, normalizeUtcDateTime } from "./_helpers.js";

function nextRunAt({ recurrence_type, time_of_day }) {
  const [hour, minute] = String(time_of_day || "09:00").split(":").map(Number);
  const next = new Date();
  next.setUTCHours(hour || 9, minute || 0, 0, 0);
  if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
  if (recurrence_type === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (recurrence_type === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export const createSchedule = asyncController(async (req, res) => {
  const { post_id, scheduled_at, timezone = "UTC" } = req.body;
  const normalizedScheduledAt = normalizeUtcDateTime(scheduled_at);
  const [[post]] = await pool.query("SELECT post_id FROM Posts WHERE post_id = ? AND team_id = ? LIMIT 1", [post_id, req.user.team_id]);
  if (!post) return fail(res, "Post not found", 404);
  await pool.query("INSERT INTO ScheduledPosts (post_id, scheduled_at, timezone, status, created_at) VALUES (?, ?, ?, 'scheduled', UTC_TIMESTAMP())", [post_id, normalizedScheduledAt, timezone]);
  await pool.query("UPDATE Posts SET status = 'scheduled', scheduled_at = ? WHERE post_id = ?", [normalizedScheduledAt, post_id]);
  return ok(res, {}, "Post scheduled", 201);
});

export const listRecurring = asyncController(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM RecurringSchedules WHERE team_id = ? AND is_active = true ORDER BY created_at DESC", [req.user.team_id]);
  return ok(res, rows, "Recurring schedules fetched");
});

export const createRecurring = asyncController(async (req, res) => {
  let { account_id, recurrence_type, time_of_day, timezone = "UTC", caption = "", post_type = "feed" } = req.body;
  if (!account_id && req.body.post_id) {
    const [[post]] = await pool.query("SELECT account_id, caption, post_type FROM Posts WHERE post_id = ? AND team_id = ? LIMIT 1", [req.body.post_id, req.user.team_id]);
    account_id = post?.account_id;
    caption = caption || post?.caption || "";
    post_type = post_type || post?.post_type || "feed";
  }
  recurrence_type = recurrence_type || req.body.frequency;
  time_of_day = time_of_day || `${String(req.body.hour_of_day ?? 9).padStart(2, "0")}:00`;

  const [[account]] = await pool.query("SELECT account_id FROM SocialAccounts WHERE account_id = ? AND team_id = ? LIMIT 1", [account_id, req.user.team_id]);
  if (!account || !recurrence_type || !time_of_day) return fail(res, "Valid account_id, recurrence_type and time_of_day are required", 400);
  const nextRun = nextRunAt({ recurrence_type, time_of_day });
  const [created] = await pool.query(
    `INSERT INTO RecurringSchedules
       (team_id, account_id, created_by, caption, post_type, recurrence_type, day_of_week, day_of_month, time_of_day, timezone, next_run_at, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, UTC_TIMESTAMP())`,
    [req.user.team_id, account_id, req.user.sub || req.user.id, caption, post_type, recurrence_type, req.body.day_of_week || null, req.body.day_of_month || null, time_of_day, timezone, nextRun]
  );
  return ok(res, { schedule_id: created.insertId, next_run_at: nextRun.toISOString() }, "Recurring schedule created", 201);
});

export const deleteRecurring = asyncController(async (req, res) => {
  await pool.query("UPDATE RecurringSchedules SET is_active = false WHERE schedule_id = ? AND team_id = ?", [req.params.id, req.user.team_id]);
  return ok(res, {}, "Recurring schedule deleted");
});
