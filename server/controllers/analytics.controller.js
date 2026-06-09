import pool from "../config/db.js";
import { asyncController, fail, ok, paged, pageParams } from "./_helpers.js";
import * as meta from "../services/metaService.js";

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

async function getAccountContext(accountId, teamId) {
  const [[account]] = await pool.query(
    `SELECT sa.account_id, sa.account_handle, sa.access_token, sa.follower_count,
            pl.name AS platform_name
       FROM SocialAccounts sa
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
      WHERE sa.account_id = ? AND sa.team_id = ?
      LIMIT 1`,
    [accountId, teamId]
  );
  return account || null;
}

async function refreshMetaPosts(account) {
  if (!account?.access_token) {
    return;
  }

  const platform = String(account.platform_name || "").toLowerCase();
  if (!["facebook", "instagram"].includes(platform)) {
    return;
  }

  const [posts] = await pool.query(
    `SELECT post_id, platform_post_id
       FROM Posts
      WHERE account_id = ?
        AND status = 'published'
        AND platform_post_id IS NOT NULL
        AND platform_post_id NOT LIKE 'mock_%'
      ORDER BY published_at DESC
      LIMIT 25`,
    [account.account_id]
  );

  for (const post of posts) {
    let analytics = null;

    try {
      analytics = platform === "facebook"
        ? await meta.getFacebookPostAnalytics(post.platform_post_id, account.access_token)
        : await meta.getInstagramMediaAnalytics(post.platform_post_id, account.access_token);
    } catch (error) {
      console.warn(`Meta post analytics refresh failed for post ${post.post_id}:`, error.message);
      analytics = {
        likes: 0,
        comments: 0,
        shares: 0,
        reach: 0,
        impressions: 0,
        clicks: 0,
        engagementRate: 0,
      };
    }

    await pool.query("DELETE FROM PostAnalytics WHERE post_id = ?", [post.post_id]);
    await pool.query(
      `INSERT INTO PostAnalytics
         (post_id, account_id, likes, comments, shares, reach, impressions, clicks, engagement_rate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        post.post_id,
        account.account_id,
        analytics.likes,
        analytics.comments,
        analytics.shares,
        analytics.reach,
        analytics.impressions,
        analytics.clicks,
        analytics.engagementRate,
      ]
    );
  }
}

async function refreshMetaAccountDaily(account) {
  if (!account?.access_token) {
    return;
  }

  const platform = String(account.platform_name || "").toLowerCase();
  if (!["facebook", "instagram"].includes(platform)) {
    return;
  }

  const externalId = String(account.account_handle || "").replace("@", "");
  const previousFollowers = Number(account.follower_count || 0);

  try {
    let followerCount = previousFollowers;
    let followerChange = 0;
    let reach = 0;
    let impressions = 0;
    let engagement = 0;

    if (platform === "facebook") {
      const [profile, insights] = await Promise.all([
        meta.getFacebookPageProfile(externalId, account.access_token).catch(() => null),
        meta.getFacebookInsights(externalId, account.access_token),
      ]);
      const insightMap = Object.fromEntries((insights || []).map((item) => [item.name, item.values?.[0]?.value ?? 0]));
      followerCount = Number(profile?.followers_count || profile?.fan_count || previousFollowers || 0);
      reach = Number(insightMap.page_reach || 0);
      impressions = Number(insightMap.page_impressions || 0);
      engagement = Number(insightMap.page_engaged_users || 0);
      followerChange = Number(insightMap.page_fan_adds || followerCount - previousFollowers || 0);
    } else {
      const [profile, insights] = await Promise.all([
        meta.getInstagramProfile(externalId, account.access_token).catch(() => null),
        meta.getInstagramInsights(externalId, account.access_token),
      ]);
      const insightMap = Object.fromEntries((insights || []).map((item) => [item.name, item.values?.[0]?.value ?? 0]));
      followerCount = Number(profile?.followers_count || previousFollowers || 0);
      reach = Number(insightMap.reach || 0);
      impressions = Number(insightMap.impressions || 0);
      engagement = Number(insightMap.profile_views || 0);
      followerChange = followerCount - previousFollowers;
    }

    const engagementRate = Number(((engagement / Math.max(reach, 1)) * 100).toFixed(2));

    await pool.query(
      "UPDATE SocialAccounts SET follower_count = ?, last_synced_at = UTC_TIMESTAMP() WHERE account_id = ?",
      [followerCount, account.account_id]
    );
    await pool.query(
      `INSERT INTO FollowersHistory (account_id, recorded_date, follower_count, net_change)
       VALUES (?, UTC_DATE(), ?, ?)
       ON DUPLICATE KEY UPDATE follower_count = VALUES(follower_count), net_change = VALUES(net_change)`,
      [account.account_id, followerCount, followerChange]
    );
    await pool.query(
      `INSERT INTO DailyAnalytics
         (account_id, stat_date, total_posts, total_likes, total_comments, total_shares,
          total_reach, total_impressions, follower_count, follower_change, avg_engagement_rate)
       VALUES (?, UTC_DATE(), 0, 0, 0, 0, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_reach = VALUES(total_reach),
         total_impressions = VALUES(total_impressions),
         follower_count = VALUES(follower_count),
         follower_change = VALUES(follower_change),
         avg_engagement_rate = VALUES(avg_engagement_rate)`,
      [account.account_id, reach, impressions, followerCount, followerChange, engagementRate]
    );
  } catch (error) {
    console.warn(`Meta account daily refresh failed for account ${account.account_id}:`, error.message);
  }
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
  const account = await getAccountContext(req.params.accountId, req.user.team_id);
  await refreshMetaPosts(account);
  const { limit, offset } = pageParams(req.query);
  const clauses = ["p.account_id = ?", "p.status = 'published'"];
  const params = [req.params.accountId];
  const platform = String(account?.platform_name || "").toLowerCase();

  if (["facebook", "instagram"].includes(platform)) {
    clauses.push("p.platform_post_id IS NOT NULL");
    clauses.push("p.platform_post_id NOT LIKE 'mock_%'");
  }

  if (req.query.from) {
    clauses.push("p.published_at >= CONCAT(?, ' 00:00:00')");
    params.push(req.query.from);
  }
  if (req.query.to) {
    clauses.push("p.published_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(req.query.to);
  }
  const where = clauses.join(" AND ");
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM Posts p
       LEFT JOIN (
         SELECT pa1.*
           FROM PostAnalytics pa1
           JOIN (
             SELECT post_id, MAX(analytics_id) AS latest_id
               FROM PostAnalytics
              GROUP BY post_id
           ) latest ON latest.latest_id = pa1.analytics_id
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
             SELECT post_id, MAX(analytics_id) AS latest_id
               FROM PostAnalytics
              GROUP BY post_id
           ) latest ON latest.latest_id = pa1.analytics_id
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
  const clauses = ["account_id = ?"];
  const params = [req.params.accountId];
  const startDate = req.query.startDate || req.query.from || null;
  const endDate = req.query.endDate || req.query.to || null;

  if (startDate) {
    clauses.push("stat_date >= ?");
    params.push(startDate);
  }

  if (endDate) {
    clauses.push("stat_date <= ?");
    params.push(endDate);
  }

  if (!startDate && !endDate) {
    const days = parseInt(req.query.days, 10) || 30;
    clauses.push("stat_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)");
    params.push(days);
  }

  const [rows] = await pool.query(
    `SELECT *, stat_date AS analytics_date, total_likes AS likes, total_comments AS comments,
            total_shares AS shares, total_reach AS reach_count, total_impressions AS impressions,
            avg_engagement_rate AS engagement_rate,
            (total_likes + total_comments + total_shares) AS engagement_count
       FROM DailyAnalytics
      WHERE ${clauses.join(" AND ")}
      ORDER BY stat_date ASC`,
    params
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
  const account = await getAccountContext(req.params.accountId, req.user.team_id);
  await refreshMetaAccountDaily(account);
  const clauses = ["account_id = ?"];
  const params = [req.params.accountId];
  const startDate = req.query.startDate || req.query.from || null;
  const endDate = req.query.endDate || req.query.to || null;

  if (startDate) {
    clauses.push("recorded_date >= ?");
    params.push(startDate);
  }

  if (endDate) {
    clauses.push("recorded_date <= ?");
    params.push(endDate);
  }

  if (!startDate && !endDate) {
    const days = parseInt(req.query.days, 10) || 30;
    clauses.push("recorded_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)");
    params.push(days);
  }

  const [rows] = await pool.query(
    `SELECT *, recorded_date AS metric_date, recorded_date AS captured_at
       FROM FollowersHistory
      WHERE ${clauses.join(" AND ")}
      ORDER BY recorded_date ASC`,
    params
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
