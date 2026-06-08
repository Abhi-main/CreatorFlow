import pool from "../config/db.js";
import { asyncController, fail, ok, paged, pageParams } from "./_helpers.js";

const dayNames = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
  Monday: "Monday",
  Tuesday: "Tuesday",
  Wednesday: "Wednesday",
  Thursday: "Thursday",
  Friday: "Friday",
  Saturday: "Saturday",
  Sunday: "Sunday"
};

async function verifyAccount(accountId, teamId) {
  const [[account]] = await pool.query("SELECT account_id FROM SocialAccounts WHERE account_id = ? AND team_id = ? LIMIT 1", [accountId, teamId]);
  return Boolean(account);
}

export const dashboard = asyncController(async (req, res) => {
  const [accounts] = await pool.query("SELECT * FROM vw_AccountDashboard WHERE team_id = ?", [req.user.team_id]);
  const summary = accounts.reduce(
    (acc, item) => ({
      totalPosts: acc.totalPosts + Number(item.total_posts || 0),
      totalReach: acc.totalReach + Number(item.total_reach || item.total_impressions || 0),
      followers: acc.followers + Number(item.follower_count || 0),
      avgEngagementRate: acc.avgEngagementRate + Number(item.avg_engagement_rate || 0)
    }),
    { totalPosts: 0, totalReach: 0, followers: 0, avgEngagementRate: 0 }
  );
  summary.avgEngagementRate = accounts.length ? Number((summary.avgEngagementRate / accounts.length).toFixed(2)) : 0;
  summary.followerCount = summary.followers;

  const [upcomingPosts] = await pool.query(
    `SELECT p.post_id AS id, p.caption, p.scheduled_at AS scheduled_for,
            sa.account_name, sa.account_handle, pl.name AS platform_name, pl.icon AS platform_icon
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
      WHERE p.team_id = ? AND p.status = 'scheduled'
      ORDER BY p.scheduled_at ASC
      LIMIT 5`,
    [req.user.team_id]
  );

  const [recentNotifications] = await pool.query(
    `SELECT notification_id AS id, type, title, body, is_read, created_at
       FROM Notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5`,
    [req.user.user_id]
  );

  const formattedUpcoming = upcomingPosts.map((post) => ({
    ...post,
    title: post.caption,
    account: {
      account_name: post.account_name,
      account_handle: post.account_handle,
      platform: {
        name: post.platform_name,
        slug: String(post.platform_name || "").toLowerCase(),
        icon: post.platform_icon
      }
    }
  }));

  return ok(
    res,
    {
      summary,
      accounts,
      upcomingPosts: formattedUpcoming,
      recentNotifications
    },
    "Dashboard analytics fetched"
  );
});

export const postAnalytics = asyncController(async (req, res) => {
  if (!(await verifyAccount(req.params.accountId, req.user.team_id))) return fail(res, "Account not found", 404);
  const { page, limit, offset } = pageParams(req.query);
  const clauses = ["p.account_id = ?"];
  const params = [req.params.accountId];
  if (req.query.from) { clauses.push("pa.created_at >= ?"); params.push(req.query.from); }
  if (req.query.to) { clauses.push("pa.created_at <= ?"); params.push(req.query.to); }
  const where = clauses.join(" AND ");
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM Posts p
       LEFT JOIN (
         SELECT pa1.*
           FROM PostAnalytics pa1
           JOIN (
             SELECT post_id, MAX(post_analytics_id) AS latest_id
               FROM PostAnalytics
              GROUP BY post_id
           ) latest ON latest.latest_id = pa1.post_analytics_id
       ) pa ON pa.post_id = p.post_id
      WHERE ${where}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT pa.*, p.post_id, p.caption, p.post_type, p.published_at,
            sa.account_name, sa.account_handle, pl.name AS platform_name, pl.icon AS platform_icon
       FROM Posts p
       LEFT JOIN (
         SELECT pa1.*
           FROM PostAnalytics pa1
           JOIN (
             SELECT post_id, MAX(post_analytics_id) AS latest_id
               FROM PostAnalytics
              GROUP BY post_id
           ) latest ON latest.latest_id = pa1.post_analytics_id
       ) pa ON pa.post_id = p.post_id
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
      WHERE ${where}
      ORDER BY pa.engagement_rate DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const items = rows.map((row) => ({
    id: row.post_id,
    post_id: row.post_id,
    caption: row.caption,
    post_type: row.post_type,
    published_at: row.published_at,
    account: {
      account_name: row.account_name,
      account_handle: row.account_handle,
      platform: {
        name: row.platform_name,
        slug: String(row.platform_name || "").toLowerCase(),
        icon: row.platform_icon
      }
    },
    analytics: {
      likes_count: Number(row.likes || 0),
      comments_count: Number(row.comments || 0),
      shares_count: Number(row.shares || 0),
      reach_count: Number(row.reach || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      clicks_count: Number(row.clicks || 0),
      engagement_rate: Number(row.engagement_rate || 0),
      engagement_count: Number(row.likes || 0) + Number(row.comments || 0) + Number(row.shares || 0),
      collected_at: row.created_at
    }
  }));
  return ok(res, items, "Post analytics fetched");
});

export const daily = asyncController(async (req, res) => {
  if (!(await verifyAccount(req.params.accountId, req.user.team_id))) return fail(res, "Account not found", 404);
  const days = parseInt(req.query.days, 10) || 30;
  const [rows] = await pool.query(
    `SELECT *, stat_date AS analytics_date, total_likes AS likes, total_comments AS comments,
            total_shares AS shares, total_reach AS reach_count, total_impressions AS impressions,
            (total_likes + total_comments + total_shares) AS engagement_count
       FROM DailyAnalytics
      WHERE account_id = ? AND stat_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)
      ORDER BY stat_date ASC`,
    [req.params.accountId, days]
  );
  return ok(res, rows, "Daily analytics fetched");
});

export const weekly = asyncController(async (req, res) => {
  if (!(await verifyAccount(req.params.accountId, req.user.team_id))) return fail(res, "Account not found", 404);
  const weeks = parseInt(req.query.weeks, 10) || 12;
  const [rows] = await pool.query("SELECT * FROM WeeklyAnalytics WHERE account_id = ? ORDER BY week_start DESC LIMIT ?", [req.params.accountId, weeks]);
  return ok(res, rows, "Weekly analytics fetched");
});

export const followers = asyncController(async (req, res) => {
  if (!(await verifyAccount(req.params.accountId, req.user.team_id))) return fail(res, "Account not found", 404);
  const days = parseInt(req.query.days, 10) || 30;
  const [rows] = await pool.query(
    "SELECT *, recorded_date AS metric_date, recorded_date AS captured_at FROM FollowersHistory WHERE account_id = ? AND recorded_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY) ORDER BY recorded_date ASC",
    [req.params.accountId, days]
  );
  return ok(res, rows, "Follower history fetched");
});

export const bestTimes = asyncController(async (req, res) => {
  if (!(await verifyAccount(req.params.accountId, req.user.team_id))) return fail(res, "Account not found", 404);
  const [rows] = await pool.query("SELECT * FROM BestPostingTimes WHERE account_id = ? ORDER BY predicted_engagement_rate DESC", [req.params.accountId]);
  const slots = rows.map((row) => ({
    ...row,
    id: row.best_time_id,
    day_of_week: dayNames[row.day_of_week] || row.day_of_week,
    best_hour: Number(row.hour_of_day || 0),
    engagement_score: Number(row.predicted_engagement_rate || 0) * 100,
    predicted_engagement_rate: Number(row.predicted_engagement_rate || 0)
  }));
  const grouped = slots.reduce((acc, row) => {
    const key = row.day_of_week;
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
  slots.grouped = grouped;
  slots.slots = slots;
  return ok(res, slots, "Best times fetched");
});
