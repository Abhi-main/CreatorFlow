import cron from "node-cron";
import pool from "../config/db.js";
import * as metaService from "../services/metaService.js";
import { emitToTeam, emitToUser, getIO } from "../socket/index.js";
import { EVENTS } from "../socket/events.js";

const PUBLIC_BASE_URL = (process.env.BACKEND_PUBLIC_URL || "https://creatorflow-374k.onrender.com").replace(/\/$/, "");

function toPublicMediaUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return `${PUBLIC_BASE_URL}${filePath.startsWith("/") ? filePath : `/${filePath}`}`;
}

function randomAnalytics() {
  const likes = Math.floor(Math.random() * 200) + 20;
  const comments = Math.floor(Math.random() * 30) + 2;
  const shares = Math.floor(Math.random() * 15) + 1;
  const reach = Math.floor(Math.random() * 2000) + 200;
  const impressions = Math.floor(Math.random() * 3000) + 300;
  const clicks = Math.floor(Math.random() * 50) + 5;
  const engagementRate = Number((Math.random() * 0.06 + 0.01).toFixed(4));

  return {
    likes,
    comments,
    shares,
    reach,
    impressions,
    clicks,
    engagementRate
  };
}

cron.schedule("* * * * *", async () => {
  console.log(`[CRON] Checking for due posts at ${new Date().toISOString()}`);

  let conn;
  try {
    conn = await pool.getConnection();

    const [posts] = await conn.query("CALL sp_GetDuePosts()");
    const duePosts = posts[0] || [];

    if (duePosts.length === 0) {
      const [pending] = await conn.query(
        `SELECT sp.post_id, sp.scheduled_at, sp.timezone,
                UTC_TIMESTAMP() AS utc_now,
                CONVERT_TZ(sp.scheduled_at, IFNULL(sp.timezone, 'UTC'), 'UTC') AS scheduled_utc
           FROM ScheduledPosts sp
           JOIN Posts p ON p.post_id = sp.post_id
          WHERE p.status = 'scheduled'
          ORDER BY sp.scheduled_at ASC
          LIMIT 3`
      );

      if (pending.length > 0) {
        console.log(`[CRON] ${pending.length} post(s) waiting. Next due: ${JSON.stringify(pending[0])}`);
      }

      return;
    }

    console.log(`[CRON] Found ${duePosts.length} post(s) to publish`);

    for (const post of duePosts) {
      try {
        console.log(`[CRON] Publishing post ${post.post_id} for account ${post.account_id}`);

        await conn.query(
          `UPDATE ScheduledPosts
              SET publish_attempts = publish_attempts + 1,
                  last_attempt_at = UTC_TIMESTAMP()
            WHERE post_id = ?`,
          [post.post_id]
        );

        const [mediaRows] = await conn.query(
          `SELECT mf.public_url, mf.mime_type, mf.file_name, mf.original_name
             FROM PostMedia pm
             JOIN MediaFiles mf ON mf.media_id = pm.media_id
            WHERE pm.post_id = ?
            ORDER BY pm.sort_order ASC
            LIMIT 1`,
          [post.post_id]
        );

        const [accountRows] = await conn.query(
          `SELECT sa.account_handle, sa.account_name, pl.name AS platform_name
             FROM SocialAccounts sa
             JOIN Platforms pl ON pl.platform_id = sa.platform_id
            WHERE sa.account_id = ?
            LIMIT 1`,
          [post.account_id]
        );

        const account = accountRows[0];
        const platformName = account?.platform_name || "Unknown";
        const externalAccountId = String(account?.account_handle || "").replace("@", "");
        const mediaUrl = toPublicMediaUrl(mediaRows[0]?.public_url);

        let platformPostId = null;

        if (platformName === "Instagram") {
          if (!mediaRows.length || !mediaUrl) {
            throw new Error("Instagram requires an image or video");
          }

          const result = await metaService.publishInstagramPhoto({
            igAccountId: externalAccountId,
            imageUrl: mediaUrl,
            caption: post.caption || "",
            accessToken: post.access_token
          });

          platformPostId = result.id;
          console.log(`[CRON] Published to Instagram: ${platformPostId}`);
        } else if (platformName === "Facebook") {
          const result = await metaService.publishFacebookPost({
            pageId: externalAccountId,
            message: post.caption || "",
            imageUrl: mediaUrl,
            accessToken: post.access_token
          });

          platformPostId = result.id || result.post_id;
          console.log(`[CRON] Published to Facebook: ${platformPostId}`);
        } else {
          platformPostId = `mock_${Date.now()}`;
          console.log(`[CRON] Mock published to ${platformName}: ${platformPostId}`);
        }

        const analytics = randomAnalytics();

        await conn.query(
          `UPDATE Posts
              SET status = 'published',
                  platform_post_id = ?,
                  published_at = UTC_TIMESTAMP(),
                  updated_at = UTC_TIMESTAMP()
            WHERE post_id = ?`,
          [platformPostId, post.post_id]
        );

        await conn.query(
          `UPDATE ScheduledPosts
              SET status = 'published',
                  last_attempt_at = UTC_TIMESTAMP(),
                  error_message = NULL
            WHERE post_id = ?`,
          [post.post_id]
        );

        await conn.query(
          `INSERT INTO PostAnalytics
             (post_id, account_id, likes, comments, shares, reach, impressions, clicks, engagement_rate, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
          [
            post.post_id,
            post.account_id,
            analytics.likes,
            analytics.comments,
            analytics.shares,
            analytics.reach,
            analytics.impressions,
            analytics.clicks,
            analytics.engagementRate
          ]
        );

        await conn.query(
          `INSERT INTO DailyAnalytics
             (account_id, stat_date, total_posts, total_likes, total_comments, total_shares,
              total_reach, total_impressions, avg_engagement_rate)
           VALUES (?, UTC_DATE(), 1, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             total_posts = total_posts + 1,
             total_likes = total_likes + VALUES(total_likes),
             total_comments = total_comments + VALUES(total_comments),
             total_shares = total_shares + VALUES(total_shares),
             total_reach = total_reach + VALUES(total_reach),
             total_impressions = total_impressions + VALUES(total_impressions),
             avg_engagement_rate = VALUES(avg_engagement_rate)`,
          [
            post.account_id,
            analytics.likes,
            analytics.comments,
            analytics.shares,
            analytics.reach,
            analytics.impressions,
            analytics.engagementRate
          ]
        );

        await conn.query(
          `INSERT INTO Notifications
             (user_id, type, title, body, reference_id, reference_type, created_at)
           VALUES (?, 'post_published', 'Post Published! 🎉', 'Your scheduled post is now live.', ?, 'Posts', UTC_TIMESTAMP())`,
          [post.created_by, post.post_id]
        );

        const io = getIO();
        emitToTeam(io, post.team_id, EVENTS.POST_PUBLISHED, {
          postId: post.post_id,
          publishedAt: new Date().toISOString(),
          analytics
        });
        emitToUser(io, post.created_by, EVENTS.NOTIFICATION_NEW, {
          notification: {
            type: "post_published",
            title: "Post Published! 🎉",
            body: "Your scheduled post is now live.",
            reference_id: post.post_id,
            reference_type: "Posts",
            created_at: new Date().toISOString()
          }
        });

        console.log(`[CRON] Post ${post.post_id} fully processed`);
      } catch (postErr) {
        console.error(`[CRON] Failed post ${post.post_id}:`, postErr.message);

        const [attemptRows] = await conn.query(
          "SELECT publish_attempts FROM ScheduledPosts WHERE post_id = ?",
          [post.post_id]
        );

        if (attemptRows[0]?.publish_attempts >= 3) {
          await conn.query(
            "UPDATE Posts SET status = 'failed', updated_at = UTC_TIMESTAMP() WHERE post_id = ?",
            [post.post_id]
          );
        }

        await conn.query(
          `UPDATE ScheduledPosts
              SET error_message = ?
            WHERE post_id = ?`,
          [postErr.message, post.post_id]
        );

        await conn.query(
          `INSERT INTO Notifications
             (user_id, type, title, body, reference_id, reference_type, created_at)
           VALUES (?, 'post_failed', 'Post Failed ❌', ?, ?, 'Posts', UTC_TIMESTAMP())`,
          [post.created_by, `Your post failed: ${postErr.message}`, post.post_id]
        );

        emitToUser(getIO(), post.created_by, EVENTS.POST_FAILED, {
          postId: post.post_id,
          error: postErr.message
        });
      }
    }
  } catch (err) {
    console.error("[CRON] Job error:", err.message);
  } finally {
    if (conn) conn.release();
  }
});
