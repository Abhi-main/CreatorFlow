const bcrypt = require("bcryptjs");

const PASSWORD_ROUNDS = 12;
const defaultPasswordHash = bcrypt.hashSync("Password123!", PASSWORD_ROUNDS);
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isoDaysOffset(days, hours = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

const roles = [
  { id: 1, name: "superadmin" },
  { id: 2, name: "admin" },
  { id: 3, name: "manager" },
  { id: 4, name: "viewer" },
  { id: 5, name: "creator" }
];

const teams = [
  { id: 1, name: "Northern Lights Agency", slug: "northern-lights-agency", plan_name: "Agency Pro", timezone: "Asia/Calcutta" },
  { id: 2, name: "Solo Creator Studio", slug: "solo-creator-studio", plan_name: "Solo", timezone: "Asia/Calcutta" }
];

const users = [
  { id: 1, role_id: 1, team_id: 1, full_name: "Amelia Stone", email: "superadmin@creatorflow.app", password_hash: defaultPasswordHash, avatar_url: "", timezone: "Asia/Calcutta", status: "active" },
  { id: 2, role_id: 2, team_id: 1, full_name: "Ava Brooks", email: "admin@creatorflow.app", password_hash: defaultPasswordHash, avatar_url: "", timezone: "Asia/Calcutta", status: "active" },
  { id: 3, role_id: 3, team_id: 1, full_name: "Marcus Lee", email: "manager1@creatorflow.app", password_hash: defaultPasswordHash, avatar_url: "", timezone: "Asia/Calcutta", status: "active" },
  { id: 4, role_id: 3, team_id: 2, full_name: "Nina Shah", email: "manager2@creatorflow.app", password_hash: defaultPasswordHash, avatar_url: "", timezone: "Asia/Calcutta", status: "active" },
  { id: 5, role_id: 4, team_id: 2, full_name: "Jordan Cruz", email: "viewer@creatorflow.app", password_hash: defaultPasswordHash, avatar_url: "", timezone: "Asia/Calcutta", status: "active" }
];

const teamMembers = [
  { id: 1, team_id: 1, user_id: 1, role_id: 1, title: "Platform Owner", status: "active" },
  { id: 2, team_id: 1, user_id: 2, role_id: 2, title: "Agency Admin", status: "active" },
  { id: 3, team_id: 1, user_id: 3, role_id: 3, title: "Campaign Manager", status: "active" },
  { id: 4, team_id: 2, user_id: 4, role_id: 3, title: "Creator Manager", status: "active" },
  { id: 5, team_id: 2, user_id: 5, role_id: 4, title: "Viewer", status: "active" }
];

const platforms = [
  { id: 1, name: "Instagram", slug: "instagram", icon: "IG", color: "#f97316" },
  { id: 2, name: "Facebook", slug: "facebook", icon: "FB", color: "#2563eb" },
  { id: 3, name: "LinkedIn", slug: "linkedin", icon: "LI", color: "#0f766e" }
];

const socialAccounts = [
  { id: 1, team_id: 1, user_id: 2, platform_id: 1, account_name: "@northernlights.agency", external_account_id: "agency-ig", access_token: "demo-ig", follower_count: 18240, engagement_rate: 5.2, status: "connected", last_synced_at: isoDaysOffset(-1) },
  { id: 2, team_id: 1, user_id: 2, platform_id: 2, account_name: "Northern Lights Agency", external_account_id: "agency-fb", access_token: "demo-fb", follower_count: 9412, engagement_rate: 3.8, status: "connected", last_synced_at: isoDaysOffset(-2) },
  { id: 3, team_id: 1, user_id: 3, platform_id: 3, account_name: "Northern Lights Agency", external_account_id: "agency-li", access_token: "demo-li", follower_count: 6710, engagement_rate: 4.1, status: "connected", last_synced_at: isoDaysOffset(-1) },
  { id: 4, team_id: 2, user_id: 4, platform_id: 1, account_name: "@solocreatorlab", external_account_id: "solo-ig", access_token: "solo-ig", follower_count: 3840, engagement_rate: 6.7, status: "connected", last_synced_at: isoDaysOffset(-1) },
  { id: 5, team_id: 2, user_id: 4, platform_id: 2, account_name: "Solo Creator Studio", external_account_id: "solo-fb", access_token: "solo-fb", follower_count: 2140, engagement_rate: 4.4, status: "connected", last_synced_at: isoDaysOffset(-3) },
  { id: 6, team_id: 2, user_id: 4, platform_id: 3, account_name: "Solo Creator Studio", external_account_id: "solo-li", access_token: "solo-li", follower_count: 1580, engagement_rate: 5.1, status: "connected", last_synced_at: isoDaysOffset(-2) }
];

const campaigns = [
  { id: 1, team_id: 1, owner_user_id: 2, name: "Agency Spring Sprint", objective: "Lead generation", description: "Drive inbound demo requests.", budget: 8500, status: "active", starts_at: isoDaysOffset(-14), ends_at: isoDaysOffset(20) },
  { id: 2, team_id: 2, owner_user_id: 4, name: "Creator Launch Series", objective: "Brand awareness", description: "Promote a new course launch.", budget: 3200, status: "scheduled", starts_at: isoDaysOffset(-7), ends_at: isoDaysOffset(15) }
];

const hashtags = [
  "creatorflow",
  "socialmedia",
  "contentstrategy",
  "creatorbusiness",
  "brandstorytelling",
  "socialanalytics",
  "agencylife",
  "marketingops",
  "launchstrategy",
  "creatoreconomy"
].map((tag, index) => ({
  id: index + 1,
  tag: `#${tag}`,
  category: index < 5 ? "growth" : "campaign",
  usage_count: 10 + index * 4
}));

const mediaFiles = [1, 2, 3, 4, 5].map((id) => ({
  id,
  user_id: id < 4 ? 2 : 4,
  team_id: id < 4 ? 1 : 2,
  file_name: `media-${id}.jpg`,
  original_name: `media-${id}.jpg`,
  file_path: `/uploads/media-${id}.jpg`,
  mime_type: "image/jpeg",
  file_size: 120000 + id * 3000,
  storage_driver: "local"
}));

const posts = Array.from({ length: 20 }, (_, index) => {
  const id = index + 1;
  const team_id = id <= 12 ? 1 : 2;
  const social_account_id = team_id === 1 ? ((id - 1) % 3) + 1 : ((id - 1) % 3) + 4;
  const publishCycle = id % 3;
  const publish_status = publishCycle === 0 ? "draft" : publishCycle === 1 ? "scheduled" : "published";
  const scheduled_for = publish_status === "draft" ? null : isoDaysOffset(publish_status === "published" ? -(id + 1) : id % 5, 9 + (id % 6));
  const published_at = publish_status === "published" ? isoDaysOffset(-(id + 1), 11) : null;

  return {
    id,
    team_id,
    campaign_id: team_id === 1 ? 1 : 2,
    social_account_id,
    author_user_id: team_id === 1 ? 2 : 4,
    title: `${team_id === 1 ? "Agency" : "Creator"} post ${id}`,
    caption: `Caption for post ${id} focused on ${team_id === 1 ? "agency growth" : "creator launch"} and audience engagement.`,
    content_status: publish_status === "draft" ? "draft" : publish_status === "published" ? "published" : "approved",
    approval_status: publish_status === "draft" ? "pending" : "approved",
    publish_status,
    platform_post_id: publish_status === "published" ? `platform_${id}` : null,
    scheduled_for,
    published_at,
    created_at: isoDaysOffset(-(id + 3)),
    updated_at: isoDaysOffset(-(id % 4)),
    recurring_pattern: id % 5 === 0 ? "weekly" : null
  };
});

const scheduledPosts = posts
  .filter((post) => post.publish_status === "scheduled")
  .map((post, index) => ({
    id: index + 1,
    post_id: post.id,
    run_at: post.scheduled_for,
    status: "queued",
    retry_count: 0,
    last_error: null
  }));

const recurringSchedules = [
  { id: 1, team_id: 1, post_id: 5, frequency: "weekly", day_of_week: "Tuesday", hour_of_day: 11, timezone: "Asia/Calcutta", is_active: true },
  { id: 2, team_id: 2, post_id: 15, frequency: "daily", day_of_week: null, hour_of_day: 9, timezone: "Asia/Calcutta", is_active: true }
];

const recurringPostInstances = recurringSchedules.map((schedule, index) => ({
  id: index + 1,
  recurring_schedule_id: schedule.id,
  post_id: schedule.post_id,
  scheduled_for: isoDaysOffset(index + 1),
  status: "queued"
}));

const postAnalytics = posts
  .filter((post) => post.publish_status === "published")
  .map((post, index) => ({
    id: index + 1,
    post_id: post.id,
    impressions: 8000 + index * 420,
    reach_count: 6200 + index * 310,
    likes_count: 280 + index * 18,
    comments_count: 18 + index * 2,
    shares_count: 11 + index,
    saves_count: 6 + index,
    clicks_count: 42 + index * 4,
    engagement_count: 360 + index * 22,
    engagement_rate: Number((4.8 + index * 0.2).toFixed(2)),
    collected_at: isoDaysOffset(-(index + 1))
  }));

const dailyAnalytics = [];
const followersHistory = [];
let dailyId = 1;
let followerHistoryId = 1;
socialAccounts.forEach((account, accountIndex) => {
  for (let day = 59; day >= 0; day -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const followerCount = account.follower_count - 120 + (59 - day) * (accountIndex + 2);
    const impressionBase = 1200 + accountIndex * 140 + (59 - day) * 12;
    const engagement = 130 + accountIndex * 14 + ((59 - day) % 7) * 8;

    dailyAnalytics.push({
      id: dailyId,
      social_account_id: account.id,
      analytics_date: date.toISOString().slice(0, 10),
      impressions: impressionBase,
      reach_count: Math.round(impressionBase * 0.74),
      engagement_count: engagement,
      follower_count: followerCount,
      posts_published: day % 6 === 0 ? 1 : 0
    });

    followersHistory.push({
      id: followerHistoryId,
      social_account_id: account.id,
      follower_count: followerCount,
      captured_at: date.toISOString()
    });

    dailyId += 1;
    followerHistoryId += 1;
  }
});

const weeklyAnalytics = [];
let weeklyId = 1;
socialAccounts.forEach((account) => {
  for (let weekOffset = 0; weekOffset < 8; weekOffset += 1) {
    weeklyAnalytics.push({
      id: weeklyId,
      social_account_id: account.id,
      week_start: isoDaysOffset(-weekOffset * 7).slice(0, 10),
      impressions: 9300 + weekOffset * 220,
      reach_count: 7100 + weekOffset * 180,
      engagement_count: 920 + weekOffset * 45,
      follower_growth: 80 + weekOffset * 4,
      posts_published: 3 + (weekOffset % 3)
    });
    weeklyId += 1;
  }
});

const hashtagAnalytics = hashtags.map((hashtag, index) => ({
  id: index + 1,
  hashtag_id: hashtag.id,
  social_account_id: socialAccounts[index % socialAccounts.length].id,
  impressions: 3200 + index * 260,
  reach_count: 2400 + index * 210,
  engagement_count: 180 + index * 14,
  captured_at: isoDaysOffset(-(index % 10))
}));

const campaignAnalytics = campaigns.map((campaign, index) => ({
  id: index + 1,
  campaign_id: campaign.id,
  impressions: 22000 + index * 4200,
  reach_count: 15600 + index * 2800,
  clicks_count: 740 + index * 80,
  conversions_count: 104 + index * 18,
  spend_amount: campaign.budget * 0.67,
  roi: Number((2.3 + index * 0.5).toFixed(2)),
  captured_at: isoDaysOffset(-index)
}));

const bestPostingTimes = [];
let bestPostingTimeId = 1;
socialAccounts.forEach((account, accountIndex) => {
  weekDays.forEach((day, dayIndex) => {
    bestPostingTimes.push({
      id: bestPostingTimeId,
      social_account_id: account.id,
      platform_id: account.platform_id,
      team_id: account.team_id,
      day_of_week: day,
      best_hour: 6 + ((dayIndex + accountIndex) % 17),
      engagement_score: 72 + ((dayIndex + accountIndex) % 18)
    });
    bestPostingTimeId += 1;
  });
});

const hashtagRecommendations = posts.slice(0, 8).map((post, index) => ({
  id: index + 1,
  team_id: post.team_id,
  post_id: post.id,
  keyword: index % 2 === 0 ? "creator economy" : "product launch",
  suggested_hashtag: hashtags[index].tag,
  score: 80 + index
}));

const captionSuggestions = posts.slice(0, 6).map((post, index) => ({
  id: index + 1,
  team_id: post.team_id,
  post_id: post.id,
  prompt: `Improve caption for ${post.title}`,
  tone: index % 2 === 0 ? "professional" : "playful",
  suggestion: `Refined caption suggestion ${index + 1} for ${post.title}.`
}));

const notifications = [
  { id: 1, user_id: 2, team_id: 1, title: "Post approval needed", body: "Agency post 6 is waiting for review.", variant: "warning", is_read: false, created_at: isoDaysOffset(0) },
  { id: 2, user_id: 2, team_id: 1, title: "Instagram sync complete", body: "Instagram analytics synced successfully.", variant: "success", is_read: false, created_at: isoDaysOffset(-1) },
  { id: 3, user_id: 4, team_id: 2, title: "Recurring schedule created", body: "Daily creator schedule has been activated.", variant: "info", is_read: true, created_at: isoDaysOffset(-2) }
];

const reports = [
  { id: 1, team_id: 1, user_id: 2, report_type: "weekly", report_name: "Agency Weekly Snapshot", file_path: "/reports/agency-weekly.pdf", format: "pdf", status: "completed", generated_at: isoDaysOffset(-2) }
];

const logs = [
  { id: 1, level: "info", source: "auth", message: "Admin login successful", metadata: { userId: 2 }, created_at: isoDaysOffset(-1) },
  { id: 2, level: "info", source: "scheduler", message: "Queued post processed", metadata: { postId: 2 }, created_at: isoDaysOffset(-1) },
  { id: 3, level: "warning", source: "accounts", message: "Manual sync requested", metadata: { accountId: 4 }, created_at: isoDaysOffset(0) }
];

const adminActions = [
  { id: 1, admin_user_id: 1, action_type: "STATUS_CHECK", target_type: "system", target_id: null, payload: {} }
];

const demoState = {
  roles,
  users,
  sessions: [],
  passwordResets: [],
  teams,
  teamMembers,
  platforms,
  socialAccounts,
  mediaFiles,
  campaigns,
  hashtags,
  posts,
  postMedia: [],
  postHashtags: [],
  scheduledPosts,
  recurringSchedules,
  recurringPostInstances,
  postAnalytics,
  dailyAnalytics,
  weeklyAnalytics,
  followersHistory,
  hashtagAnalytics,
  campaignAnalytics,
  bestPostingTimes,
  hashtagRecommendations,
  captionSuggestions,
  notifications,
  reports,
  logs,
  adminActions
};

module.exports = {
  demoState,
  PASSWORD_ROUNDS
};
