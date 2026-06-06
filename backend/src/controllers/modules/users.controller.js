const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const usersService = require("../../services/modules/users.service");

exports.getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, usersService.getProfile(req.user.sub), "Profile fetched.");
});

exports.updateMe = asyncHandler(async (req, res) => {
  sendSuccess(res, usersService.updateProfile(req.user.sub, req.body), "Profile updated.");
});

exports.listTeamMembers = asyncHandler(async (req, res) => {
  sendSuccess(res, usersService.listTeamMembers(req.params.id, req.query), "Team members fetched.");
});

exports.inviteTeamMember = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    usersService.inviteTeamMember(req.params.id, req.body),
    "Team member invited.",
    201
  );
});

exports.removeTeamMember = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    usersService.removeTeamMember(req.params.id, req.params.userId),
    "Team member removed."
  );
});

exports.updateTeamMemberRole = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    usersService.updateTeamMemberRole(req.params.id, req.params.userId, req.body.role_name),
    "Team member role updated."
  );
});
