/**
 * AI Service - powered by Gemini.
 * Handles hashtag recommendations, caption generation, posting-time analysis,
 * content ideas, post performance insights, and campaign strategy.
 */
const pool = require("../config/db");

const dbQuery = pool.query.bind(pool);
pool.query = async (...args) => [await dbQuery(...args)];
pool.getConnection = async () => pool.getPool().getConnection();

function normalizeTag(value) {
  if (!value) return "";
  const tag = String(value).trim().toLowerCase();
  return tag.startsWith("#") ? tag : `#${tag}`;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const getApiKey = () => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "AIzaSy-your-key-here") {
    const error = new Error("GEMINI_API_KEY is not configured.");
    error.status = 503;
    throw error;
  }

  return process.env.GEMINI_API_KEY;
};

const callGemini = async (systemPrompt, userPrompt, maxTokens = 600) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey()
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json"
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Gemini request failed.");
    error.status = response.status;
    throw error;
  }

  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
};

const parseJSON = (text) => {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (error) {
    error.message = `Gemini returned invalid JSON: ${error.message}`;
    error.status = 502;
    throw error;
  }
};

const dayMap = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
  Mon: "Mon",
  Tue: "Tue",
  Wed: "Wed",
  Thu: "Thu",
  Fri: "Fri",
  Sat: "Sat",
  Sun: "Sun"
};

const normalizeScore = (value, fallback = 0.7) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
};

const recommendHashtags = async (postId) => {
  const [posts] = await pool.query(
    `SELECT p.post_id, p.team_id, p.account_id, p.caption, p.post_type, pl.name AS platform
       FROM Posts p
       JOIN SocialAccounts sa ON sa.account_id = p.account_id
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
      WHERE p.post_id = ?
      LIMIT 1`,
    [postId]
  );

  if (!posts.length) throw new Error("Post not found");
  const post = posts[0];

  const systemPrompt = `You are a social media expert specializing in hashtag strategy.
Recommend highly relevant, engagement-driving hashtags.
Always respond with valid JSON only - no explanation, no markdown.`;

  const userPrompt = `Recommend 12 hashtags for this ${post.platform} ${post.post_type} post.
Caption: "${post.caption || "No caption yet"}"

Return JSON in this exact format:
{
  "hashtags": [
    {
      "tag": "#example",
      "relevance_score": 0.95,
      "reason": "Why this hashtag fits"
    }
  ]
}

Mix of 3 high-reach broad tags, 5 medium niche tags, and 4 very specific tags.
All tags must be lowercase and include the # symbol.`;

  const parsed = parseJSON(await callGemini(systemPrompt, userPrompt, 700));
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM HashtagRecommendations WHERE post_id = ?", [postId]);

    for (const item of hashtags) {
      const tag = normalizeTag(item.tag);
      if (!tag) continue;

      await conn.query(
        "INSERT IGNORE INTO Hashtags (team_id, tag, category, created_at) VALUES (?, ?, 'AI', UTC_TIMESTAMP())",
        [post.team_id, tag]
      );

      const [[hashtag]] = await conn.query(
        "SELECT hashtag_id FROM Hashtags WHERE team_id = ? AND tag = ? LIMIT 1",
        [post.team_id, tag]
      );

      if (!hashtag) continue;

      const score = normalizeScore(item.relevance_score);
      const expectedReach = Math.round(5000 + score * 15000);
      await conn.query(
        `INSERT INTO HashtagRecommendations (post_id, account_id, hashtag_id, score, expected_reach, created_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           score = VALUES(score),
           expected_reach = VALUES(expected_reach),
           created_at = UTC_TIMESTAMP()`,
        [postId, post.account_id, hashtag.hashtag_id, score, expectedReach]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return hashtags.map((item) => ({
    ...item,
    tag: normalizeTag(item.tag),
    relevance_score: normalizeScore(item.relevance_score)
  }));
};

const suggestCaptions = async ({
  postId = null,
  tone = "casual",
  mediaType = "image",
  existingCaption = "",
  platform = "instagram",
  hashtags = []
} = {}) => {
  const toneGuides = {
    professional: "formal, authoritative, business-focused, no slang",
    casual: "friendly, conversational, relatable, use contractions",
    humorous: "witty, playful, light-hearted, include a joke or pun if it fits",
    inspirational: "motivating, uplifting, emotional, end with a powerful statement",
    promotional: "compelling, benefit-focused, includes a clear call-to-action"
  };

  const platformGuides = {
    instagram: "use emojis, line breaks, and end with hashtag placeholder [HASHTAGS]",
    facebook: "conversational, slightly longer, ask a question to drive comments",
    linkedin: "professional tone, add value, start with a hook, no excessive emojis"
  };

  const normalizedTone = String(tone || "casual").toLowerCase();
  const normalizedPlatform = String(platform || "instagram").toLowerCase();

  const systemPrompt = `You are an expert social media copywriter.
Write captions that drive high engagement on ${normalizedPlatform}.
Always respond with valid JSON only - no explanation, no markdown.`;

  const userPrompt = `Write 3 different captions with tone: ${normalizedTone}
Tone guide: ${toneGuides[normalizedTone] || toneGuides.casual}
Platform guide: ${platformGuides[normalizedPlatform] || platformGuides.instagram}
Media type: ${mediaType || "image"}
${existingCaption ? `Existing caption to improve: "${existingCaption}"` : ""}
${hashtags.length ? `Suggested hashtags to consider: ${hashtags.join(" ")}` : ""}

Return JSON in this exact format:
{
  "captions": [
    {
      "text": "Full caption text here...",
      "tone": "${normalizedTone}",
      "hook": "Opening line explanation",
      "cta": "Call to action used",
      "estimated_engagement": "high|medium|low"
    }
  ]
}`;

  const parsed = parseJSON(await callGemini(systemPrompt, userPrompt, 900));
  const captions = Array.isArray(parsed.captions) ? parsed.captions : [];

  await pool.query(
    "INSERT INTO CaptionSuggestions (tone, media_type, hashtags, suggestions, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
    [
      normalizedTone,
      postId ? `post:${postId}:${mediaType || "image"}` : mediaType || "image",
      JSON.stringify(hashtags || []),
      JSON.stringify(captions)
    ]
  );

  return captions;
};

const computeBestPostingTimes = async (accountId) => {
  const [data] = await pool.query(
    `SELECT
       DAYNAME(p.published_at) AS day_of_week,
       HOUR(p.published_at) AS hour_of_day,
       AVG(pa.engagement_rate) AS avg_engagement,
       COUNT(*) AS post_count
     FROM Posts p
     JOIN PostAnalytics pa ON pa.post_id = p.post_id
     WHERE p.account_id = ?
       AND p.status = 'published'
       AND p.published_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
     GROUP BY DAYNAME(p.published_at), HOUR(p.published_at)
     HAVING post_count >= 2
     ORDER BY avg_engagement DESC`,
    [accountId]
  );

  if (data.length < 3) {
    const [accounts] = await pool.query(
      `SELECT sa.account_type, pl.name AS platform
       FROM SocialAccounts sa
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
       WHERE sa.account_id = ?
       LIMIT 1`,
      [accountId]
    );
    const account = accounts[0];

    const systemPrompt = `You are a social media analytics expert.
Recommend best posting times based on platform research.
Always respond with valid JSON only.`;

    const userPrompt = `Recommend best posting times for a ${account?.account_type || "business"} account on ${account?.platform || "Instagram"}.
Return the top 8 time slots.

Return JSON:
{
  "slots": [
    {
      "day_of_week": "Mon",
      "hour_of_day": 9,
      "predicted_engagement_rate": 0.045,
      "confidence_score": 0.72,
      "reason": "Monday morning commute browsing"
    }
  ]
}`;

    const parsed = parseJSON(await callGemini(systemPrompt, userPrompt, 700));
    const slots = Array.isArray(parsed.slots) ? parsed.slots : [];
    await saveBestTimeSlots(accountId, slots, 0, `${MODEL}-general`);
    return slots;
  }

  const systemPrompt = `You are a social media analytics AI.
Analyze real engagement data and predict the best posting times.
Always respond with valid JSON only.`;

  const userPrompt = `Analyze this real engagement data and rank the best posting times.
Data: ${JSON.stringify(data.slice(0, 20))}

Return JSON:
{
  "analysis": "Brief insight about this account's peak times",
  "slots": [
    {
      "day_of_week": "Mon",
      "hour_of_day": 9,
      "predicted_engagement_rate": 0.052,
      "confidence_score": 0.88,
      "insight": "Your audience is most active Monday mornings"
    }
  ]
}`;

  const parsed = parseJSON(await callGemini(systemPrompt, userPrompt, 900));
  const slots = Array.isArray(parsed.slots) ? parsed.slots : [];
  await saveBestTimeSlots(accountId, slots, data.length, `${MODEL}-data`);
  return { analysis: parsed.analysis || "", slots };
};

async function saveBestTimeSlots(accountId, slots, sampleSize, modelVersion) {
  const conn = await pool.getConnection();
  try {
    for (const slot of slots) {
      await conn.query(
        `INSERT INTO BestPostingTimes
           (account_id, day_of_week, hour_of_day, predicted_engagement_rate,
            confidence_score, sample_size, model_version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           predicted_engagement_rate = VALUES(predicted_engagement_rate),
           confidence_score = VALUES(confidence_score),
           sample_size = VALUES(sample_size),
           model_version = VALUES(model_version),
           updated_at = UTC_TIMESTAMP()`,
        [
          accountId,
          dayMap[slot.day_of_week] || slot.day_of_week,
          Number(slot.hour_of_day) || 9,
          Number(slot.predicted_engagement_rate) || 0,
          normalizeScore(slot.confidence_score, 0.7),
          sampleSize,
          modelVersion
        ]
      );
    }
  } finally {
    conn.release();
  }
}

const generateContentIdeas = async ({ teamId, accountId, topic, count = 5 }) => {
  const [accounts] = await pool.query(
    `SELECT sa.account_handle, sa.account_type, pl.name AS platform
     FROM SocialAccounts sa
     JOIN Platforms pl ON pl.platform_id = sa.platform_id
     WHERE sa.account_id = ? AND sa.team_id = ?
     LIMIT 1`,
    [accountId, teamId]
  );

  const account = accounts[0];
  const [topHashtags] = await pool.query(
    "SELECT tag FROM Hashtags WHERE team_id = ? ORDER BY avg_reach DESC LIMIT 5",
    [teamId]
  );

  const systemPrompt = `You are a creative social media content strategist.
Generate scroll-stopping content ideas that drive real engagement.
Always respond with valid JSON only - no explanation, no markdown.`;

  const userPrompt = `Generate ${Number(count) || 5} content ideas for a ${account?.account_type || "business"} ${account?.platform || "Instagram"} account (@${account?.account_handle || "account"}).
Topic/niche: ${topic || "general"}
Top hashtags they use: ${topHashtags.map((h) => h.tag).join(", ") || "none yet"}

Return JSON:
{
  "ideas": [
    {
      "title": "Catchy post title",
      "concept": "Detailed description of the content",
      "format": "carousel|reel|story|feed",
      "hook": "Opening line to grab attention",
      "caption_starter": "Beginning of the caption...",
      "suggested_hashtags": ["#tag1", "#tag2", "#tag3"],
      "best_day": "Tuesday",
      "best_time": "18:00",
      "estimated_reach": "high|medium|low",
      "content_tip": "Pro tip for creating this content"
    }
  ]
}`;

  return parseJSON(await callGemini(systemPrompt, userPrompt, 1200));
};

const analyzeEngagementSentiment = async (postId) => {
  const [posts] = await pool.query(
    `SELECT p.caption, pa.likes, pa.comments, pa.shares, pa.reach, pa.engagement_rate
     FROM Posts p
     JOIN PostAnalytics pa ON pa.post_id = p.post_id
     WHERE p.post_id = ?
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [postId]
  );

  if (!posts.length) throw new Error("Post analytics not found");
  const post = posts[0];

  const systemPrompt = `You are a social media analytics expert.
Analyze post performance data and provide actionable insights.
Always respond with valid JSON only.`;

  const userPrompt = `Analyze this post's performance and provide insights:
Caption: "${post.caption}"
Likes: ${post.likes}
Comments: ${post.comments}
Shares: ${post.shares}
Reach: ${post.reach}
Engagement Rate: ${(Number(post.engagement_rate || 0) * 100).toFixed(2)}%

Return JSON:
{
  "performance_score": 8.5,
  "sentiment": "positive|neutral|negative",
  "summary": "Brief performance summary",
  "strengths": ["What worked well"],
  "improvements": ["What to do better next time"],
  "recommendation": "Specific action for next post"
}`;

  return parseJSON(await callGemini(systemPrompt, userPrompt, 700));
};

const generateCampaignStrategy = async (campaignId) => {
  const [campaigns] = await pool.query(
    `SELECT c.campaign_name, c.description, c.start_date, c.end_date,
            c.budget, COUNT(p.post_id) AS post_count
     FROM Campaigns c
     LEFT JOIN Posts p ON p.campaign_id = c.campaign_id
     WHERE c.campaign_id = ?
     GROUP BY c.campaign_id`,
    [campaignId]
  );

  if (!campaigns.length) throw new Error("Campaign not found");
  const campaign = campaigns[0];
  const duration = Math.max(
    1,
    Math.ceil((new Date(campaign.end_date) - new Date(campaign.start_date)) / 86400000)
  );

  const systemPrompt = `You are a senior social media campaign strategist.
Create data-driven campaign strategies that maximize ROI.
Always respond with valid JSON only.`;

  const userPrompt = `Create a strategy for this campaign:
Name: ${campaign.campaign_name}
Description: ${campaign.description || "Not provided"}
Duration: ${duration} days
Budget: ${campaign.budget ? `INR ${campaign.budget}` : "Not set"}
Current posts: ${campaign.post_count}

Return JSON:
{
  "strategy_summary": "Overall approach",
  "recommended_post_count": 12,
  "posting_frequency": "X posts per week",
  "content_mix": {
    "feed": 40,
    "story": 30,
    "reel": 20,
    "carousel": 10
  },
  "weekly_plan": [
    {
      "week": 1,
      "theme": "Awareness",
      "posts": ["Post idea 1", "Post idea 2"],
      "goal": "Reach new audience"
    }
  ],
  "kpis": ["KPI 1", "KPI 2"],
  "tips": ["Tip 1", "Tip 2"]
}`;

  return parseJSON(await callGemini(systemPrompt, userPrompt, 1100));
};

module.exports = {
  recommendHashtags,
  suggestCaptions,
  computeBestPostingTimes,
  generateContentIdeas,
  analyzeEngagementSentiment,
  generateCampaignStrategy
};
