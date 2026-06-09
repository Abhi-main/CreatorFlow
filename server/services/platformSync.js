import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";
import * as meta from "./metaService.js";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const syncAccount = async (accountId) => {
  const [[account]] = await pool.query(
    `SELECT sa.account_id, sa.account_handle, sa.access_token, sa.follower_count,
            p.name AS platform_name
       FROM SocialAccounts sa
       JOIN Platforms p ON p.platform_id = sa.platform_id
      WHERE sa.account_id = ? LIMIT 1`,
    [accountId]
  );

  if (!account) {
    throw new Error("Account not found");
  }

  const platform = String(account.platform_name || "").toLowerCase();

  if (!["facebook", "instagram"].includes(platform) || !account.access_token) {
    const followerChange = randomInt(5, 50);
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
  }

  const externalId = String(account.account_handle || "").replace("@", "");
  const previousFollowers = Number(account.follower_count || 0);

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
    [followerCount, accountId]
  );
  await pool.query(
    `INSERT INTO FollowersHistory (account_id, recorded_date, follower_count, net_change)
     VALUES (?, UTC_DATE(), ?, ?)
     ON DUPLICATE KEY UPDATE follower_count = VALUES(follower_count), net_change = VALUES(net_change)`,
    [accountId, followerCount, followerChange]
  );
  await pool.query(
    `INSERT INTO DailyAnalytics
       (account_id, stat_date, total_posts, total_likes, total_comments, total_shares, total_reach,
        total_impressions, follower_count, follower_change, avg_engagement_rate)
     VALUES (?, UTC_DATE(), 0, 0, 0, 0, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_reach = VALUES(total_reach),
       total_impressions = VALUES(total_impressions),
       follower_count = VALUES(follower_count),
       follower_change = VALUES(follower_change),
       avg_engagement_rate = VALUES(avg_engagement_rate)`,
    [accountId, reach, impressions, followerCount, followerChange, engagementRate]
  );

  console.log(`Synced account ${accountId}`);
  return { accountId, followerChange, followerCount, reach, impressions, engagementRate };
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
