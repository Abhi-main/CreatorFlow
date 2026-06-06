const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const {
  demoState,
  nextId,
  getAccountById,
  getPlatformById,
  enrichAccount,
  createNotification,
  createLog
} = require("./store");

function listAccounts(teamId, query) {
  const { page, pageSize } = parsePagination(query);
  const accounts = demoState.socialAccounts
    .filter((account) => Number(account.team_id) === Number(teamId))
    .map(enrichAccount);

  return paginate(accounts, page, pageSize);
}

function createAccount(teamId, userId, payload) {
  const platform = payload.platform_id
    ? getPlatformById(payload.platform_id)
    : demoState.platforms.find((item) => item.slug === payload.platform_slug);

  if (!platform) {
    throw new ApiError(400, "Valid platform information is required.");
  }

  const account = {
    id: nextId("socialAccounts"),
    team_id: Number(teamId),
    user_id: Number(userId),
    platform_id: platform.id,
    account_name: payload.account_name,
    external_account_id: payload.external_account_id || `${platform.slug}-${Date.now()}`,
    access_token: payload.access_token || `mock-token-${platform.slug}`,
    follower_count: Number(payload.follower_count || 0),
    engagement_rate: Number(payload.engagement_rate || 0),
    status: "connected",
    last_synced_at: new Date().toISOString()
  };

  demoState.socialAccounts.push(account);
  createLog({
    source: "accounts",
    message: `Connected ${platform.name} account ${account.account_name}.`,
    metadata: { accountId: account.id, teamId }
  });

  return enrichAccount(account);
}

function deleteAccount(teamId, accountId) {
  const account = getAccountById(accountId);

  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  demoState.socialAccounts = demoState.socialAccounts.filter((item) => Number(item.id) !== Number(accountId));
  return { deleted: true };
}

function syncAccount(teamId, accountId) {
  const account = getAccountById(accountId);

  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  account.last_synced_at = new Date().toISOString();
  account.follower_count += 12;

  demoState.dailyAnalytics.unshift({
    id: nextId("dailyAnalytics"),
    social_account_id: account.id,
    analytics_date: new Date().toISOString().slice(0, 10),
    impressions: 1800,
    reach_count: 1260,
    engagement_count: 210,
    follower_count: account.follower_count,
    posts_published: 1
  });

  createNotification({
    user_id: account.user_id,
    team_id: account.team_id,
    title: "Analytics sync completed",
    body: `${account.account_name} has fresh metrics ready to review.`,
    variant: "success"
  });

  return enrichAccount(account);
}

module.exports = {
  listAccounts,
  createAccount,
  deleteAccount,
  syncAccount
};
