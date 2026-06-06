import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const syncAccount = async (accountId) => {
  const followerChange = randomInt(5, 50);
  const [[account]] = await pool.query("SELECT follower_count FROM SocialAccounts WHERE account_id = ? LIMIT 1", [accountId]);
  const followerCount = Number(account?.follower_count || 0) + followerChange;

  await pool.query("UPDATE SocialAccounts SET follower_count = ?, last_synced_at = UTC_TIMESTAMP() WHERE account_id = ?", [followerCount, accountId]);
  await pool.query(
    `INSERT INTO FollowersHistory (account_id, recorded_date, follower_count, net_change)
     VALUES (?, UTC_DATE(), ?, ?)
     ON DUPLICATE KEY UPDATE follower_count = VALUES(follower_count), net_change = VALUES(net_change)`,
    [accountId, followerCount, followerChange]
  );
  await pool.query(
    `INSERT INTO DailyAnalytics (account_id, stat_date, total_posts, total_likes, total_reach, follower_count, follower_change)
     VALUES (?, UTC_DATE(), 0, 0, 0, ?, ?)
     ON DUPLICATE KEY UPDATE follower_count = VALUES(follower_count), follower_change = VALUES(follower_change)`,
    [accountId, followerCount, followerChange]
  );

  console.log(`Synced account ${accountId}`);
  return { accountId, followerChange, followerCount };
};

export const publishPost = async (post) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const platformPostId = `mock_${uuidv4()}`;
  console.log(`Published post ${post.post_id || post.id} to platform`);
  return platformPostId;
};

export const fetchPostAnalytics = async () => {
  const likes = randomInt(50, 500);
  const comments = randomInt(5, 50);
  const shares = randomInt(2, 30);
  const reach = likes * randomInt(8, 15);
  const impressions = Math.round(reach * (Math.random() * 0.8 + 1.2));
  const clicks = randomInt(10, 100);
  const engagementRate = Number((((likes + comments + shares) / Math.max(reach, 1)) * 100).toFixed(2));
  return { likes, comments, shares, reach, impressions, clicks, engagementRate };
};
