/**
 * AI Service - Groq for text generation, Gemini for image analysis.
 * Keeps the same exported functions used by the rest of CreatorFlow.
 */
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { normalizeTag } from "../controllers/_helpers.js";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_VISION_MODELS = [...new Set([GEMINI_MODEL, "gemini-2.5-flash", "gemini-1.5-flash"].filter(Boolean))];
const GROQ_PLACEHOLDER = "gsk-your-key-here";
const GEMINI_PLACEHOLDER = "AIzaSy-your-key-here";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === GROQ_PLACEHOLDER) {
  console.error("GROQ_API_KEY is not configured.");
} else {
  console.log("Groq AI service initialized.");
}

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === GEMINI_PLACEHOLDER) {
  console.warn("GEMINI_API_KEY is not configured; image analysis is disabled.");
} else {
  console.log("Gemini Vision service initialized.");
}

const ensureGroqKey = () => {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === GROQ_PLACEHOLDER) {
    const error = new Error("GROQ_API_KEY is not configured.");
    error.status = 503;
    throw error;
  }
};

export const callGroq = async (prompt, maxTokens = 800) => {
  ensureGroqKey();

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: maxTokens,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a social media expert. Always respond with valid JSON only. No explanation, no markdown fences, no extra text."
      },
      { role: "user", content: prompt }
    ]
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
};

export const parseJSON = (text) => {
  const clean = String(text || "")
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/gi, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (error) {
    error.message = `AI returned invalid JSON: ${error.message}`;
    error.status = 502;
    throw error;
  }
};

const normalizeScore = (value, fallback = 0.7) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
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

const mimeFromPath = (filePath, fallback = "image/jpeg") => {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return fallback || "image/jpeg";
};

const resolveLocalUploadPath = (publicUrl) => {
  const filename = path.basename(String(publicUrl || ""));
  if (!filename) return null;

  const localPath = path.join(process.cwd(), "uploads", filename);
  return fs.existsSync(localPath) ? localPath : null;
};

const resolveImageUrlToLocalPath = (imageUrl) => {
  const normalized = String(imageUrl || "").trim();
  if (!normalized || normalized.startsWith("blob:")) return null;

  if (fs.existsSync(normalized)) {
    return normalized;
  }

  let pathname = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      pathname = new URL(normalized).pathname;
    } catch {
      pathname = normalized;
    }
  }

  const uploadFilename = path.basename(pathname || "");
  if (uploadFilename) {
    const uploadsPath = path.join(process.cwd(), "uploads", uploadFilename);
    if (fs.existsSync(uploadsPath)) {
      return uploadsPath;
    }
  }

  if (normalized.startsWith("uploads/")) {
    const nestedPath = path.join(process.cwd(), normalized);
    if (fs.existsSync(nestedPath)) {
      return nestedPath;
    }
  }

  if (normalized.startsWith("/uploads/")) {
    const relativeUploadPath = path.join(process.cwd(), normalized.replace(/^\/+/, ""));
    if (fs.existsSync(relativeUploadPath)) {
      return relativeUploadPath;
    }
  }

  return resolveLocalUploadPath(normalized);
};

const getPostImagePath = async (postId) => {
  try {
    const [media] = await pool.query(
      `SELECT mf.public_url, mf.mime_type
         FROM PostMedia pm
         JOIN MediaFiles mf ON mf.media_id = pm.media_id
        WHERE pm.post_id = ?
          AND mf.mime_type LIKE 'image/%'
        ORDER BY pm.sort_order ASC
        LIMIT 1`,
      [postId]
    );

    if (!media.length) return null;

    const publicUrl = media[0].public_url;
    const filename = path.basename(publicUrl || "");
    if (!filename) return null;

    const localPath = path.join(process.cwd(), "uploads", filename);
    if (!fs.existsSync(localPath)) return null;

    return {
      path: localPath,
      mimeType: media[0].mime_type || mimeFromPath(localPath)
    };
  } catch {
    return null;
  }
};

const getDirectImagePath = async ({ mediaIds = [], mediaUrls = [] } = {}) => {
  try {
    const normalizedMediaIds = Array.isArray(mediaIds)
      ? mediaIds.map((value) => Number(value)).filter(Number.isFinite)
      : [];

    if (normalizedMediaIds.length) {
      const [media] = await pool.query(
        `SELECT public_url, mime_type
           FROM MediaFiles
          WHERE media_id IN (?)
            AND mime_type LIKE 'image/%'
          ORDER BY media_id ASC
          LIMIT 1`,
        [normalizedMediaIds]
      );

      if (media.length) {
        const localPath = resolveLocalUploadPath(media[0].public_url);
        if (localPath) {
          return {
            path: localPath,
            mimeType: media[0].mime_type || mimeFromPath(localPath)
          };
        }
      }
    }

    const normalizedMediaUrls = Array.isArray(mediaUrls)
      ? mediaUrls.map((value) => String(value || "").trim()).filter(Boolean)
      : [];

    for (const publicUrl of normalizedMediaUrls) {
      const localPath = resolveLocalUploadPath(publicUrl);
      if (localPath) {
        return {
          path: localPath,
          mimeType: mimeFromPath(localPath)
        };
      }
    }
  } catch {
    return null;
  }

  return null;
};

const analyzeImageWithGemini = async (imageInfo) => {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === GEMINI_PLACEHOLDER) return null;
    if (!imageInfo?.path || !fs.existsSync(imageInfo.path)) return null;

    const imageData = fs.readFileSync(imageInfo.path).toString("base64");

    for (const modelName of GEMINI_VISION_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          {
            inlineData: {
              data: imageData,
              mimeType: imageInfo.mimeType || mimeFromPath(imageInfo.path)
            }
          },
          `Analyze this social media image and describe:
1. Main subject or objects
2. Colors and mood
3. Setting or location
4. People, if any
5. Visible text, if any
6. Overall theme

Be concise, 2-3 sentences max. This will be used for hashtag and caption generation.`
        ]);

        return result.response.text().trim();
      } catch (error) {
        console.warn(`Image analysis failed for ${modelName}:`, error.message);
      }
    }
  } catch (error) {
    console.warn("Image analysis failed:", error.message);
  }

  return null;
};

export const analyzeImageFromUrl = async (imageUrl) => {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === GEMINI_PLACEHOLDER) return null;

    const normalizedUrl = String(imageUrl || "").trim();
    if (!normalizedUrl || normalizedUrl.startsWith("blob:")) return null;

    let mimeType = mimeFromPath(normalizedUrl);
    let imageData = null;

    const localPath = resolveImageUrlToLocalPath(normalizedUrl);
    if (localPath) {
      mimeType = mimeFromPath(localPath, mimeType);
      imageData = fs.readFileSync(localPath).toString("base64");
    } else if (/^https?:\/\//i.test(normalizedUrl)) {
      const response = await fetch(normalizedUrl);
      if (!response.ok) {
        throw new Error(`Unable to fetch image: ${response.status}`);
      }

      const headerMimeType = response.headers.get("content-type");
      if (headerMimeType?.startsWith("image/")) {
        mimeType = headerMimeType;
      }

      const arrayBuffer = await response.arrayBuffer();
      imageData = Buffer.from(arrayBuffer).toString("base64");
    }

    if (!imageData) return null;

    for (const modelName of GEMINI_VISION_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          {
            inlineData: {
              data: imageData,
              mimeType
            }
          },
          `Analyze this social media image in 2-3 sentences. Describe the main subject, colors or mood, setting, any visible text, and the overall theme. Be specific for hashtag generation purposes.`
        ]);

        return result.response.text().trim();
      } catch (error) {
        console.warn(`Image URL analysis failed for ${modelName}:`, error.message);
      }
    }
  } catch (error) {
    console.warn("Image analysis failed:", error.message);
  }

  return null;
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

// ============================================================
// 1. HASHTAG RECOMMENDATIONS
// ============================================================
export const recommendHashtags = async (postId) => {
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
  const imageInfo = await getPostImagePath(postId);
  const imageAnalysis = imageInfo ? await analyzeImageWithGemini(imageInfo) : null;

  const prompt = `Recommend 12 hashtags for this ${post.platform} ${post.post_type} post.
Caption: "${post.caption || "No caption yet"}"
${imageAnalysis ? `Image content: "${imageAnalysis}"` : ""}

Rules:
- 3 high-reach broad tags, 5 medium niche tags, and 4 very specific tags.
- All tags must be lowercase and include the # symbol.
- Base suggestions on both caption and image content when image content is available.

Return JSON:
{
  "hashtags": [
    {
      "tag": "#example",
      "relevance_score": 0.95,
      "reason": "Why this hashtag fits"
    }
  ]
}`;

  const parsed = parseJSON(await callGroq(prompt, 700));
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
      await conn.query(
        `INSERT INTO HashtagRecommendations (post_id, account_id, hashtag_id, score, expected_reach, created_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           score = VALUES(score),
           expected_reach = VALUES(expected_reach),
           created_at = UTC_TIMESTAMP()`,
        [postId, post.account_id, hashtag.hashtag_id, score, Math.round(5000 + score * 15000)]
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

// ============================================================
// 2. CAPTION SUGGESTIONS
// ============================================================
export const suggestCaptions = async ({
  postId = null,
  tone = "casual",
  mediaType = "image",
  existingCaption = "",
  platform = "instagram",
  hashtags = [],
  mediaIds = [],
  mediaUrls = []
} = {}) => {
  const toneGuides = {
    professional: "formal, authoritative, business-focused, no slang",
    casual: "friendly, conversational, relatable, use contractions",
    humorous: "witty, playful, light-hearted, include a joke or pun",
    inspirational: "motivating, uplifting, emotional, end with a powerful statement",
    promotional: "compelling, benefit-focused, clear call-to-action"
  };

  const platformGuides = {
    instagram: "use emojis, line breaks, and end with [HASHTAGS] placeholder",
    facebook: "conversational, ask a question to drive comments",
    linkedin: "professional, add value, hook opening, minimal emojis"
  };

  const normalizedTone = String(tone || "casual").toLowerCase();
  const normalizedPlatform = String(platform || "instagram").toLowerCase();
  const imageInfo = (postId ? await getPostImagePath(postId) : null)
    || await getDirectImagePath({ mediaIds, mediaUrls });
  const imageAnalysis = imageInfo ? await analyzeImageWithGemini(imageInfo) : null;

  const prompt = `Write 3 different ${normalizedPlatform} captions.
Tone: ${normalizedTone} - ${toneGuides[normalizedTone] || toneGuides.casual}
Platform style: ${platformGuides[normalizedPlatform] || platformGuides.instagram}
Media type: ${mediaType || "image"}
${imageAnalysis ? `Image shows: "${imageAnalysis}"` : ""}
${existingCaption ? `Existing caption to improve: "${existingCaption}"` : ""}
${hashtags.length ? `Suggested hashtags to consider: ${hashtags.join(" ")}` : ""}

Make captions specifically relevant to what is shown in the image when image context is available.

Return JSON:
{
  "captions": [
    {
      "text": "Full caption text here with emojis...",
      "tone": "${normalizedTone}",
      "hook": "Opening line explanation",
      "cta": "Call to action used",
      "estimated_engagement": "high|medium|low"
    }
  ]
}`;

  const parsed = parseJSON(await callGroq(prompt, 1000));
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

// ============================================================
// 3. BEST POSTING TIME PREDICTION
// ============================================================
export const computeBestPostingTimes = async (accountId) => {
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

  const [accounts] = await pool.query(
    `SELECT sa.account_type, pl.name AS platform
       FROM SocialAccounts sa
       JOIN Platforms pl ON pl.platform_id = sa.platform_id
      WHERE sa.account_id = ?
      LIMIT 1`,
    [accountId]
  );
  const account = accounts[0];

  const prompt = data.length >= 3
    ? `Analyze this real engagement data and recommend best posting times.
Data: ${JSON.stringify(data.slice(0, 20))}

Return JSON:
{
  "analysis": "Brief insight about peak times",
  "slots": [
    {
      "day_of_week": "Mon",
      "hour_of_day": 9,
      "predicted_engagement_rate": 0.052,
      "confidence_score": 0.88,
      "insight": "Peak engagement time based on your data"
    }
  ]
}`
    : `Recommend best posting times for a ${account?.account_type || "business"} account on ${account?.platform || "Instagram"} based on industry best practices.
Return top 8 time slots.

Return JSON:
{
  "analysis": "General best practices insight",
  "slots": [
    {
      "day_of_week": "Mon",
      "hour_of_day": 9,
      "predicted_engagement_rate": 0.045,
      "confidence_score": 0.72,
      "insight": "Monday morning commute browsing"
    }
  ]
}`;

  const parsed = parseJSON(await callGroq(prompt, 800));
  const slots = Array.isArray(parsed.slots) ? parsed.slots : [];
  await saveBestTimeSlots(accountId, slots, data.length, `${GROQ_MODEL}-${data.length >= 3 ? "data" : "general"}`);
  return { analysis: parsed.analysis || "", slots };
};

// ============================================================
// 4. CONTENT IDEAS GENERATOR
// ============================================================
export const generateContentIdeas = async ({ teamId, accountId, topic, count = 5 }) => {
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

  const prompt = `Generate ${Number(count) || 5} creative social media content ideas.
Account: ${account?.account_type || "business"} on ${account?.platform || "Instagram"}
Handle: @${account?.account_handle || "account"}
Topic/niche: ${topic || "general"}
Top hashtags: ${topHashtags.map((h) => h.tag).join(", ") || "none yet"}

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

  return parseJSON(await callGroq(prompt, 1500));
};

// ============================================================
// 5. POST SENTIMENT ANALYSIS
// ============================================================
export const analyzeEngagementSentiment = async (postId) => {
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
  const imageInfo = await getPostImagePath(postId);
  const imageAnalysis = imageInfo ? await analyzeImageWithGemini(imageInfo) : null;

  const prompt = `Analyze this social media post performance:
Caption: "${post.caption}"
${imageAnalysis ? `Image: "${imageAnalysis}"` : ""}
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

  return parseJSON(await callGroq(prompt, 700));
};

// ============================================================
// 6. CAMPAIGN STRATEGY ADVISOR
// ============================================================
export const generateCampaignStrategy = async (campaignId) => {
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

  const prompt = `Create a social media campaign strategy:
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

  return parseJSON(await callGroq(prompt, 1000));
};
