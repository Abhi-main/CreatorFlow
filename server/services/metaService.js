import axios from 'axios';
import pool from '../config/db.js';

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FB_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI;
const GRAPH_URL = 'https://graph.facebook.com/v18.0';

export const getFacebookAuthUrl = (state = '') => {
  const scopes = [
    'email',
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
  ].join(',');

  return `https://www.facebook.com/v18.0/dialog/oauth`
    + `?client_id=${FB_APP_ID}`
    + `&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}`
    + `&scope=${scopes}`
    + `&response_type=code`
    + `&state=${state}`;
};

export const exchangeCodeForToken = async (code) => {
  const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      redirect_uri: FB_REDIRECT_URI,
      code,
    },
  });
  return data.access_token;
};

export const getLongLivedToken = async (shortToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  return data;
};

export const getFacebookProfile = async (accessToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/me`, {
    params: {
      fields: 'id,name,email,picture',
      access_token: accessToken,
    },
  });
  return data;
};

export const getFacebookPages = async (accessToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,fan_count',
      access_token: accessToken,
    },
  });
  return data.data || [];
};

export const getInstagramAccount = async (pageId, pageToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/${pageId}`, {
    params: {
      fields: 'instagram_business_account',
      access_token: pageToken,
    },
  });
  return data.instagram_business_account || null;
};

export const getInstagramProfile = async (igId, accessToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/${igId}`, {
    params: {
      fields: 'id,name,username,profile_picture_url,followers_count,biography',
      access_token: accessToken,
    },
  });
  return data;
};

export const publishInstagramPhoto = async ({
  igAccountId, imageUrl, caption, accessToken
}) => {
  const { data: container } = await axios.post(
    `${GRAPH_URL}/${igAccountId}/media`,
    null,
    { params: { image_url: imageUrl, caption, access_token: accessToken } }
  );

  const { data: result } = await axios.post(
    `${GRAPH_URL}/${igAccountId}/media_publish`,
    null,
    { params: { creation_id: container.id, access_token: accessToken } }
  );

  return result;
};

export const publishFacebookPost = async ({
  pageId, message, imageUrl, accessToken
}) => {
  const endpoint = imageUrl
    ? `${GRAPH_URL}/${pageId}/photos`
    : `${GRAPH_URL}/${pageId}/feed`;
  const params = imageUrl
    ? { message, url: imageUrl, access_token: accessToken }
    : { message, access_token: accessToken };

  const { data } = await axios.post(endpoint, null, { params });
  return data;
};

export const getInstagramInsights = async (igId, accessToken) => {
  try {
    const { data } = await axios.get(`${GRAPH_URL}/${igId}/insights`, {
      params: {
        metric: 'impressions,reach,follower_count,profile_views',
        period: 'day',
        access_token: accessToken,
      },
    });
    return data.data || [];
  } catch {
    return [];
  }
};

export const getFacebookInsights = async (pageId, accessToken) => {
  try {
    const { data } = await axios.get(`${GRAPH_URL}/${pageId}/insights`, {
      params: {
        metric: 'page_impressions,page_reach,page_engaged_users,page_fan_adds',
        period: 'day',
        access_token: accessToken,
      },
    });
    return data.data || [];
  } catch {
    return [];
  }
};

export const saveConnectedAccount = async ({
  teamId, platformId, handle, name, type,
  accessToken, followerCount
}) => {
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + 60);

  const [existing] = await pool.query(
    `SELECT account_id FROM SocialAccounts
     WHERE team_id = ? AND platform_id = ? AND account_handle = ?`,
    [teamId, platformId, handle]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE SocialAccounts SET
         access_token = ?, token_expires_at = ?,
         follower_count = ?, last_synced_at = UTC_TIMESTAMP(),
         is_active = true, updated_at = UTC_TIMESTAMP()
       WHERE account_id = ?`,
      [accessToken, tokenExpiry, followerCount || 0, existing[0].account_id]
    );
    return existing[0].account_id;
  }

  const [result] = await pool.query(
    `INSERT INTO SocialAccounts
     (team_id, platform_id, account_handle, account_name, account_type,
      access_token, token_expires_at, follower_count,
      is_active, created_at, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [teamId, platformId, handle, name, type, accessToken, tokenExpiry, followerCount || 0]
  );
  return result.insertId;
};
