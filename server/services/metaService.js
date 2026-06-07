import axios from 'axios';
import pool from '../config/db.js';

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FB_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI;
const GRAPH_URL = 'https://graph.facebook.com/v18.0';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getFacebookAuthUrl = (state = '') => {
  const scopes = [
    'email',
    'public_profile',
    'business_management',
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
      fields: 'id,name,access_token,fan_count,category,tasks,instagram_business_account,connected_instagram_account',
      limit: 100,
      access_token: accessToken,
    },
  });
  return data.data || [];
};

export const getInstagramAccount = async (pageId, pageToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/${pageId}`, {
    params: {
      fields: 'instagram_business_account,connected_instagram_account',
      access_token: pageToken,
    },
  });
  return data.instagram_business_account || data.connected_instagram_account || null;
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

export const getInstagramContainerStatus = async (containerId, accessToken) => {
  const { data } = await axios.get(`${GRAPH_URL}/${containerId}`, {
    params: {
      fields: 'id,status,status_code',
      access_token: accessToken,
    },
  });
  return data;
};

export const publishInstagramPhoto = async ({
  igAccountId, imageUrl, caption, accessToken
}) => {
  try {
    const { data: container } = await axios.post(
      `${GRAPH_URL}/${igAccountId}/media`,
      null,
      { params: { image_url: imageUrl, caption, access_token: accessToken } }
    );

    let containerStatus = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(attempt === 0 ? 1500 : 2000);
      containerStatus = await getInstagramContainerStatus(container.id, accessToken);
      console.log('Instagram container status:', containerStatus);

      if (containerStatus?.status_code === 'FINISHED') {
        break;
      }

      if (containerStatus?.status_code === 'ERROR' || containerStatus?.status === 'ERROR') {
        const failure = new Error(
          `Instagram container processing failed${containerStatus?.status ? `: ${containerStatus.status}` : ''}`
        );
        failure.status = 400;
        throw failure;
      }
    }

    if (containerStatus?.status_code !== 'FINISHED') {
      const timeout = new Error(
        `Instagram media is still processing${containerStatus?.status_code ? ` (${containerStatus.status_code})` : ''}. Please try again in a few seconds.`
      );
      timeout.status = 400;
      throw timeout;
    }

    let lastPublishError = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) {
        await delay(2000);
      }

      try {
        const { data: result } = await axios.post(
          `${GRAPH_URL}/${igAccountId}/media_publish`,
          null,
          { params: { creation_id: container.id, access_token: accessToken } }
        );

        return result;
      } catch (publishError) {
        const metaCode = publishError?.response?.data?.error?.code;
        const metaMessage = publishError?.response?.data?.error?.message;

        if (metaCode === 9007) {
          lastPublishError = publishError;
          console.log(
            `Instagram media_publish retry ${attempt + 1}/5 for container ${container.id}:`,
            metaMessage || 'Media ID is not available yet'
          );
          continue;
        }

        throw publishError;
      }
    }

    throw lastPublishError || new Error('Instagram publish failed');
  } catch (error) {
    const metaMessage = error?.response?.data?.error?.message;
    const metaCode = error?.response?.data?.error?.code;
    const detail = metaMessage
      ? `Instagram publish failed: ${metaMessage}${metaCode ? ` (code ${metaCode})` : ''}`
      : 'Instagram publish failed';
    const wrapped = new Error(detail);
    wrapped.status = error?.response?.status || 500;
    throw wrapped;
  }
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
