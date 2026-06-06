const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const postsService = require("../../services/modules/posts.service");

exports.createPost = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    postsService.createPost(req.user.team_id, req.user.sub, req.body),
    "Post created.",
    201
  );
});

exports.listPosts = asyncHandler(async (req, res) => {
  sendSuccess(res, postsService.listPosts(req.user.team_id, req.query), "Posts fetched.");
});

exports.getPost = asyncHandler(async (req, res) => {
  sendSuccess(res, postsService.getPost(req.user.team_id, req.params.id), "Post fetched.");
});

exports.updatePost = asyncHandler(async (req, res) => {
  sendSuccess(res, postsService.updatePost(req.user.team_id, req.params.id, req.body), "Post updated.");
});

exports.deletePost = asyncHandler(async (req, res) => {
  sendSuccess(res, postsService.deletePost(req.user.team_id, req.params.id), "Post deleted.");
});

exports.publishNow = asyncHandler(async (req, res) => {
  sendSuccess(res, postsService.publishNow(req.user.team_id, req.params.id), "Post published.");
});

exports.createRecurringSchedule = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    postsService.createRecurringSchedule(req.user.team_id, req.body),
    "Recurring schedule created.",
    201
  );
});

exports.listRecurringSchedules = asyncHandler(async (req, res) => {
  sendSuccess(res, postsService.listRecurringSchedules(req.user.team_id), "Recurring schedules fetched.");
});

exports.deleteRecurringSchedule = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    postsService.deleteRecurringSchedule(req.user.team_id, req.params.id),
    "Recurring schedule deleted."
  );
});
