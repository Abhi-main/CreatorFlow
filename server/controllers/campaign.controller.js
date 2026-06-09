import pool from "../config/db.js";
import { asyncController, fail, ok, paged, pageParams } from "./_helpers.js";

async function findCampaign(id, teamId) {
  const [[campaign]] = await pool.query("SELECT * FROM Campaigns WHERE campaign_id = ? AND team_id = ? LIMIT 1", [id, teamId]);
  return campaign;
}

function mapCampaign(campaign) {
  if (!campaign) return null;
  return {
    ...campaign,
    id: campaign.campaign_id,
    name: campaign.campaign_name || campaign.name,
    starts_at: campaign.start_date || campaign.starts_at || null,
    ends_at: campaign.end_date || campaign.ends_at || null,
  };
}

export const listCampaigns = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM Campaigns WHERE team_id = ? AND status <> 'archived'", [req.user.team_id]);
  const [rows] = await pool.query(
    `SELECT c.*, c.campaign_id AS id, c.campaign_name AS name,
            COUNT(DISTINCT p.post_id) AS post_count,
            COALESCE(SUM(ca.reach), 0) AS total_reach
       FROM Campaigns c
       LEFT JOIN Posts p ON p.campaign_id = c.campaign_id
       LEFT JOIN CampaignAnalytics ca ON ca.campaign_id = c.campaign_id
      WHERE c.team_id = ? AND c.status <> 'archived'
      GROUP BY c.campaign_id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
    [req.user.team_id, limit, offset]
  );
  const items = rows.map((row) => ({
    ...mapCampaign(row),
    post_count: Number(row.post_count || 0),
    posts_count: Number(row.post_count || 0),
    total_reach: Number(row.total_reach || 0)
  }));
  return ok(res, { ...paged(items, total, page, limit), items }, "Campaigns fetched");
});

export const stats = asyncController(async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(status = 'active') AS active,
            COALESCE(SUM(ca.reach), 0) AS totalReach,
            COALESCE(AVG(ca.engagement_rate), 0) AS avgEngagementRate
       FROM Campaigns c LEFT JOIN CampaignAnalytics ca ON ca.campaign_id = c.campaign_id
      WHERE c.team_id = ?`,
    [req.user.team_id]
  );
  return ok(res, row, "Campaign stats fetched");
});

export const getCampaign = asyncController(async (req, res) => {
  const campaign = await findCampaign(req.params.id, req.user.team_id);
  if (!campaign) return fail(res, "Campaign not found", 404);
  return ok(res, mapCampaign(campaign), "Campaign fetched");
});

export const analytics = asyncController(async (req, res) => {
  const campaign = await findCampaign(req.params.id, req.user.team_id);
  if (!campaign) return fail(res, "Campaign not found", 404);
  const [daily] = await pool.query("SELECT * FROM CampaignAnalytics WHERE campaign_id = ? ORDER BY stat_date ASC", [req.params.id]);
  const [[summary]] = await pool.query("SELECT * FROM vw_CampaignSummary WHERE campaign_id = ? LIMIT 1", [req.params.id]);
  const [posts] = await pool.query(
    `SELECT p.*,
            p.status AS publish_status,
            pa.likes,
            pa.comments,
            pa.shares,
            pa.reach,
            pa.impressions,
            pa.clicks,
            pa.engagement_rate,
            pa.created_at AS analytics_created_at
       FROM Posts p
       LEFT JOIN (
         SELECT pa1.*
           FROM PostAnalytics pa1
           JOIN (
             SELECT post_id, MAX(analytics_id) AS latest_id
               FROM PostAnalytics
              GROUP BY post_id
           ) latest ON latest.latest_id = pa1.analytics_id
       ) pa ON pa.post_id = p.post_id
      WHERE p.campaign_id = ?
      ORDER BY p.created_at DESC`,
    [req.params.id]
  );

  const normalizedPosts = posts.map((post) => ({
    ...post,
    title: post.caption,
    scheduled_for: post.scheduled_at || null,
    analytics: {
      likes_count: Number(post.likes || 0),
      comments_count: Number(post.comments || 0),
      shares_count: Number(post.shares || 0),
      reach_count: Number(post.reach || 0),
      impressions: Number(post.impressions || 0),
      clicks: Number(post.clicks || 0),
      clicks_count: Number(post.clicks || 0),
      engagement_rate: Number(post.engagement_rate || 0),
      engagement_count: Number(post.likes || 0) + Number(post.comments || 0) + Number(post.shares || 0),
      collected_at: post.analytics_created_at
    }
  }));
  const normalizedSummary = summary
    ? {
        ...summary,
        reach_count: Number(summary.total_reach || 0),
        engagement_count: Number(summary.total_engagement || 0),
        clicks_count: Number(summary.total_clicks || 0),
      }
    : null;
  const normalizedDaily = daily.map((row) => ({
    ...row,
    collected_at: row.stat_date,
    reach_count: Number(row.reach || 0),
    engagement_count: Number(row.engagement || 0),
    clicks_count: Number(row.clicks || 0),
  }));

  return ok(res, { summary: normalizedSummary, daily: normalizedDaily, posts: normalizedPosts }, "Campaign analytics fetched");
});

export const createCampaign = asyncController(async (req, res) => {
  const name = req.body.campaign_name || req.body.name;
  if (!name || !req.body.start_date && !req.body.starts_at) return fail(res, "Campaign name and start date are required", 400);
  const [created] = await pool.query(
    `INSERT INTO Campaigns (team_id, created_by, campaign_name, description, start_date, end_date, budget, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [req.user.team_id, req.user.sub || req.user.id, name, req.body.description || "", req.body.start_date || req.body.starts_at, req.body.end_date || req.body.ends_at, req.body.budget || 0, req.body.status || "draft"]
  );
  return ok(res, { campaign_id: created.insertId, id: created.insertId, name, starts_at: req.body.start_date || req.body.starts_at, ends_at: req.body.end_date || req.body.ends_at }, "Campaign created", 201);
});

export const updateCampaign = asyncController(async (req, res) => {
  const campaign = await findCampaign(req.params.id, req.user.team_id);
  if (!campaign) return fail(res, "Campaign not found", 404);
  await pool.query(
    `UPDATE Campaigns SET campaign_name = COALESCE(?, campaign_name), description = COALESCE(?, description),
            start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), budget = COALESCE(?, budget),
            status = COALESCE(?, status), updated_at = UTC_TIMESTAMP()
      WHERE campaign_id = ? AND team_id = ?`,
    [req.body.campaign_name || req.body.name || null, req.body.description || null, req.body.start_date || null, req.body.end_date || null, req.body.budget ?? null, req.body.status || null, req.params.id, req.user.team_id]
  );
  return getCampaign(req, res);
});

export const deleteCampaign = asyncController(async (req, res) => {
  const campaign = await findCampaign(req.params.id, req.user.team_id);
  if (!campaign) return fail(res, "Campaign not found", 404);
  await pool.query("UPDATE Campaigns SET status = 'archived', updated_at = UTC_TIMESTAMP() WHERE campaign_id = ? AND team_id = ?", [req.params.id, req.user.team_id]);
  return ok(res, {}, "Campaign archived");
});
