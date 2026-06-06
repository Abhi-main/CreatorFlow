import pool from './config/db.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (days) => new Date(Date.now() - days * 86400000);
const daysFromNow = (days) => new Date(Date.now() + days * 86400000);
const ymd = (date) => date.toISOString().slice(0, 10);

async function seed() {
  console.log('Seeding database...');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'FlaggedPosts',
      'AdminActions',
      'Logs',
      'Reports',
      'Notifications',
      'CaptionSuggestions',
      'HashtagRecommendations',
      'BestPostingTimes',
      'CampaignAnalytics',
      'HashtagAnalytics',
      'FollowersHistory',
      'WeeklyAnalytics',
      'DailyAnalytics',
      'PostAnalytics',
      'RecurringSchedules',
      'ScheduledPosts',
      'PostHashtags',
      'PostMedia',
      'Posts',
      'MediaFiles',
      'Hashtags',
      'Campaigns',
      'SocialAccounts',
      'TeamMembers',
      'PasswordResets',
      'Sessions',
      'Users',
      'Teams',
    ];

    for (const table of tables) {
      await conn.query(`DELETE FROM ${table}`);
      await conn.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await conn.query(`INSERT IGNORE INTO Roles (role_name) VALUES ('superadmin'), ('admin'), ('manager'), ('viewer')`);
    await conn.query(
      `INSERT IGNORE INTO Platforms (name, icon) VALUES ('Instagram', 'instagram'), ('Facebook', 'facebook'), ('LinkedIn', 'linkedin')`
    );

    const [roles] = await conn.query('SELECT role_id, role_name FROM Roles');
    const roleMap = Object.fromEntries(roles.map((role) => [role.role_name, role.role_id]));
    const [platforms] = await conn.query('SELECT platform_id, name FROM Platforms');
    const platformMap = Object.fromEntries(platforms.map((platform) => [platform.name.toLowerCase(), platform.platform_id]));
    const passwordHash = await bcrypt.hash('Admin@1234', 12);

    const users = [
      { first_name: 'Super', last_name: 'Admin', email: 'superadmin@smartsocial.app', role: 'superadmin' },
      { first_name: 'Admin', last_name: 'User', email: 'admin@smartsocial.app', role: 'admin' },
      { first_name: 'Sarah', last_name: 'Manager', email: 'manager@smartsocial.app', role: 'manager' },
      { first_name: 'Tom', last_name: 'Manager', email: 'manager2@smartsocial.app', role: 'manager' },
      { first_name: 'View', last_name: 'Only', email: 'viewer@smartsocial.app', role: 'viewer' },
    ];

    const userIds = [];
    for (const user of users) {
      const [result] = await conn.query(
        `INSERT INTO Users
           (role_id, first_name, last_name, email, password_hash, timezone, email_verified, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 'Asia/Kolkata', true, true, UTC_TIMESTAMP())`,
        [roleMap[user.role], user.first_name, user.last_name, user.email, passwordHash]
      );
      userIds.push(result.insertId);
    }
    console.log('Users seeded');

    const [agency] = await conn.query(
      `INSERT INTO Teams (owner_id, team_name, plan, max_members, created_at)
       VALUES (?, 'Awesome Agency', 'pro', 15, UTC_TIMESTAMP())`,
      [userIds[0]]
    );
    const [solo] = await conn.query(
      `INSERT INTO Teams (owner_id, team_name, plan, max_members, created_at)
       VALUES (?, 'Solo Creator Studio', 'starter', 5, UTC_TIMESTAMP())`,
      [userIds[2]]
    );
    const teamIds = [agency.insertId, solo.insertId];

    await conn.query(`UPDATE Users SET team_id = ? WHERE user_id IN (?, ?, ?)`, [teamIds[0], userIds[0], userIds[1], userIds[2]]);
    await conn.query(`UPDATE Users SET team_id = ? WHERE user_id IN (?, ?)`, [teamIds[1], userIds[3], userIds[4]]);

    const members = [
      [teamIds[0], userIds[0], roleMap.superadmin],
      [teamIds[0], userIds[1], roleMap.admin],
      [teamIds[0], userIds[2], roleMap.manager],
      [teamIds[1], userIds[3], roleMap.manager],
      [teamIds[1], userIds[4], roleMap.viewer],
    ];
    for (const member of members) {
      await conn.query(`INSERT INTO TeamMembers (team_id, user_id, role_id, joined_at) VALUES (?, ?, ?, UTC_TIMESTAMP())`, member);
    }
    console.log('Teams seeded');

    const accountData = [
      [teamIds[0], platformMap.instagram, '@agency_insta', 'Agency Instagram', 'business', 18420],
      [teamIds[0], platformMap.facebook, '@agency_fb', 'Agency Facebook', 'business', 23110],
      [teamIds[0], platformMap.linkedin, '@agency_li', 'Agency LinkedIn', 'business', 12900],
      [teamIds[1], platformMap.instagram, '@solo_insta', 'Solo Instagram', 'creator', 6410],
      [teamIds[1], platformMap.facebook, '@solo_fb', 'Solo Facebook', 'personal', 3250],
      [teamIds[1], platformMap.linkedin, '@solo_li', 'Solo LinkedIn', 'personal', 2100],
    ];
    const accountIds = [];
    for (const [teamId, platformId, handle, name, type, followers] of accountData) {
      const [result] = await conn.query(
        `INSERT INTO SocialAccounts
           (team_id, platform_id, account_handle, account_name, account_type, access_token,
            follower_count, is_active, token_expires_at, last_synced_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [teamId, platformId, handle, name, type, uuidv4(), followers, daysFromNow(rand(10, 90))]
      );
      accountIds.push(result.insertId);
    }
    console.log('Social accounts seeded');

    const [campaignOne] = await conn.query(
      `INSERT INTO Campaigns
         (team_id, created_by, campaign_name, description, start_date, end_date, budget, status, created_at)
       VALUES (?, ?, 'Summer Launch 2026', 'A bright multi-platform launch campaign.', ?, ?, 125000, 'active', UTC_TIMESTAMP())`,
      [teamIds[0], userIds[1], ymd(daysAgo(5)), ymd(daysFromNow(25))]
    );
    const [campaignTwo] = await conn.query(
      `INSERT INTO Campaigns
         (team_id, created_by, campaign_name, description, start_date, end_date, budget, status, created_at)
       VALUES (?, ?, 'Brand Awareness Q3', 'Quarterly awareness and thought leadership.', ?, ?, 75000, 'draft', UTC_TIMESTAMP())`,
      [teamIds[0], userIds[1], ymd(daysFromNow(30)), ymd(daysFromNow(90))]
    );
    const campaignIds = [campaignOne.insertId, campaignTwo.insertId];
    console.log('Campaigns seeded');

    const tags = [
      ['#socialmedia', 'Marketing'],
      ['#marketing', 'Marketing'],
      ['#branding', 'Branding'],
      ['#digital', 'Marketing'],
      ['#content', 'Product'],
      ['#growth', 'Growth'],
      ['#startup', 'Business'],
      ['#business', 'Business'],
      ['#instagram', 'Platform'],
      ['#trending', 'Trending'],
    ];
    const hashtagIds = [];
    for (const [tag, category] of tags) {
      const [result] = await conn.query(
        `INSERT INTO Hashtags (team_id, tag, category, avg_reach, created_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
        [teamIds[0], tag, category, rand(500, 15000)]
      );
      hashtagIds.push(result.insertId);
    }
    console.log('Hashtags seeded');

    const statuses = [
      'published',
      'published',
      'published',
      'scheduled',
      'draft',
      'published',
      'published',
      'scheduled',
      'draft',
      'published',
      'published',
      'published',
      'scheduled',
      'draft',
      'published',
      'published',
      'scheduled',
      'draft',
      'published',
      'published',
    ];
    const postTypes = ['feed', 'story', 'reel', 'carousel'];
    const postIds = [];

    for (let i = 0; i < statuses.length; i += 1) {
      const status = statuses[i];
      const accountId = accountIds[i % 3];
      const publishedAt = status === 'published' ? daysAgo(rand(1, 30)) : null;
      const scheduledAt = status === 'scheduled' ? daysFromNow(rand(1, 7)) : null;
      const campaignId = i < 10 ? campaignIds[0] : null;

      const [result] = await conn.query(
        `INSERT INTO Posts
           (team_id, account_id, campaign_id, created_by, caption, post_type, status, scheduled_at, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [
          teamIds[0],
          accountId,
          campaignId,
          userIds[1],
          `Post #${i + 1}: Fresh creator workflow tips for ${tags[i % tags.length][0]} #creatorflow`,
          postTypes[i % postTypes.length],
          status,
          scheduledAt,
          publishedAt,
        ]
      );
      const postId = result.insertId;
      postIds.push(postId);

      await conn.query(`INSERT INTO PostHashtags (post_id, hashtag_id) VALUES (?, ?)`, [
        postId,
        hashtagIds[i % hashtagIds.length],
      ]);
      await conn.query(`INSERT IGNORE INTO PostHashtags (post_id, hashtag_id) VALUES (?, ?)`, [
        postId,
        hashtagIds[(i + 2) % hashtagIds.length],
      ]);

      if (status === 'scheduled') {
        await conn.query(`INSERT INTO ScheduledPosts (post_id, scheduled_at, timezone) VALUES (?, ?, 'Asia/Kolkata')`, [
          postId,
          scheduledAt,
        ]);
      }

      if (status === 'published') {
        const likes = rand(50, 500);
        const comments = rand(5, 50);
        const shares = rand(2, 30);
        const reach = likes * rand(8, 15);
        const impressions = Math.floor(reach * (Math.random() * 0.8 + 1.2));
        const engagementRate = Number(((likes + comments + shares) / Math.max(reach, 1)).toFixed(4));
        await conn.query(
          `INSERT INTO PostAnalytics
             (post_id, account_id, likes, comments, shares, reach, impressions, clicks, engagement_rate, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [postId, accountId, likes, comments, shares, reach, impressions, rand(10, 100), engagementRate, publishedAt]
        );
      }
    }
    console.log('Posts seeded');

    for (const accountId of accountIds) {
      let followers = rand(2000, 45000);
      for (let day = 60; day >= 0; day -= 1) {
        const date = ymd(daysAgo(day));
        const change = rand(5, 50);
        followers += change;
        await conn.query(
          `INSERT INTO DailyAnalytics
             (account_id, stat_date, total_posts, total_likes, total_comments, total_shares,
              total_reach, total_impressions, follower_count, follower_change, avg_engagement_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            accountId,
            date,
            rand(0, 3),
            rand(50, 350),
            rand(5, 45),
            rand(2, 25),
            rand(500, 6000),
            rand(800, 9000),
            followers,
            change,
            Number((Math.random() * 0.07 + 0.01).toFixed(4)),
          ]
        );
        await conn.query(
          `INSERT INTO FollowersHistory (account_id, recorded_date, follower_count, net_change)
           VALUES (?, ?, ?, ?)`,
          [accountId, date, followers, change]
        );
      }
    }
    console.log('Daily analytics and follower history seeded');

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const accountId of accountIds) {
      for (const day of days) {
        for (const hour of [8, 9, 12, 13, 17, 18, 19, 20]) {
          await conn.query(
            `INSERT INTO BestPostingTimes
               (account_id, day_of_week, hour_of_day, predicted_engagement_rate, confidence_score, sample_size, model_version)
             VALUES (?, ?, ?, ?, ?, ?, 'v1.0')`,
            [accountId, day, hour, Number((Math.random() * 0.08 + 0.01).toFixed(4)), Number((Math.random() * 0.3 + 0.6).toFixed(3)), rand(10, 60)]
          );
        }
      }
    }
    console.log('Best posting times seeded');

    for (let i = 0; i < 20; i += 1) {
      await conn.query(
        `INSERT INTO CampaignAnalytics
           (campaign_id, stat_date, reach, engagement, clicks, impressions, engagement_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [campaignIds[0], ymd(daysAgo(i)), rand(800, 7000), rand(120, 900), rand(20, 160), rand(1200, 10000), Number((Math.random() * 0.07 + 0.01).toFixed(4))]
      );
    }

    for (const hashtagId of hashtagIds) {
      for (let i = 0; i < 14; i += 1) {
        await conn.query(
          `INSERT INTO HashtagAnalytics
             (hashtag_id, stat_date, usage_count, reach, impressions, engagement_rate)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [hashtagId, ymd(daysAgo(i)), rand(1, 8), rand(500, 8000), rand(900, 11000), Number((Math.random() * 0.06 + 0.01).toFixed(4))]
        );
      }
    }

    await conn.query(
      `INSERT INTO Notifications (user_id, type, title, body, reference_id, reference_type, created_at)
       VALUES
       (?, 'analytics_ready', 'Weekly analytics are ready', 'Your latest performance report is ready to review.', NULL, 'Reports', UTC_TIMESTAMP()),
       (?, 'post_failed', 'A post needs attention', 'One scheduled post failed and needs retrying.', ?, 'Posts', UTC_TIMESTAMP())`,
      [userIds[1], userIds[1], postIds[0]]
    );

    await conn.query(
      `INSERT INTO Logs (level, action, user_id, message, metadata, created_at)
       VALUES
       ('info', 'system_config', ?, 'Seeded initial system data', JSON_OBJECT('source', 'seed'), UTC_TIMESTAMP()),
       ('info', 'change_role', ?, 'Admin role verified', JSON_OBJECT('target', ?), UTC_TIMESTAMP())`,
      [userIds[0], userIds[0], userIds[1]]
    );

    await conn.query(
      `INSERT INTO Reports (team_id, created_by, report_type, report_name, format, status, date_from, date_to, generated_at)
       VALUES (?, ?, 'engagement', 'Seed engagement report', 'pdf', 'ready', ?, ?, UTC_TIMESTAMP())`,
      [teamIds[0], userIds[1], ymd(daysAgo(30)), ymd(new Date())]
    );

    await conn.query(
      `INSERT INTO FlaggedPosts (post_id, reason, report_count, status, created_at)
       VALUES (?, 'Spam', 3, 'flagged', UTC_TIMESTAMP())`,
      [postIds[0]]
    );

    await conn.commit();

    console.log('\nDatabase seeded successfully!');
    console.log('\nLogin credentials:');
    console.log('  superadmin@smartsocial.app / Admin@1234');
    console.log('  admin@smartsocial.app      / Admin@1234');
    console.log('  manager@smartsocial.app    / Admin@1234');
    console.log('  manager2@smartsocial.app   / Admin@1234');
    console.log('  viewer@smartsocial.app     / Admin@1234');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
