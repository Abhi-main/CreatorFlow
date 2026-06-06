CREATE DATABASE IF NOT EXISTS creatorflow;
USE creatorflow;

CREATE TABLE IF NOT EXISTS Roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Teams (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  plan_name VARCHAR(100) DEFAULT 'Starter',
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  team_id BIGINT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  status ENUM('active', 'pending', 'disabled') DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES Roles(id),
  CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES Teams(id)
);

CREATE TABLE IF NOT EXISTS Sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PasswordResets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS TeamMembers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('invited', 'active', 'removed') DEFAULT 'active',
  UNIQUE KEY uq_team_member (team_id, user_id),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES Teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_role FOREIGN KEY (role_id) REFERENCES Roles(id)
);

CREATE TABLE IF NOT EXISTS Platforms (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  code VARCHAR(60) NOT NULL UNIQUE,
  base_url VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SocialAccounts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  platform_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  account_name VARCHAR(140) NOT NULL,
  handle VARCHAR(140),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  status ENUM('connected', 'expired', 'disconnected') DEFAULT 'connected',
  follower_count INT DEFAULT 0,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_social_accounts_platform FOREIGN KEY (platform_id) REFERENCES Platforms(id),
  CONSTRAINT fk_social_accounts_team FOREIGN KEY (team_id) REFERENCES Teams(id)
);

CREATE TABLE IF NOT EXISTS MediaFiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id BIGINT NOT NULL,
  uploaded_by BIGINT NOT NULL,
  provider VARCHAR(50) DEFAULT 'local',
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path VARCHAR(255) NOT NULL,
  public_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_media_files_team FOREIGN KEY (team_id) REFERENCES Teams(id),
  CONSTRAINT fk_media_files_user FOREIGN KEY (uploaded_by) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Campaigns (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id BIGINT NOT NULL,
  name VARCHAR(160) NOT NULL,
  objective VARCHAR(160),
  budget DECIMAL(12,2) DEFAULT 0,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('planning', 'active', 'paused', 'completed') DEFAULT 'planning',
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_team FOREIGN KEY (team_id) REFERENCES Teams(id),
  CONSTRAINT fk_campaigns_user FOREIGN KEY (created_by) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Hashtags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id BIGINT NULL,
  tag VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  campaign_id BIGINT NULL,
  social_account_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  title VARCHAR(180) NOT NULL,
  caption TEXT,
  content_type ENUM('image', 'video', 'carousel', 'story', 'text', 'reel') DEFAULT 'image',
  publishing_status ENUM('draft', 'scheduled', 'published', 'failed', 'cancelled') DEFAULT 'draft',
  platform_post_id VARCHAR(190) NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_campaign FOREIGN KEY (campaign_id) REFERENCES Campaigns(id),
  CONSTRAINT fk_posts_social_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id),
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS PostMedia (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  media_file_id BIGINT NOT NULL,
  sort_order INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_media_media FOREIGN KEY (media_file_id) REFERENCES MediaFiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PostHashtags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  hashtag_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_post_hashtag (post_id, hashtag_id),
  CONSTRAINT fk_post_hashtags_post FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_hashtags_hashtag FOREIGN KEY (hashtag_id) REFERENCES Hashtags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScheduledPosts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  status ENUM('pending', 'published', 'failed', 'cancelled') DEFAULT 'pending',
  last_attempt_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scheduled_posts_post FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RecurringSchedules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  is_active TINYINT(1) DEFAULT 1,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_schedules_post FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RecurringPostInstances (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  recurring_schedule_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  status ENUM('pending', 'published', 'failed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_instances_schedule FOREIGN KEY (recurring_schedule_id) REFERENCES RecurringSchedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_instances_post FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PostAnalytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  clicks INT DEFAULT 0,
  reach INT DEFAULT 0,
  impressions INT DEFAULT 0,
  saves INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_analytics_post FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DailyAnalytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  social_account_id BIGINT NOT NULL,
  metric_date DATE NOT NULL,
  posts_published INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  clicks INT DEFAULT 0,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_analytics (social_account_id, metric_date),
  CONSTRAINT fk_daily_analytics_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS WeeklyAnalytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  social_account_id BIGINT NOT NULL,
  week_start DATE NOT NULL,
  posts_published INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  clicks INT DEFAULT 0,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_weekly_analytics (social_account_id, week_start),
  CONSTRAINT fk_weekly_analytics_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS FollowersHistory (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  social_account_id BIGINT NOT NULL,
  metric_date DATE NOT NULL,
  follower_count INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_followers_history (social_account_id, metric_date),
  CONSTRAINT fk_followers_history_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HashtagAnalytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hashtag_id BIGINT NOT NULL,
  social_account_id BIGINT NOT NULL,
  metric_date DATE NOT NULL,
  usage_count INT DEFAULT 0,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hashtag_analytics_tag FOREIGN KEY (hashtag_id) REFERENCES Hashtags(id) ON DELETE CASCADE,
  CONSTRAINT fk_hashtag_analytics_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CampaignAnalytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  campaign_id BIGINT NOT NULL,
  metric_date DATE NOT NULL,
  spend DECIMAL(12,2) DEFAULT 0,
  leads INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  impressions INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaign_analytics_campaign FOREIGN KEY (campaign_id) REFERENCES Campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS BestPostingTimes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  social_account_id BIGINT NOT NULL,
  weekday TINYINT NOT NULL,
  time_slot TIME NOT NULL,
  performance_score DECIMAL(6,2) DEFAULT 0,
  confidence_score DECIMAL(6,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_best_posting_times_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HashtagRecommendations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  social_account_id BIGINT NOT NULL,
  hashtag_id BIGINT NOT NULL,
  recommendation_score DECIMAL(6,2) DEFAULT 0,
  expected_reach INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hashtag_recommendations_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_hashtag_recommendations_tag FOREIGN KEY (hashtag_id) REFERENCES Hashtags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CaptionSuggestions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  social_account_id BIGINT NOT NULL,
  prompt_text TEXT NOT NULL,
  suggested_caption TEXT NOT NULL,
  tone VARCHAR(100),
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_caption_suggestions_account FOREIGN KEY (social_account_id) REFERENCES SocialAccounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_caption_suggestions_user FOREIGN KEY (created_by) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  name VARCHAR(180) NOT NULL,
  report_type VARCHAR(80) NOT NULL,
  file_url VARCHAR(255),
  generated_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_team FOREIGN KEY (team_id) REFERENCES Teams(id),
  CONSTRAINT fk_reports_user FOREIGN KEY (created_by) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  level VARCHAR(30) NOT NULL,
  source VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AdminActions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_user_id BIGINT NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_table VARCHAR(80) NOT NULL,
  target_id BIGINT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_actions_user FOREIGN KEY (admin_user_id) REFERENCES Users(id)
);

CREATE OR REPLACE VIEW vw_AccountDashboard AS
SELECT
  sa.id AS social_account_id,
  sa.account_name,
  p.name AS platform_name,
  sa.follower_count,
  COUNT(DISTINCT po.id) AS total_posts,
  SUM(CASE WHEN po.publishing_status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_posts,
  SUM(CASE WHEN po.publishing_status = 'published' THEN 1 ELSE 0 END) AS published_posts,
  COALESCE(SUM(pa.impressions), 0) AS total_impressions
FROM SocialAccounts sa
JOIN Platforms p ON p.id = sa.platform_id
LEFT JOIN Posts po ON po.social_account_id = sa.id
LEFT JOIN PostAnalytics pa ON pa.post_id = po.id
GROUP BY sa.id, sa.account_name, p.name, sa.follower_count;

CREATE OR REPLACE VIEW vw_TopPosts AS
SELECT
  po.id AS post_id,
  po.title,
  sa.account_name,
  p.name AS platform_name,
  pa.impressions,
  pa.likes,
  pa.comments,
  pa.shares,
  pa.engagement_rate
FROM Posts po
JOIN SocialAccounts sa ON sa.id = po.social_account_id
JOIN Platforms p ON p.id = sa.platform_id
LEFT JOIN PostAnalytics pa ON pa.post_id = po.id
WHERE po.publishing_status = 'published'
ORDER BY pa.engagement_rate DESC, pa.impressions DESC;

CREATE OR REPLACE VIEW vw_CampaignSummary AS
SELECT
  c.id AS campaign_id,
  c.name,
  c.status,
  c.budget,
  COUNT(DISTINCT po.id) AS total_posts,
  COALESCE(SUM(ca.impressions), 0) AS total_impressions,
  COALESCE(SUM(ca.clicks), 0) AS total_clicks,
  COALESCE(SUM(ca.conversions), 0) AS total_conversions
FROM Campaigns c
LEFT JOIN Posts po ON po.campaign_id = c.id
LEFT JOIN CampaignAnalytics ca ON ca.campaign_id = c.id
GROUP BY c.id, c.name, c.status, c.budget;

DELIMITER //

CREATE PROCEDURE sp_RollupWeeklyAnalytics(IN account_id BIGINT, IN week_start DATE)
BEGIN
  INSERT INTO WeeklyAnalytics (
    social_account_id,
    week_start,
    posts_published,
    likes,
    comments,
    shares,
    clicks,
    impressions,
    reach
  )
  SELECT
    account_id,
    week_start,
    SUM(posts_published),
    SUM(likes),
    SUM(comments),
    SUM(shares),
    SUM(clicks),
    SUM(impressions),
    SUM(reach)
  FROM DailyAnalytics
  WHERE social_account_id = account_id
    AND metric_date BETWEEN week_start AND DATE_ADD(week_start, INTERVAL 6 DAY)
  ON DUPLICATE KEY UPDATE
    posts_published = VALUES(posts_published),
    likes = VALUES(likes),
    comments = VALUES(comments),
    shares = VALUES(shares),
    clicks = VALUES(clicks),
    impressions = VALUES(impressions),
    reach = VALUES(reach);
END //

CREATE PROCEDURE sp_GetDuePosts()
BEGIN
  SELECT
    po.id,
    po.title,
    sp.scheduled_for,
    po.social_account_id
  FROM Posts po
  JOIN ScheduledPosts sp ON sp.post_id = po.id
  WHERE po.publishing_status = 'scheduled'
    AND sp.status = 'pending'
    AND sp.scheduled_for <= NOW()
  ORDER BY sp.scheduled_for ASC;
END //

CREATE PROCEDURE sp_MarkPostPublished(IN in_post_id BIGINT, IN in_platform_post_id VARCHAR(190))
BEGIN
  UPDATE Posts
  SET publishing_status = 'published',
      platform_post_id = in_platform_post_id,
      published_at = NOW()
  WHERE id = in_post_id;

  UPDATE ScheduledPosts
  SET status = 'published',
      last_attempt_at = NOW()
  WHERE ScheduledPosts.post_id = in_post_id;
END //

CREATE TRIGGER trg_after_post_published
AFTER UPDATE ON Posts
FOR EACH ROW
BEGIN
  IF NEW.publishing_status = 'published' AND (OLD.publishing_status <> 'published' OR OLD.publishing_status IS NULL) THEN
    INSERT INTO DailyAnalytics (
      social_account_id,
      metric_date,
      posts_published,
      likes,
      comments,
      shares,
      clicks,
      impressions,
      reach
    )
    VALUES (
      NEW.social_account_id,
      DATE(NOW()),
      1,
      0,
      0,
      0,
      0,
      0,
      0
    )
    ON DUPLICATE KEY UPDATE
      posts_published = posts_published + 1;
  END IF;
END //

CREATE TRIGGER trg_after_follower_history_insert
AFTER INSERT ON FollowersHistory
FOR EACH ROW
BEGIN
  UPDATE SocialAccounts
  SET follower_count = NEW.follower_count
  WHERE id = NEW.social_account_id;
END //

CREATE TRIGGER trg_after_admin_action
AFTER INSERT ON AdminActions
FOR EACH ROW
BEGIN
  INSERT INTO Logs (level, source, message, metadata)
  VALUES (
    'info',
    'admin-action',
    CONCAT('Admin action recorded: ', NEW.action_type),
    JSON_OBJECT(
      'admin_user_id', NEW.admin_user_id,
      'target_table', NEW.target_table,
      'target_id', NEW.target_id
    )
  );
END //

DELIMITER ;
