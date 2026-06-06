const { demoState } = require("../../data/demoData");

function nextId(collectionName) {
  const collection = demoState[collectionName];
  return collection.length ? Math.max(...collection.map((item) => Number(item.id || 0))) + 1 : 1;
}

function getRoleById(roleId) {
  return demoState.roles.find((role) => Number(role.id) === Number(roleId)) || null;
}

function getRoleByName(roleName) {
  return demoState.roles.find((role) => role.name === roleName) || null;
}

function getUserById(userId) {
  return demoState.users.find((user) => Number(user.id) === Number(userId)) || null;
}

function getTeamById(teamId) {
  return demoState.teams.find((team) => Number(team.id) === Number(teamId)) || null;
}

function getPlatformById(platformId) {
  return demoState.platforms.find((platform) => Number(platform.id) === Number(platformId)) || null;
}

function getAccountById(accountId) {
  return demoState.socialAccounts.find((account) => Number(account.id) === Number(accountId)) || null;
}

function getCampaignById(campaignId) {
  return demoState.campaigns.find((campaign) => Number(campaign.id) === Number(campaignId)) || null;
}

function getPostById(postId) {
  return demoState.posts.find((post) => Number(post.id) === Number(postId)) || null;
}

function getHashtagById(hashtagId) {
  return demoState.hashtags.find((hashtag) => Number(hashtag.id) === Number(hashtagId)) || null;
}

function getUserRoleName(user) {
  return getRoleById(user.role_id)?.name || "viewer";
}

function sanitizeUser(user) {
  return {
    id: user.id,
    role_id: user.role_id,
    role_name: getUserRoleName(user),
    team_id: user.team_id,
    full_name: user.full_name,
    email: user.email,
    avatar_url: user.avatar_url || "",
    timezone: user.timezone || "UTC",
    status: user.status
  };
}

function enrichAccount(account) {
  return {
    ...account,
    platform: getPlatformById(account.platform_id)
  };
}

function enrichPost(post) {
  return {
    ...post,
    account: enrichAccount(getAccountById(post.social_account_id)),
    campaign: getCampaignById(post.campaign_id),
    analytics: demoState.postAnalytics.find((analytics) => Number(analytics.post_id) === Number(post.id)) || null
  };
}

function createNotification({ user_id, team_id, title, body, variant = "info" }) {
  demoState.notifications.unshift({
    id: nextId("notifications"),
    user_id: user_id || null,
    team_id: team_id || null,
    title,
    body,
    variant,
    is_read: false,
    created_at: new Date().toISOString()
  });
}

function createLog({ level = "info", source, message, metadata = {} }) {
  demoState.logs.unshift({
    id: nextId("logs"),
    level,
    source,
    message,
    metadata,
    created_at: new Date().toISOString()
  });
}

module.exports = {
  demoState,
  nextId,
  getRoleById,
  getRoleByName,
  getUserById,
  getTeamById,
  getPlatformById,
  getAccountById,
  getCampaignById,
  getPostById,
  getHashtagById,
  getUserRoleName,
  sanitizeUser,
  enrichAccount,
  enrichPost,
  createNotification,
  createLog
};
