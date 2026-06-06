import cron from 'node-cron';
import pool from '../config/db.js';
import { publishPost, fetchPostAnalytics } from '../services/platformSync.js';
import { emitToTeam, emitToUser, getIO } from '../socket/index.js';
import { EVENTS } from '../socket/events.js';

cron.schedule('* * * * *', async () => {
  console.log('Checking for due posts...');
  const conn = await pool.getConnection();

  try {
    const [resultSets] = await conn.query('CALL sp_GetDuePosts()');
    const duePosts = resultSets[0] || [];

    for (const post of duePosts) {
      try {
        const platformPostId = await publishPost(post);
        await conn.query('CALL sp_MarkPostPublished(?, ?)', [post.post_id, platformPostId]);

        const analytics = await fetchPostAnalytics(platformPostId, post.platform_id);
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
            analytics.engagementRate,
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
            analytics.engagementRate,
          ]
        );

        await conn.query(
          `INSERT INTO Notifications
             (user_id, type, title, body, reference_id, reference_type, created_at)
           VALUES (?, 'post_published', 'Post Published!', 'Your scheduled post has been published successfully.', ?, 'Posts', UTC_TIMESTAMP())`,
          [post.created_by, post.post_id]
        );

        const io = getIO();
        emitToTeam(io, post.team_id, EVENTS.POST_PUBLISHED, {
          postId: post.post_id,
          publishedAt: new Date().toISOString(),
          analytics,
        });
        emitToUser(io, post.created_by, EVENTS.NOTIFICATION_NEW, {
          notification: {
            type: 'post_published',
            title: 'Post Published!',
            body: 'Your scheduled post went live.',
            reference_id: post.post_id,
            created_at: new Date().toISOString(),
          },
        });

        console.log(`Published post ${post.post_id}`);
      } catch (err) {
        console.error(`Failed post ${post.post_id}:`, err.message);
        await conn.query(`UPDATE Posts SET status = 'failed', updated_at = UTC_TIMESTAMP() WHERE post_id = ?`, [
          post.post_id,
        ]);
        await conn.query(
          `UPDATE ScheduledPosts
           SET status = 'failed',
               publish_attempts = publish_attempts + 1,
               last_attempt_at = UTC_TIMESTAMP(),
               error_message = ?
           WHERE post_id = ?`,
          [err.message, post.post_id]
        );
        emitToUser(getIO(), post.created_by, EVENTS.POST_FAILED, {
          postId: post.post_id,
          error: err.message,
        });
      }
    }
  } catch (err) {
    console.error('Post publisher job failed:', err.message);
  } finally {
    conn.release();
  }
});
