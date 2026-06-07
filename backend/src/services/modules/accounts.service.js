const crypto = require("crypto");
const env = require("../../config/env");
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

const META_STATE_TTL_MS = 10 * 60 * 1000;
const SUPPORTED_META_PLATFORMS = new Set(["facebook", "instagram"]);
const metaOAuthStates = new Map();

function nowIso() {
  return new Date().toISOString();
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function cleanupMetaStates() {
  const cutoff = Date.now() - META_STATE_TTL_MS;

  Array.from(metaOAuthStates.entries()).forEach(([key, value]) => {
    if (value.createdAt < cutoff) {
      metaOAuthStates.delete(key);
    }
  });
}

function ensureMetaConfigured() {
  if (!env.meta.appId || !env.meta.appSecret || !env.meta.redirectUri) {
    throw new ApiError(
      400,
      "Meta integration is not configured. Add META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI or API_URL in backend environment variables."
    );
  }
}

function normalizePlatformSlug(platform) {
  return String(platform || "").trim().toLowerCase();
}

function getMetaScopes(platform) {
  return env.meta.scopes[platform] || [];
}

function buildMetaGraphUrl(endpoint, params = {}) {
  const url = new URL(`https://graph.facebook.com/${env.meta.graphVersion}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function fetchMetaJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = parseJsonSafely(await response.text());

  if (!response.ok || payload.error) {
    throw new ApiError(
      502,
      payload.error?.message || "Meta API request failed."
    );
  }

  return payload;
}

function buildMetaState({ teamId, userId, platform }) {
  cleanupMetaStates();

  const state = crypto.randomBytes(18).toString("hex");
  metaOAuthStates.set(state, {
    teamId: Number(teamId),
    userId: Number(userId),
    platform,
    createdAt: Date.now()
  });

  return state;
}

function consumeMetaState(state) {
  cleanupMetaStates();

  const stored = metaOAuthStates.get(state);
  metaOAuthStates.delete(state);

  if (!stored) {
    throw new ApiError(400, "Meta login state is invalid or expired.");
  }

  return stored;
}

function buildSettingsRedirect(params = {}) {
  const url = new URL("/settings", env.appUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  url.hash = "accounts";
  return url.toString();
}

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
    handle: payload.handle || payload.account_name,
    external_account_id: payload.external_account_id || `${platform.slug}-${Date.now()}`,
    access_token: payload.access_token || `mock-token-${platform.slug}`,
    follower_count: Number(payload.follower_count || 0),
    engagement_rate: Number(payload.engagement_rate || 0),
    status: "connected",
    last_synced_at: nowIso(),
    token_expires_at: payload.token_expires_at || null,
    meta_page_id: payload.meta_page_id || null,
    meta_page_name: payload.meta_page_name || null,
    meta_instagram_account_id: payload.meta_instagram_account_id || null,
    meta_connection_type: payload.meta_connection_type || null
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

function findAccountByExternalId(teamId, externalAccountId) {
  return demoState.socialAccounts.find(
    (account) =>
      Number(account.team_id) === Number(teamId)
      && String(account.external_account_id) === String(externalAccountId)
  ) || null;
}

async function exchangeMetaCodeForToken(code) {
  const tokenPayload = await fetchMetaJson(
    buildMetaGraphUrl("/oauth/access_token", {
      client_id: env.meta.appId,
      client_secret: env.meta.appSecret,
      redirect_uri: env.meta.redirectUri,
      code
    })
  );

  let accessToken = tokenPayload.access_token;
  let expiresIn = tokenPayload.expires_in || null;

  try {
    const extendedPayload = await fetchMetaJson(
      buildMetaGraphUrl("/oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: env.meta.appId,
        client_secret: env.meta.appSecret,
        fb_exchange_token: tokenPayload.access_token
      })
    );

    accessToken = extendedPayload.access_token || accessToken;
    expiresIn = extendedPayload.expires_in || expiresIn;
  } catch {
    // Keep the short-lived token when extension is unavailable.
  }

  return {
    accessToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
  };
}

async function fetchMetaPages(userAccessToken) {
  const payload = await fetchMetaJson(
    buildMetaGraphUrl("/me/accounts", {
      access_token: userAccessToken,
      fields: "id,name,access_token,fan_count,connected_instagram_account{id,username,name},instagram_business_account{id,username,name}"
    })
  );

  return payload.data || [];
}

function upsertFacebookAccount({ teamId, userId, page, expiresAt }) {
  const platform = demoState.platforms.find((item) => item.slug === "facebook");
  const existing = findAccountByExternalId(teamId, page.id);

  if (existing) {
    existing.account_name = page.name;
    existing.handle = page.name;
    existing.access_token = page.access_token || existing.access_token;
    existing.follower_count = Number(page.fan_count || existing.follower_count || 0);
    existing.status = "connected";
    existing.last_synced_at = nowIso();
    existing.token_expires_at = expiresAt;
    existing.meta_page_id = page.id;
    existing.meta_page_name = page.name;
    existing.meta_connection_type = "facebook_page";
    return enrichAccount(existing);
  }

  return createAccount(teamId, userId, {
    platform_id: platform.id,
    platform_slug: platform.slug,
    account_name: page.name,
    handle: page.name,
    external_account_id: page.id,
    access_token: page.access_token,
    follower_count: Number(page.fan_count || 0),
    engagement_rate: 0,
    token_expires_at: expiresAt,
    meta_page_id: page.id,
    meta_page_name: page.name,
    meta_connection_type: "facebook_page"
  });
}

function upsertInstagramAccount({ teamId, userId, page, instagramAccount, expiresAt }) {
  const platform = demoState.platforms.find((item) => item.slug === "instagram");
  const existing = findAccountByExternalId(teamId, instagramAccount.id);
  const username = instagramAccount.username || instagramAccount.name || page.name || "instagram";
  const handle = username.startsWith("@") ? username : `@${username}`;

  if (existing) {
    existing.account_name = username;
    existing.handle = handle;
    existing.access_token = page.access_token || existing.access_token;
    existing.status = "connected";
    existing.last_synced_at = nowIso();
    existing.token_expires_at = expiresAt;
    existing.meta_page_id = page.id;
    existing.meta_page_name = page.name;
    existing.meta_instagram_account_id = instagramAccount.id;
    existing.meta_connection_type = "instagram_business";
    return enrichAccount(existing);
  }

  return createAccount(teamId, userId, {
    platform_id: platform.id,
    platform_slug: platform.slug,
    account_name: username,
    handle,
    external_account_id: instagramAccount.id,
    access_token: page.access_token,
    follower_count: 0,
    engagement_rate: 0,
    token_expires_at: expiresAt,
    meta_page_id: page.id,
    meta_page_name: page.name,
    meta_instagram_account_id: instagramAccount.id,
    meta_connection_type: "instagram_business"
  });
}

function buildMetaConnectUrl(teamId, userId, platform) {
  ensureMetaConfigured();

  const platformSlug = normalizePlatformSlug(platform);

  if (!SUPPORTED_META_PLATFORMS.has(platformSlug)) {
    throw new ApiError(400, "Meta connect currently supports only Facebook and Instagram.");
  }

  const state = buildMetaState({ teamId, userId, platform: platformSlug });
  const authUrl = new URL("https://www.facebook.com/latest/dialog/oauth");

  authUrl.searchParams.set("client_id", env.meta.appId);
  authUrl.searchParams.set("redirect_uri", env.meta.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", getMetaScopes(platformSlug).join(","));
  authUrl.searchParams.set("state", state);

  if (env.meta.configId) {
    authUrl.searchParams.set("config_id", env.meta.configId);
  }

  return {
    auth_url: authUrl.toString()
  };
}

async function handleMetaCallback(query) {
  ensureMetaConfigured();

  if (query.error || query.error_message || query.error_description) {
    throw new ApiError(400, query.error_description || query.error_message || "Meta login was cancelled.");
  }

  if (!query.code || !query.state) {
    throw new ApiError(400, "Meta callback is missing the authorization code or state.");
  }

  const state = consumeMetaState(query.state);
  const token = await exchangeMetaCodeForToken(query.code);
  const pages = await fetchMetaPages(token.accessToken);
  let connectedAccounts = [];

  if (state.platform === "facebook") {
    connectedAccounts = pages.map((page) =>
      upsertFacebookAccount({
        teamId: state.teamId,
        userId: state.userId,
        page,
        expiresAt: token.expiresAt
      })
    );
  } else if (state.platform === "instagram") {
    connectedAccounts = pages
      .filter((page) => page.connected_instagram_account || page.instagram_business_account)
      .map((page) =>
        upsertInstagramAccount({
          teamId: state.teamId,
          userId: state.userId,
          page,
          instagramAccount: page.connected_instagram_account || page.instagram_business_account,
          expiresAt: token.expiresAt
        })
      );
  }

  if (!connectedAccounts.length) {
    throw new ApiError(
      400,
      state.platform === "instagram"
        ? "No Instagram Business or Creator account linked to your Facebook Page was found."
        : "No Facebook Pages available for this Meta user were found."
    );
  }

  createNotification({
    user_id: state.userId,
    team_id: state.teamId,
    title: `${state.platform === "instagram" ? "Instagram" : "Facebook"} connected`,
    body: `Connected ${connectedAccounts.length} ${state.platform} account${connectedAccounts.length > 1 ? "s" : ""} via Meta OAuth.`,
    variant: "success"
  });

  createLog({
    source: "accounts",
    message: `Meta OAuth connected ${connectedAccounts.length} ${state.platform} account(s).`,
    metadata: {
      teamId: state.teamId,
      userId: state.userId,
      platform: state.platform,
      accountIds: connectedAccounts.map((account) => account.id)
    }
  });

  return {
    redirectUrl: buildSettingsRedirect({
      meta_status: "connected",
      platform: state.platform,
      count: connectedAccounts.length
    }),
    connectedAccounts
  };
}

async function syncMetaAccount(account) {
  const platform = getPlatformById(account.platform_id)?.slug;

  if (platform === "facebook" && account.meta_page_id && account.access_token) {
    const payload = await fetchMetaJson(
      buildMetaGraphUrl(`/${account.meta_page_id}`, {
        access_token: account.access_token,
        fields: "id,name,fan_count,followers_count"
      })
    );

    account.account_name = payload.name || account.account_name;
    account.handle = payload.name || account.handle;
    account.follower_count = Number(payload.followers_count || payload.fan_count || account.follower_count || 0);
    account.last_synced_at = nowIso();
    return;
  }

  if (platform === "instagram" && account.meta_instagram_account_id && account.access_token) {
    const payload = await fetchMetaJson(
      buildMetaGraphUrl(`/${account.meta_instagram_account_id}`, {
        access_token: account.access_token,
        fields: "id,username,followers_count,media_count"
      })
    );

    const username = payload.username || account.account_name;
    account.account_name = username;
    account.handle = String(username).startsWith("@") ? username : `@${username}`;
    account.follower_count = Number(payload.followers_count || account.follower_count || 0);
    account.last_synced_at = nowIso();
    return;
  }

  account.last_synced_at = nowIso();
  account.follower_count += 12;
}

async function syncAccount(teamId, accountId) {
  const account = getAccountById(accountId);

  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Account not found.");
  }

  await syncMetaAccount(account);

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
  syncAccount,
  buildMetaConnectUrl,
  handleMetaCallback,
  buildSettingsRedirect
};
