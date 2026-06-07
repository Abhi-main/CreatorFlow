import pool from "../config/db.js";
import { fetchPostAnalytics, publishPost } from "../services/platformSync.js";
import * as meta from "../services/metaService.js";
import { asyncController, fail, ok, paged, pageParams } from "./_helpers.js";
import { emitToTeam } from "../socket/index.js";
import { EVENTS } from "../socket/events.js";

async function getPostOwner(postId, teamId) {
  const [[post]] = await pool.query("SELECT post_id, status, team_id FROM Posts WHERE post_id = ? AND team_id = ? LIMIT 1", [postId, teamId]);
  return post;
}

function statusBody(body) {
  return body.status || body.publish_status || "draft";
}

function absoluteMediaUrl(req, filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const explicitBase = process.env.BACKEND_PUBLIC_URL;
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = explicitBase
    ? null
    : (forwardedProto ? forwardedProto.split(",")[0].trim() : req.protocol);
  const base = explicitBase || `${protocol}://${req.get("host")}`;
  return new URL(filePath, base).toString();
}

export const listPosts = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const clauses = ["p.team_id = ?"];
  const params = [req.user.team_id];
  if (req.query.status) { clauses.push("p.status = ?"); params.push(req.query.status); }
  if (req.query.platform || req.query.platform_id) { clauses.push("sa.platform_id = ?"); params.push(req.query.platform || req.query.platform_id); }
  if (req.query.account || req.query.account_id) { clauses.push("p.account_id = ?"); params.push(req.query.account || req.query.account_id); }
  if (req.query.userId) { clauses.push("p.created_by = ?"); params.push(req.query.userId); }
  if (req.query.search) { clauses.push("p.caption LIKE ?"); params.push(`%${req.query.search}%`); }
  if (req.query.from) { clauses.push("COALESCE(p.published_at, p.created_at) >= ?"); params.push(req.query.from); }
  if (req.query.to) { clauses.push("COALESCE(p.published_at, p.created_at) <= ?"); params.push(req.query.to); }
  const where = clauses.join(" AND ");
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM Posts p JOIN SocialAccounts sa ON sa.account_id = p.account_id WHERE ${where}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT p.*, p.post_id AS id, p.status AS publish_status,
            sa.account_handle, sa.account_name, pf.name AS platform_name,
            pa.likes, pa.comments, pa.shares, pa.reach, pa.impressions, pa.engagement_rate
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pf ON pf.platform_id = sa.platform_id
       LEFT JOIN PostAnalytics pa ON pa.post_id = p.post_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return ok(res, paged(rows, total, page, limit), "Posts fetched");
});

export const stats = asyncController(async (req, res) => {
  const [rows] = await pool.query("SELECT status, COUNT(*) AS count FROM Posts WHERE team_id = ? GROUP BY status", [req.user.team_id]);
  return ok(res, rows, "Post stats fetched");
});

export const getCalendarPosts = asyncController(async (req, res) => {
  const { accountId, from, to, platform } = req.query;
  const clauses = ["p.team_id = ?", "p.status != 'cancelled'"];
  const params = [req.user.team_id];

  if (accountId) {
    clauses.push("p.account_id = ?");
    params.push(accountId);
  }

  if (platform) {
    clauses.push("pf.name = ?");
    params.push(platform);
  }

  if (from && to) {
    clauses.push(`(
      COALESCE(sp.scheduled_at, p.scheduled_at) BETWEEN ? AND ?
      OR p.published_at BETWEEN ? AND ?
      OR p.status = 'draft'
    )`);
    params.push(from, to, from, to);
  }

  const [posts] = await pool.query(
    `SELECT
       p.post_id,
       p.caption,
       p.post_type,
       p.status,
       p.published_at,
       p.scheduled_at AS post_scheduled_at,
       COALESCE(sp.scheduled_at, p.scheduled_at) AS scheduled_at,
       sa.account_handle,
       sa.account_name,
       sa.account_id,
       pf.name AS platform,
       pf.platform_id,
       c.campaign_name,
       c.campaign_id,
       GROUP_CONCAT(mf.public_url ORDER BY pm.sort_order SEPARATOR ',') AS media_urls
     FROM Posts p
     JOIN SocialAccounts sa ON sa.account_id = p.account_id
     JOIN Platforms pf ON pf.platform_id = sa.platform_id
     LEFT JOIN ScheduledPosts sp ON sp.post_id = p.post_id
     LEFT JOIN Campaigns c ON c.campaign_id = p.campaign_id
     LEFT JOIN PostMedia pm ON pm.post_id = p.post_id
     LEFT JOIN MediaFiles mf ON mf.media_id = pm.media_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY p.post_id
     ORDER BY COALESCE(sp.scheduled_at, p.scheduled_at, p.published_at, p.created_at) ASC`,
    params
  );

  const events = posts.map((post) => {
    const start = post.scheduled_at || post.published_at || null;
    const platformColor =
      post.platform === "Instagram" ? "#E1306C" :
      post.platform === "Facebook" ? "#1877F2" :
      post.platform === "LinkedIn" ? "#0A66C2" :
      "#F5A623";

    return {
      id: String(post.post_id),
      title: post.caption?.slice(0, 50) || `${post.post_type || "feed"} post`,
      start,
      allDay: false,
      backgroundColor: platformColor,
      borderColor: "transparent",
      textColor: "#ffffff",
      display: post.status === "draft" && !start ? "list-item" : "block",
      extendedProps: {
        post_id: post.post_id,
        caption: post.caption,
        post_type: post.post_type,
        status: post.status,
        platform: post.platform,
        platform_id: post.platform_id,
        account_handle: post.account_handle,
        account_name: post.account_name,
        account_id: post.account_id,
        campaign_name: post.campaign_name,
        campaign_id: post.campaign_id,
        media_urls: post.media_urls ? post.media_urls.split(",") : [],
        scheduled_at: post.scheduled_at,
        published_at: post.published_at
      }
    };
  });

  return res.json({ success: true, data: events, total: events.length });
});

export const getPost = asyncController(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, sa.account_handle, pf.name AS platform_name
       FROM Posts p JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pf ON pf.platform_id = sa.platform_id
      WHERE p.post_id = ? AND p.team_id = ? LIMIT 1`,
    [req.params.id, req.user.team_id]
  );
  if (!rows[0]) return fail(res, "Post not found", 404);
  const [media] = await pool.query("SELECT mf.* FROM PostMedia pm JOIN MediaFiles mf ON mf.media_id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order", [req.params.id]);
  const [hashtags] = await pool.query("SELECT h.* FROM PostHashtags ph JOIN Hashtags h ON h.hashtag_id = ph.hashtag_id WHERE ph.post_id = ?", [req.params.id]);
  const [analytics] = await pool.query("SELECT * FROM PostAnalytics WHERE post_id = ? ORDER BY created_at DESC LIMIT 1", [req.params.id]);
  const [schedule] = await pool.query("SELECT * FROM ScheduledPosts WHERE post_id = ? ORDER BY scheduled_at DESC LIMIT 1", [req.params.id]);
  return ok(res, { ...rows[0], media, hashtags, analytics: analytics[0] || null, schedule: schedule[0] || null }, "Post fetched");
});

export const createPost = asyncController(async (req, res) => {
  const accountId = req.body.account_id || req.body.social_account_id;
  const caption = req.body.caption;
  const postType = req.body.post_type || req.body.content_type || "feed";
  const status = statusBody(req.body);
  if (!accountId || !caption) return fail(res, "account_id and caption are required", 400);

  const [[account]] = await pool.query("SELECT account_id FROM SocialAccounts WHERE account_id = ? AND team_id = ? LIMIT 1", [accountId, req.user.team_id]);
  if (!account) return fail(res, "Account not found", 404);

  if (req.body.campaign_id) {
    const [[campaign]] = await pool.query("SELECT campaign_id FROM Campaigns WHERE campaign_id = ? AND team_id = ? LIMIT 1", [req.body.campaign_id, req.user.team_id]);
    if (!campaign) return fail(res, "Campaign not found", 404);
  }

  const [created] = await pool.query(
    `INSERT INTO Posts (team_id, account_id, campaign_id, created_by, caption, post_type, status, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [req.user.team_id, accountId, req.body.campaign_id || null, req.user.sub || req.user.id, caption, postType, status, req.body.scheduled_at || req.body.scheduled_for || null]
  );
  await replacePostLinks(created.insertId, req.body.media_ids || [], req.body.hashtag_ids || []);
  const newPost = { post_id: created.insertId, id: created.insertId, ...req.body, status };
  emitToTeam(req.io, req.user.team_id, EVENTS.POST_CREATED, {
    post: newPost,
    createdBy: req.user.user_id || req.user.sub || req.user.id
  });
  if (status === "scheduled") {
    emitToTeam(req.io, req.user.team_id, EVENTS.POST_SCHEDULED, {
      post: newPost,
      scheduledAt: req.body.scheduled_at || req.body.scheduled_for || null
    });
  }
  return ok(res, newPost, "Post created", 201);
});

async function replacePostLinks(postId, mediaIds, hashtagIds) {
  await pool.query("DELETE FROM PostMedia WHERE post_id = ?", [postId]);
  for (let i = 0; i < mediaIds.length; i += 1) {
    await pool.query("INSERT INTO PostMedia (post_id, media_id, sort_order) VALUES (?, ?, ?)", [postId, mediaIds[i], i + 1]);
  }
  await pool.query("DELETE FROM PostHashtags WHERE post_id = ?", [postId]);
  for (const hashtagId of hashtagIds) {
    await pool.query("INSERT IGNORE INTO PostHashtags (post_id, hashtag_id) VALUES (?, ?)", [postId, hashtagId]);
  }
}

export const updatePost = asyncController(async (req, res) => {
  const post = await getPostOwner(req.params.id, req.user.team_id);
  if (!post) return fail(res, "Post not found", 404);
  if (!["draft", "scheduled"].includes(post.status)) return fail(res, "Only draft or scheduled posts can be updated", 400);
  await pool.query(
    `UPDATE Posts SET caption = COALESCE(?, caption), post_type = COALESCE(?, post_type),
            campaign_id = COALESCE(?, campaign_id), scheduled_at = COALESCE(?, scheduled_at),
            status = COALESCE(?, status), updated_at = UTC_TIMESTAMP()
      WHERE post_id = ? AND team_id = ?`,
    [req.body.caption || null, req.body.post_type || null, req.body.campaign_id || null, req.body.scheduled_at || null, req.body.status || null, req.params.id, req.user.team_id]
  );
  if (req.body.media_ids || req.body.hashtag_ids) await replacePostLinks(req.params.id, req.body.media_ids || [], req.body.hashtag_ids || []);
  emitToTeam(req.io, req.user.team_id, EVENTS.POST_UPDATED, {
    postId: Number(req.params.id),
    changes: req.body,
    updatedBy: req.user.user_id || req.user.sub || req.user.id
  });
  return ok(res, { updated: true }, "Post updated");
});

export const deletePost = asyncController(async (req, res) => {
  const post = await getPostOwner(req.params.id, req.user.team_id);
  if (!post) return fail(res, "Post not found", 404);
  await pool.query("DELETE FROM Posts WHERE post_id = ? AND team_id = ?", [req.params.id, req.user.team_id]);
  emitToTeam(req.io, req.user.team_id, EVENTS.POST_DELETED, {
    postId: Number(req.params.id),
    deletedBy: req.user.user_id || req.user.sub || req.user.id
  });
  return ok(res, {}, "Post deleted");
});

export const publishNow = asyncController(async (req, res) => {
  const [[post]] = await pool.query(
    `SELECT p.*, sa.account_handle, sa.access_token, pf.name AS platform_name
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pf ON pf.platform_id = sa.platform_id
      WHERE p.post_id = ? AND p.team_id = ? LIMIT 1`,
    [req.params.id, req.user.team_id]
  );
  if (!post) return fail(res, "Post not found", 404);

  const [media] = await pool.query(
    `SELECT mf.public_url, mf.mime_type, mf.original_name, mf.file_name
       FROM PostMedia pm
       JOIN MediaFiles mf ON mf.media_id = pm.media_id
      WHERE pm.post_id = ? ORDER BY pm.sort_order LIMIT 1`,
    [req.params.id]
  );

  let platformPostId;
  const platform = String(post.platform_name || "").toLowerCase();

  if (platform === "facebook") {
    const result = await meta.publishFacebookPost({
      pageId: String(post.account_handle).replace("@", ""),
      message: post.caption,
      imageUrl: absoluteMediaUrl(req, media[0]?.public_url),
      accessToken: post.access_token,
    });
    platformPostId = result.id || result.post_id;
  } else if (platform === "instagram") {
    if (!media.length) {
      return fail(res, "Instagram requires an image", 400);
    }
    const instagramMediaUrl = absoluteMediaUrl(req, media[0]?.public_url);
    console.log("Instagram publish media:", {
      postId: post.post_id,
      accountId: post.account_id,
      mediaUrl: instagramMediaUrl,
      mimeType: media[0]?.mime_type,
      originalName: media[0]?.original_name,
      fileName: media[0]?.file_name,
    });
    const result = await meta.publishInstagramPhoto({
      igAccountId: String(post.account_handle).replace("@", ""),
      imageUrl: instagramMediaUrl,
      caption: post.caption,
      accessToken: post.access_token,
    });
    platformPostId = result.id;
  } else {
    platformPostId = await publishPost(post);
  }

  await pool.query("UPDATE Posts SET status = 'published', platform_post_id = ?, published_at = UTC_TIMESTAMP() WHERE post_id = ?", [platformPostId, req.params.id]);
  const analytics = await fetchPostAnalytics(platformPostId, post.platform_id);
  await pool.query(
    `INSERT INTO PostAnalytics (post_id, account_id, likes, comments, shares, reach, impressions, clicks, engagement_rate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [req.params.id, post.account_id, analytics.likes, analytics.comments, analytics.shares, analytics.reach, analytics.impressions, analytics.clicks, analytics.engagementRate]
  );
  emitToTeam(req.io, req.user.team_id, EVENTS.POST_PUBLISHED, {
    postId: Number(req.params.id),
    publishedAt: new Date().toISOString(),
    analytics
  });
  return ok(res, { platformPostId }, "Published");
});

export const duplicate = asyncController(async (req, res) => {
  const [[post]] = await pool.query("SELECT * FROM Posts WHERE post_id = ? AND team_id = ? LIMIT 1", [req.params.id, req.user.team_id]);
  if (!post) return fail(res, "Post not found", 404);
  const [created] = await pool.query(
    `INSERT INTO Posts (team_id, account_id, campaign_id, created_by, caption, post_type, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', UTC_TIMESTAMP())`,
    [post.team_id, post.account_id, post.campaign_id, req.user.sub || req.user.id, post.caption, post.post_type]
  );
  await pool.query("INSERT INTO PostMedia (post_id, media_id, sort_order) SELECT ?, media_id, sort_order FROM PostMedia WHERE post_id = ?", [created.insertId, req.params.id]);
  await pool.query("INSERT INTO PostHashtags (post_id, hashtag_id) SELECT ?, hashtag_id FROM PostHashtags WHERE post_id = ?", [created.insertId, req.params.id]);
  return ok(res, { post_id: created.insertId, id: created.insertId }, "Post duplicated", 201);
});

export const reschedulePost = asyncController(async (req, res) => {
  const { scheduled_at, timezone } = req.body;
  if (!scheduled_at) return fail(res, "scheduled_at is required", 400);

  const [[post]] = await pool.query("SELECT * FROM Posts WHERE post_id = ? AND team_id = ? LIMIT 1", [req.params.id, req.user.team_id]);
  if (!post) return fail(res, "Post not found", 404);
  if (!["scheduled", "draft"].includes(post.status)) {
    return fail(res, "Only scheduled or draft posts can be rescheduled", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO ScheduledPosts (post_id, scheduled_at, timezone, status, created_at)
       VALUES (?, ?, ?, 'scheduled', UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         scheduled_at = VALUES(scheduled_at),
         timezone = VALUES(timezone),
         status = 'scheduled'`,
      [req.params.id, scheduled_at, timezone || "UTC"]
    );
    await conn.query(
      "UPDATE Posts SET status = 'scheduled', scheduled_at = ?, updated_at = UTC_TIMESTAMP() WHERE post_id = ? AND team_id = ?",
      [scheduled_at, req.params.id, req.user.team_id]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  emitToTeam(req.io, req.user.team_id, EVENTS.POST_RESCHEDULED, {
    postId: Number(req.params.id),
    newScheduledAt: scheduled_at
  });

  return ok(res, { post_id: Number(req.params.id), scheduled_at }, "Post rescheduled successfully");
});
