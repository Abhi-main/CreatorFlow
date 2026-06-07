import * as meta from '../services/metaService.js';
import pool from '../config/db.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const stateStore = new Map();

const currentUserId = (req) => req.user?.user_id || req.user?.id || req.user?.sub;

const frontendRedirect = (params = {}) => {
  const url = new URL('/settings', FRONTEND_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  url.hash = 'accounts';
  return url.toString();
};

const absoluteMediaUrl = (req, filePath) => {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const explicitBase = process.env.BACKEND_PUBLIC_URL;
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = explicitBase
    ? null
    : (forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol);
  const base = explicitBase || `${protocol}://${req.get('host')}`;
  return new URL(filePath, base).toString();
};

const createConnectHandler = (platform) => async (req, res, next) => {
  try {
    const state = Buffer.from(JSON.stringify({
      userId: currentUserId(req),
      teamId: req.user.team_id,
      platform,
      ts: Date.now(),
    })).toString('base64url');

    stateStore.set(state, {
      userId: currentUserId(req),
      teamId: req.user.team_id,
      platform,
      expires: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = meta.getFacebookAuthUrl(state);
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    next(err);
  }
};

export const connectFacebook = createConnectHandler('facebook');
export const connectInstagram = createConnectHandler('instagram');

export const facebookCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(frontendRedirect({ error: 'facebook_denied' }));
    }

    const stateData = stateStore.get(state);
    if (!stateData || Date.now() > stateData.expires) {
      return res.redirect(frontendRedirect({ error: 'invalid_state' }));
    }
    stateStore.delete(state);

    const { teamId, platform = 'facebook' } = stateData;
    const shortToken = await meta.exchangeCodeForToken(code);
    const { access_token: longToken } = await meta.getLongLivedToken(shortToken);

    const pages = await meta.getFacebookPages(longToken);
    console.log(
      'Meta pages fetched:',
      pages.map((page) => ({
        id: page.id,
        name: page.name,
        category: page.category,
        tasks: page.tasks,
        hasInstagramBusiness: Boolean(page.instagram_business_account),
        hasConnectedInstagram: Boolean(page.connected_instagram_account),
      }))
    );

    const [fbPlatforms] = await pool.query(
      "SELECT platform_id FROM Platforms WHERE name = 'Facebook'"
    );
    const [igPlatforms] = await pool.query(
      "SELECT platform_id FROM Platforms WHERE name = 'Instagram'"
    );
    const fbPlatformId = fbPlatforms[0]?.platform_id;
    const igPlatformId = igPlatforms[0]?.platform_id;

    let connectedCount = 0;

    for (const page of pages) {
      const pageToken = page.access_token || longToken;

      if (fbPlatformId) {
        await meta.saveConnectedAccount({
          teamId,
          platformId: fbPlatformId,
          handle: String(page.id),
          name: page.name,
          type: 'business',
          accessToken: pageToken,
          followerCount: page.fan_count || 0,
        });
        connectedCount += 1;
      }

      const igAccount = page.instagram_business_account
        || page.connected_instagram_account
        || await meta.getInstagramAccount(page.id, pageToken);
      if (igAccount && igPlatformId) {
        const igProfile = await meta.getInstagramProfile(igAccount.id, pageToken);
        await meta.saveConnectedAccount({
          teamId,
          platformId: igPlatformId,
          handle: String(igAccount.id),
          name: igProfile.name || igProfile.username || `@${igAccount.id}`,
          type: 'business',
          accessToken: pageToken,
          followerCount: igProfile.followers_count || 0,
        });
        connectedCount += 1;
      }
    }

    return res.redirect(frontendRedirect({ connected: platform, count: connectedCount }));
  } catch (err) {
    console.error('Facebook callback error:', err.message);
    return res.redirect(frontendRedirect({ error: 'facebook_failed' }));
  }
};

export const instagramCallback = async (req, res, next) => facebookCallback(req, res, next);

export const publishToFacebook = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const [posts] = await pool.query(
      `SELECT p.*, sa.access_token, sa.account_handle
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       WHERE p.post_id = ? AND p.team_id = ?`,
      [postId, req.user.team_id]
    );

    if (!posts.length) {
      return res.status(404).json({ success: false, error: 'Post not found', code: 404 });
    }

    const post = posts[0];
    const [media] = await pool.query(
      `SELECT mf.public_url
       FROM PostMedia pm
       JOIN MediaFiles mf ON mf.media_id = pm.media_id
       WHERE pm.post_id = ? LIMIT 1`,
      [postId]
    );

    const result = await meta.publishFacebookPost({
      pageId: post.account_handle.replace('@', ''),
      message: post.caption,
      imageUrl: absoluteMediaUrl(req, media[0]?.public_url),
      accessToken: post.access_token,
    });

    await pool.query(
      `UPDATE Posts SET status='published', published_at=UTC_TIMESTAMP(),
       platform_post_id=? WHERE post_id=?`,
      [result.id || result.post_id, postId]
    );

    return res.json({ success: true, data: result, message: 'Published to Facebook!' });
  } catch (err) {
    next(err);
  }
};

export const publishToInstagram = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const [posts] = await pool.query(
      `SELECT p.*, sa.access_token, sa.account_handle
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       WHERE p.post_id = ? AND p.team_id = ?`,
      [postId, req.user.team_id]
    );

    if (!posts.length) {
      return res.status(404).json({ success: false, error: 'Post not found', code: 404 });
    }

    const post = posts[0];
    const [media] = await pool.query(
      `SELECT mf.public_url
       FROM PostMedia pm
       JOIN MediaFiles mf ON mf.media_id = pm.media_id
       WHERE pm.post_id = ? LIMIT 1`,
      [postId]
    );

    if (!media.length) {
      return res.status(400).json({
        success: false,
        error: 'Instagram requires an image',
        code: 400,
      });
    }

    const result = await meta.publishInstagramPhoto({
      igAccountId: post.account_handle.replace('@', ''),
      imageUrl: absoluteMediaUrl(req, media[0].public_url),
      caption: post.caption,
      accessToken: post.access_token,
    });

    await pool.query(
      `UPDATE Posts SET status='published', published_at=UTC_TIMESTAMP(),
       platform_post_id=? WHERE post_id=?`,
      [result.id, postId]
    );

    return res.json({ success: true, data: result, message: 'Published to Instagram!' });
  } catch (err) {
    next(err);
  }
};

export const getFacebookAccountInsights = async (req, res, next) => {
  try {
    const [accounts] = await pool.query(
      `SELECT * FROM SocialAccounts WHERE account_id=? AND team_id=?`,
      [req.params.accountId, req.user.team_id]
    );
    if (!accounts.length) {
      return res.status(404).json({ success: false, error: 'Account not found', code: 404 });
    }

    const insights = await meta.getFacebookInsights(
      accounts[0].account_handle.replace('@', ''),
      accounts[0].access_token
    );
    return res.json({ success: true, data: insights });
  } catch (err) {
    next(err);
  }
};

export const getInstagramAccountInsights = async (req, res, next) => {
  try {
    const [accounts] = await pool.query(
      `SELECT * FROM SocialAccounts WHERE account_id=? AND team_id=?`,
      [req.params.accountId, req.user.team_id]
    );
    if (!accounts.length) {
      return res.status(404).json({ success: false, error: 'Account not found', code: 404 });
    }

    const insights = await meta.getInstagramInsights(
      accounts[0].account_handle.replace('@', ''),
      accounts[0].access_token
    );
    return res.json({ success: true, data: insights });
  } catch (err) {
    next(err);
  }
};

export const syncMetaAccount = async (req, res, next) => {
  try {
    const [accounts] = await pool.query(
      `SELECT sa.*, pl.name as platform
       FROM SocialAccounts sa
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
       WHERE sa.account_id=? AND sa.team_id=?`,
      [req.params.accountId, req.user.team_id]
    );
    if (!accounts.length) {
      return res.status(404).json({ success: false, error: 'Account not found', code: 404 });
    }

    const account = accounts[0];
    let insights = [];

    if (account.platform === 'Instagram') {
      insights = await meta.getInstagramInsights(
        account.account_handle.replace('@', ''),
        account.access_token
      );
    } else if (account.platform === 'Facebook') {
      insights = await meta.getFacebookInsights(
        account.account_handle.replace('@', ''),
        account.access_token
      );
    }

    await pool.query(
      `UPDATE SocialAccounts SET last_synced_at=UTC_TIMESTAMP() WHERE account_id=?`,
      [req.params.accountId]
    );

    return res.json({ success: true, data: insights, message: 'Synced successfully!' });
  } catch (err) {
    next(err);
  }
};
