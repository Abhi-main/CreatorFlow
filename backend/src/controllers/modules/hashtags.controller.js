const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const hashtagsService = require("../../services/modules/hashtags.service");

exports.listHashtags = asyncHandler(async (req, res) => {
  sendSuccess(res, hashtagsService.listHashtags(req.query), "Hashtags fetched.");
});

exports.createHashtag = asyncHandler(async (req, res) => {
  sendSuccess(res, hashtagsService.createHashtag(req.body), "Hashtag created.", 201);
});

exports.updateHashtag = asyncHandler(async (req, res) => {
  sendSuccess(res, hashtagsService.updateHashtag(req.params.id, req.body), "Hashtag updated.");
});

exports.deleteHashtag = asyncHandler(async (req, res) => {
  sendSuccess(res, hashtagsService.deleteHashtag(req.params.id), "Hashtag deleted.");
});

exports.getRecommendations = asyncHandler(async (req, res) => {
  sendSuccess(res, hashtagsService.getHashtagRecommendations(req.params.postId), "Hashtag recommendations fetched.");
});

exports.getAnalytics = asyncHandler(async (req, res) => {
  sendSuccess(res, hashtagsService.getHashtagAnalytics(req.params.id), "Hashtag analytics fetched.");
});
