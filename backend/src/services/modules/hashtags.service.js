const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const { demoState, nextId, getHashtagById, getPostById } = require("./store");

function listHashtags(query) {
  const { page, pageSize } = parsePagination(query);
  return paginate(demoState.hashtags, page, pageSize);
}

function createHashtag(payload) {
  const hashtag = {
    id: nextId("hashtags"),
    tag: payload.tag.startsWith("#") ? payload.tag : `#${payload.tag}`,
    category: payload.category || "growth",
    usage_count: 0
  };
  demoState.hashtags.unshift(hashtag);
  return hashtag;
}

function updateHashtag(hashtagId, payload) {
  const hashtag = getHashtagById(hashtagId);
  if (!hashtag) {
    throw new ApiError(404, "Hashtag not found.");
  }

  hashtag.tag = payload.tag ? (payload.tag.startsWith("#") ? payload.tag : `#${payload.tag}`) : hashtag.tag;
  hashtag.category = payload.category ?? hashtag.category;
  return hashtag;
}

function deleteHashtag(hashtagId) {
  const hashtag = getHashtagById(hashtagId);
  if (!hashtag) {
    throw new ApiError(404, "Hashtag not found.");
  }

  demoState.hashtags = demoState.hashtags.filter((item) => Number(item.id) !== Number(hashtagId));
  return { deleted: true };
}

function getHashtagRecommendations(postId) {
  const post = getPostById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found.");
  }

  return {
    hashtags: demoState.hashtagRecommendations.filter((item) => Number(item.team_id) === Number(post.team_id)).slice(0, 5),
    captions: demoState.captionSuggestions.filter((item) => Number(item.team_id) === Number(post.team_id)).slice(0, 3)
  };
}

function getHashtagAnalytics(hashtagId) {
  const hashtag = getHashtagById(hashtagId);
  if (!hashtag) {
    throw new ApiError(404, "Hashtag not found.");
  }

  return demoState.hashtagAnalytics.filter((item) => Number(item.hashtag_id) === Number(hashtagId));
}

module.exports = {
  listHashtags,
  createHashtag,
  updateHashtag,
  deleteHashtag,
  getHashtagRecommendations,
  getHashtagAnalytics
};
