import pool from "../config/db.js";
import {
  analyzeEngagementSentiment,
  generateCampaignStrategy,
  generateContentIdeas,
  recommendHashtags,
  suggestCaptions
} from "../services/aiService.js";
import { asyncController, fail, normalizeTag, ok, paged, pageParams } from "./_helpers.js";

export const listHashtags = asyncController(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const orderMap = { avg_reach: "avg_reach", post_count: "post_count", created_at: "created_at" };
  const orderBy = orderMap[req.query.sort] || "created_at";
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM Hashtags WHERE team_id = ?", [req.user.team_id]);
  const [rows] = await pool.query(
    `SELECT h.*, h.hashtag_id AS id, COUNT(ph.post_id) AS post_count,
            COALESCE(AVG(ha.reach), 0) AS avg_reach,
            COALESCE(AVG(ha.engagement_rate), 0) AS avg_engagement
       FROM Hashtags h
       LEFT JOIN PostHashtags ph ON ph.hashtag_id = h.hashtag_id
       LEFT JOIN HashtagAnalytics ha ON ha.hashtag_id = h.hashtag_id
      WHERE h.team_id = ?
      GROUP BY h.hashtag_id
      ORDER BY ${orderBy} DESC
      LIMIT ? OFFSET ?`,
    [req.user.team_id, limit, offset]
  );
  const items = rows.map((row) => ({
    ...row,
    id: row.hashtag_id,
    post_count: Number(row.post_count || 0),
    avg_reach: Number(row.avg_reach || 0),
    avg_engagement: Number(row.avg_engagement || 0)
  }));
  return ok(res, { ...paged(items, total, page, limit), items }, "Hashtags fetched");
});

export const stats = asyncController(async (req, res) => {
  const [[total]] = await pool.query("SELECT COUNT(*) AS total FROM Hashtags WHERE team_id = ?", [req.user.team_id]);
  const [[topReach]] = await pool.query(
    `SELECT h.tag, COALESCE(SUM(ha.reach),0) AS reach FROM Hashtags h
     LEFT JOIN HashtagAnalytics ha ON ha.hashtag_id = h.hashtag_id
     WHERE h.team_id = ? GROUP BY h.hashtag_id ORDER BY reach DESC LIMIT 1`,
    [req.user.team_id]
  );
  const [[avg]] = await pool.query("SELECT COALESCE(AVG(engagement_rate),0) AS avgEngagement FROM HashtagAnalytics ha JOIN Hashtags h ON h.hashtag_id = ha.hashtag_id WHERE h.team_id = ?", [req.user.team_id]);
  const [[mostUsed]] = await pool.query(
    `SELECT h.tag, COUNT(ph.post_id) AS used FROM Hashtags h
     LEFT JOIN PostHashtags ph ON ph.hashtag_id = h.hashtag_id
     WHERE h.team_id = ? GROUP BY h.hashtag_id ORDER BY used DESC LIMIT 1`,
    [req.user.team_id]
  );
  return ok(res, { total: total.total, topReach, avgEngagement: avg.avgEngagement, mostUsed }, "Hashtag stats fetched");
});

export const recommendations = asyncController(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT h.tag, hr.score, hr.expected_reach FROM HashtagRecommendations hr
     JOIN Hashtags h ON h.hashtag_id = hr.hashtag_id
     WHERE hr.post_id = ?
       AND hr.created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
     ORDER BY hr.score DESC`,
    [req.params.postId]
  );
  const useCache = rows.length && req.query.regenerate !== "true";
  const data = useCache ? rows : await recommendHashtags(req.params.postId);
  const hashtags = data.map((item, index) => ({
    id: item.id || item.recommendation_id || `${req.params.postId}-${index}`,
    tag: item.tag,
    suggested_hashtag: item.suggested_hashtag || item.tag,
    score: item.score || item.relevance_score,
    relevance_score: item.relevance_score || item.score,
    expected_reach: item.expected_reach,
    reason: item.reason
  }));

  let captions = [];
  if (req.query.includeCaptions !== "false") {
    const captionSuggestions = await suggestCaptions({
      postId: req.params.postId,
      tone: String(req.query.tone || "professional").toLowerCase(),
      hashtags: hashtags.slice(0, 3).map((item) => item.suggested_hashtag)
    });
    captions = captionSuggestions.map((suggestion, index) => ({
    id: `caption-${index + 1}`,
      suggestion: suggestion.text || suggestion,
      ...((typeof suggestion === "object" && suggestion) || {})
    }));
  }

  return ok(res, { hashtags, captions, source: useCache ? "cached" : "ai" }, "Recommendations fetched");
});

export const suggestCaptionsCtrl = asyncController(async (req, res) => {
  const captions = await suggestCaptions({
    postId: req.body.postId,
    tone: req.body.tone,
    mediaType: req.body.mediaType,
    existingCaption: req.body.existingCaption,
    platform: req.body.platform,
    hashtags: req.body.hashtags || [],
    mediaIds: req.body.mediaIds || [],
    mediaUrls: req.body.mediaUrls || []
  });
  return ok(res, captions, "Captions generated");
});

export const generateContentIdeasCtrl = asyncController(async (req, res) => {
  const ideas = await generateContentIdeas({
    teamId: req.user.team_id,
    accountId: req.body.accountId,
    topic: req.body.topic,
    count: req.body.count
  });
  return ok(res, ideas, "Content ideas generated");
});

export const analyzePostSentimentCtrl = asyncController(async (req, res) => {
  const analysis = await analyzeEngagementSentiment(req.params.postId);
  return ok(res, analysis, "Post sentiment analyzed");
});

export const getCampaignStrategyCtrl = asyncController(async (req, res) => {
  const strategy = await generateCampaignStrategy(req.params.campaignId);
  return ok(res, strategy, "Campaign strategy generated");
});

export const analytics = asyncController(async (req, res) => {
  const clauses = ["hashtag_id = ?"];
  const params = [req.params.id];
  if (req.query.from) { clauses.push("stat_date >= ?"); params.push(req.query.from); }
  if (req.query.to) { clauses.push("stat_date <= ?"); params.push(req.query.to); }
  const [rows] = await pool.query(`SELECT * FROM HashtagAnalytics WHERE ${clauses.join(" AND ")} ORDER BY stat_date ASC`, params);
  return ok(res, rows, "Hashtag analytics fetched");
});

export const createHashtags = asyncController(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.hashtags || [req.body];
  const created = [];
  for (const item of items) {
    const tag = normalizeTag(item.tag);
    if (!tag) continue;
    await pool.query("INSERT IGNORE INTO Hashtags (team_id, tag, category, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())", [req.user.team_id, tag, item.category || "Marketing"]);
    const [[row]] = await pool.query("SELECT * FROM Hashtags WHERE team_id = ? AND tag = ? LIMIT 1", [req.user.team_id, tag]);
    created.push(row);
  }
  const createdItems = created.map((row) => ({ ...row, id: row.hashtag_id }));
  return ok(res, createdItems, `${created.length} hashtags added`, 201);
});

export const updateHashtag = asyncController(async (req, res) => {
  const tag = req.body.tag ? normalizeTag(req.body.tag) : null;
  await pool.query("UPDATE Hashtags SET tag = COALESCE(?, tag), category = COALESCE(?, category) WHERE hashtag_id = ? AND team_id = ?", [tag, req.body.category || null, req.params.id, req.user.team_id]);
  const [[updated]] = await pool.query("SELECT *, hashtag_id AS id FROM Hashtags WHERE hashtag_id = ? AND team_id = ? LIMIT 1", [req.params.id, req.user.team_id]);
  return ok(res, updated || {}, "Hashtag updated");
});

export const deleteHashtag = asyncController(async (req, res) => {
  await pool.query("DELETE FROM Hashtags WHERE hashtag_id = ? AND team_id = ?", [req.params.id, req.user.team_id]);
  return ok(res, {}, "Hashtag deleted");
});
