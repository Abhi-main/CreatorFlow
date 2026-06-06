import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

const database = process.env.DB_NAME || 'smart_social_media';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

const schema = `
CREATE DATABASE IF NOT EXISTS \`${database}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE \`${database}\`;

CREATE TABLE IF NOT EXISTS Roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(32) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Teams (
  team_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT NULL,
  team_name VARCHAR(160) NOT NULL,
  plan ENUM('free','starter','pro','enterprise') NOT NULL DEFAULT 'free',
  max_members INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Users (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  team_id BIGINT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
  avatar_url VARCHAR(500) NULL,
  bio VARCHAR(200) NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notification_preferences JSON NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES Roles(role_id),
  CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS TeamMembers (
  member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role_id INT NOT NULL,
  status ENUM('active','invited') NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_user (team_id, user_id),
  CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_role FOREIGN KEY (role_id) REFERENCES Roles(role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Sessions (
  session_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_token (refresh_token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PasswordResets (
  reset_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reset_token (token_hash),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Platforms (
  platform_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE,
  icon VARCHAR(80) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS SocialAccounts (
  account_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  platform_id INT NOT NULL,
  account_handle VARCHAR(120) NOT NULL,
  account_name VARCHAR(160) NOT NULL,
  account_type VARCHAR(40) NOT NULL DEFAULT 'business',
  access_token VARCHAR(255) NOT NULL,
  follower_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  token_expires_at DATETIME NULL,
  last_synced_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_accounts_platform FOREIGN KEY (platform_id) REFERENCES Platforms(platform_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Campaigns (
  campaign_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  campaign_name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget DECIMAL(12,2) NULL,
  status ENUM('draft','active','paused','completed','archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaign_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_user FOREIGN KEY (created_by) REFERENCES Users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Hashtags (
  hashtag_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  tag VARCHAR(120) NOT NULL,
  category VARCHAR(80) NULL,
  avg_reach INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_tag (team_id, tag),
  CONSTRAINT fk_hashtag_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Posts (
  post_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  campaign_id BIGINT NULL,
  created_by BIGINT NOT NULL,
  caption TEXT NOT NULL,
  post_type ENUM('feed','story','reel','carousel') NOT NULL DEFAULT 'feed',
  status ENUM('draft','scheduled','published','failed','cancelled','removed') NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  platform_post_id VARCHAR(120) NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_campaign FOREIGN KEY (campaign_id) REFERENCES Campaigns(campaign_id) ON DELETE SET NULL,
  CONSTRAINT fk_posts_user FOREIGN KEY (created_by) REFERENCES Users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS MediaFiles (
  media_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  uploaded_by BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  public_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_media_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_media_user FOREIGN KEY (uploaded_by) REFERENCES Users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PostMedia (
  post_media_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  media_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_pm_post FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_media FOREIGN KEY (media_id) REFERENCES MediaFiles(media_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PostHashtags (
  post_hashtag_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  hashtag_id BIGINT NOT NULL,
  UNIQUE KEY uq_post_hashtag (post_id, hashtag_id),
  CONSTRAINT fk_ph_post FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_ph_hashtag FOREIGN KEY (hashtag_id) REFERENCES Hashtags(hashtag_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ScheduledPosts (
  scheduled_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL UNIQUE,
  scheduled_at DATETIME NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
  status ENUM('scheduled','published','failed','cancelled') NOT NULL DEFAULT 'scheduled',
  publish_attempts INT NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_scheduled_post FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS RecurringSchedules (
  schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  caption TEXT NULL,
  post_type VARCHAR(40) NOT NULL DEFAULT 'feed',
  recurrence_type ENUM('daily','weekly','monthly') NOT NULL,
  day_of_week VARCHAR(80) NULL,
  day_of_month INT NULL,
  time_of_day TIME NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
  next_run_at DATETIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_user FOREIGN KEY (created_by) REFERENCES Users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PostAnalytics (
  analytics_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  reach INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pa_post FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS DailyAnalytics (
  daily_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  total_posts INT NOT NULL DEFAULT 0,
  total_likes INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  total_shares INT NOT NULL DEFAULT 0,
  total_reach INT NOT NULL DEFAULT 0,
  total_impressions INT NOT NULL DEFAULT 0,
  follower_count INT NOT NULL DEFAULT 0,
  follower_change INT NOT NULL DEFAULT 0,
  avg_engagement_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_daily_account_date (account_id, stat_date),
  CONSTRAINT fk_daily_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WeeklyAnalytics (
  weekly_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT NOT NULL,
  week_start DATE NOT NULL,
  total_posts INT NOT NULL DEFAULT 0,
  total_likes INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  total_shares INT NOT NULL DEFAULT 0,
  total_reach INT NOT NULL DEFAULT 0,
  total_impressions INT NOT NULL DEFAULT 0,
  avg_engagement_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_weekly_account_date (account_id, week_start),
  CONSTRAINT fk_weekly_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS FollowersHistory (
  history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT NOT NULL,
  recorded_date DATE NOT NULL,
  follower_count INT NOT NULL DEFAULT 0,
  net_change INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_followers_account_date (account_id, recorded_date),
  CONSTRAINT fk_followers_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS BestPostingTimes (
  best_time_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT NOT NULL,
  day_of_week VARCHAR(12) NOT NULL,
  hour_of_day INT NOT NULL,
  predicted_engagement_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  confidence_score DECIMAL(6,3) NOT NULL DEFAULT 0,
  sample_size INT NOT NULL DEFAULT 0,
  model_version VARCHAR(30) NOT NULL DEFAULT 'v1.0',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_best_time (account_id, day_of_week, hour_of_day),
  CONSTRAINT fk_best_account FOREIGN KEY (account_id) REFERENCES SocialAccounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CampaignAnalytics (
  campaign_analytics_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  reach INT NOT NULL DEFAULT 0,
  engagement INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_campaign_date (campaign_id, stat_date),
  CONSTRAINT fk_ca_campaign FOREIGN KEY (campaign_id) REFERENCES Campaigns(campaign_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS HashtagAnalytics (
  hashtag_analytics_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hashtag_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  reach INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_hashtag_date (hashtag_id, stat_date),
  CONSTRAINT fk_ha_hashtag FOREIGN KEY (hashtag_id) REFERENCES Hashtags(hashtag_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS HashtagRecommendations (
  recommendation_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  account_id BIGINT NULL,
  hashtag_id BIGINT NOT NULL,
  score DECIMAL(8,4) NOT NULL DEFAULT 0,
  expected_reach INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rec_post_hashtag (post_id, hashtag_id),
  CONSTRAINT fk_hr_post FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_hr_hashtag FOREIGN KEY (hashtag_id) REFERENCES Hashtags(hashtag_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CaptionSuggestions (
  caption_suggestion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tone VARCHAR(40) NOT NULL,
  media_type VARCHAR(80) NULL,
  hashtags JSON NULL,
  suggestions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Notifications (
  notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NULL,
  reference_id BIGINT NULL,
  reference_type VARCHAR(80) NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Reports (
  report_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NULL,
  created_by BIGINT NOT NULL,
  report_type VARCHAR(80) NOT NULL,
  report_name VARCHAR(180) NOT NULL,
  format VARCHAR(20) NOT NULL DEFAULT 'pdf',
  status ENUM('queued','processing','ready','failed') NOT NULL DEFAULT 'queued',
  date_from DATE NULL,
  date_to DATE NULL,
  file_url VARCHAR(500) NULL,
  generated_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_team FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_user FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Logs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  action VARCHAR(80) NOT NULL,
  user_id BIGINT NULL,
  message TEXT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS AdminActions (
  admin_action_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id BIGINT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_user FOREIGN KEY (admin_user_id) REFERENCES Users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS FlaggedPosts (
  flagged_post_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  reason VARCHAR(120) NOT NULL DEFAULT 'Other',
  report_count INT NOT NULL DEFAULT 1,
  status ENUM('flagged','under_review','approved','removed') NOT NULL DEFAULT 'flagged',
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_flagged_post FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_flagged_reviewer FOREIGN KEY (reviewed_by) REFERENCES Users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO Roles (role_name) VALUES ('superadmin'), ('admin'), ('manager'), ('viewer');
INSERT IGNORE INTO Platforms (name, icon) VALUES ('Instagram', 'instagram'), ('Facebook', 'facebook'), ('LinkedIn', 'linkedin');

CREATE OR REPLACE VIEW vw_AccountDashboard AS
SELECT
  sa.team_id,
  sa.account_id,
  sa.account_handle,
  sa.account_name,
  p.name AS platform,
  sa.follower_count,
  COUNT(DISTINCT po.post_id) AS total_posts,
  COALESCE(SUM(pa.reach), 0) AS total_reach,
  COALESCE(SUM(pa.impressions), 0) AS total_impressions,
  COALESCE(AVG(pa.engagement_rate), 0) AS avg_engagement_rate
FROM SocialAccounts sa
JOIN Platforms p ON p.platform_id = sa.platform_id
LEFT JOIN Posts po ON po.account_id = sa.account_id
LEFT JOIN PostAnalytics pa ON pa.post_id = po.post_id
GROUP BY sa.team_id, sa.account_id, sa.account_handle, sa.account_name, p.name, sa.follower_count;

CREATE OR REPLACE VIEW vw_CampaignSummary AS
SELECT
  c.campaign_id,
  c.team_id,
  c.campaign_name,
  c.status,
  COUNT(DISTINCT p.post_id) AS total_posts,
  COALESCE(SUM(pa.reach), 0) AS total_reach,
  COALESCE(SUM(pa.likes + pa.comments + pa.shares), 0) AS total_engagement,
  COALESCE(SUM(pa.clicks), 0) AS total_clicks,
  COALESCE(AVG(pa.engagement_rate), 0) AS avg_engagement_rate
FROM Campaigns c
LEFT JOIN Posts p ON p.campaign_id = c.campaign_id
LEFT JOIN PostAnalytics pa ON pa.post_id = p.post_id
GROUP BY c.campaign_id, c.team_id, c.campaign_name, c.status;

DROP PROCEDURE IF EXISTS sp_GetDuePosts;
CREATE PROCEDURE sp_GetDuePosts()
BEGIN
  SELECT p.*, sa.platform_id
  FROM Posts p
  JOIN SocialAccounts sa ON sa.account_id = p.account_id
  JOIN ScheduledPosts sp ON sp.post_id = p.post_id
  WHERE p.status = 'scheduled'
    AND sp.status = 'scheduled'
    AND sp.scheduled_at <= UTC_TIMESTAMP();
END;

DROP PROCEDURE IF EXISTS sp_MarkPostPublished;
CREATE PROCEDURE sp_MarkPostPublished(IN in_post_id BIGINT, IN in_platform_post_id VARCHAR(120))
BEGIN
  UPDATE Posts
  SET status = 'published',
      platform_post_id = in_platform_post_id,
      published_at = UTC_TIMESTAMP(),
      updated_at = UTC_TIMESTAMP()
  WHERE post_id = in_post_id;

  UPDATE ScheduledPosts
  SET status = 'published',
      last_attempt_at = UTC_TIMESTAMP()
  WHERE post_id = in_post_id;
END;

DROP PROCEDURE IF EXISTS sp_RollupWeeklyAnalytics;
CREATE PROCEDURE sp_RollupWeeklyAnalytics(IN in_account_id BIGINT, IN in_week_start DATE)
BEGIN
  INSERT INTO WeeklyAnalytics
    (account_id, week_start, total_posts, total_likes, total_comments, total_shares,
     total_reach, total_impressions, avg_engagement_rate)
  SELECT
    in_account_id,
    in_week_start,
    COALESCE(SUM(total_posts), 0),
    COALESCE(SUM(total_likes), 0),
    COALESCE(SUM(total_comments), 0),
    COALESCE(SUM(total_shares), 0),
    COALESCE(SUM(total_reach), 0),
    COALESCE(SUM(total_impressions), 0),
    COALESCE(AVG(avg_engagement_rate), 0)
  FROM DailyAnalytics
  WHERE account_id = in_account_id
    AND stat_date >= in_week_start
    AND stat_date < DATE_ADD(in_week_start, INTERVAL 7 DAY)
  ON DUPLICATE KEY UPDATE
    total_posts = VALUES(total_posts),
    total_likes = VALUES(total_likes),
    total_comments = VALUES(total_comments),
    total_shares = VALUES(total_shares),
    total_reach = VALUES(total_reach),
    total_impressions = VALUES(total_impressions),
    avg_engagement_rate = VALUES(avg_engagement_rate);
END;
`;

try {
  console.log(`Setting up database ${database}...`);
  await connection.query(schema);
  console.log('Database setup complete.');
} finally {
  await connection.end();
}
