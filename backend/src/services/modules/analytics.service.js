const ApiError = require("../../utils/ApiError");
const {
  demoState,
  getAccountById,
  getCampaignById,
  enrichPost
} = require("./store");

function getDashboard(teamId) {
  const accountIds = demoState.socialAccounts
    .filter((account) => Number(account.team_id) === Number(teamId))
    .map((account) => account.id);

  const posts = demoState.posts
    .filter((post) => Number(post.team_id) === Number(teamId))
    .map(enrichPost);
  const publishedAnalytics = demoState.postAnalytics.filter((analytics) =>
    posts.some((post) => Number(post.id) === Number(analytics.post_id))
  );
  const daily = demoState.dailyAnalytics.filter((item) => accountIds.includes(item.social_account_id));
  const last30 = daily.slice(-30);
  const last7 = daily.slice(-7);
  const followers = last30.map((item) => ({
    date: item.analytics_date,
    follower_count: item.follower_count
  }));
  const dailyEngagement = last7.map((item) => ({
    date: item.analytics_date,
    engagement_count: item.engagement_count
  }));

  return {
    summary: {
      totalPosts: posts.length,
      totalReach: publishedAnalytics.reduce((sum, item) => sum + Number(item.reach_count || 0), 0),
      followers: accountIds.reduce((sum, accountId) => sum + Number(getAccountById(accountId)?.follower_count || 0), 0),
      avgEngagementRate: publishedAnalytics.length
        ? Number(
            (
              publishedAnalytics.reduce((sum, item) => sum + Number(item.engagement_rate || 0), 0) /
              publishedAnalytics.length
            ).toFixed(2)
          )
        : 0
    },
    followerGrowth: followers,
    dailyEngagement,
    upcomingPosts: posts
      .filter((post) => post.publish_status === "scheduled")
      .sort((left, right) => new Date(left.scheduled_for) - new Date(right.scheduled_for))
      .slice(0, 5),
    recentNotifications: demoState.notifications
      .filter((item) => Number(item.team_id) === Number(teamId))
      .slice(0, 5)
  };
}

function getPostAnalytics(teamId, accountId) {
  const account = getAccountById(accountId);
  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  return demoState.posts
    .filter((post) => Number(post.social_account_id) === Number(accountId))
    .map((post) => ({
      ...enrichPost(post),
      analytics: demoState.postAnalytics.find((item) => Number(item.post_id) === Number(post.id)) || null
    }));
}

function getDailyAnalytics(teamId, accountId, query) {
  const account = getAccountById(accountId);
  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  let items = demoState.dailyAnalytics.filter((item) => Number(item.social_account_id) === Number(accountId));

  if (query.startDate) {
    items = items.filter((item) => item.analytics_date >= query.startDate);
  }
  if (query.endDate) {
    items = items.filter((item) => item.analytics_date <= query.endDate);
  }

  return items;
}

function getWeeklyAnalytics(teamId, accountId) {
  const account = getAccountById(accountId);
  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  return demoState.weeklyAnalytics.filter((item) => Number(item.social_account_id) === Number(accountId));
}

function getFollowerHistory(teamId, accountId) {
  const account = getAccountById(accountId);
  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  return demoState.followersHistory.filter((item) => Number(item.social_account_id) === Number(accountId));
}

function getBestTimes(teamId, accountId) {
  const account = getAccountById(accountId);
  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  return demoState.bestPostingTimes.filter((item) => Number(item.social_account_id) === Number(accountId));
}

function getCampaignAnalytics(teamId, campaignId) {
  const campaign = getCampaignById(campaignId);
  if (!campaign || Number(campaign.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Campaign not found.");
  }

  const summary = demoState.campaignAnalytics.find((item) => Number(item.campaign_id) === Number(campaignId));
  const relatedPosts = demoState.posts
    .filter((post) => Number(post.campaign_id) === Number(campaignId))
    .map(enrichPost);

  return {
    summary,
    posts: relatedPosts,
    daily: relatedPosts
      .map((post) => demoState.postAnalytics.find((analytics) => Number(analytics.post_id) === Number(post.id)))
      .filter(Boolean)
  };
}

module.exports = {
  getDashboard,
  getPostAnalytics,
  getDailyAnalytics,
  getWeeklyAnalytics,
  getFollowerHistory,
  getBestTimes,
  getCampaignAnalytics
};
