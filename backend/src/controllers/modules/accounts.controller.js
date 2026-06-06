const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const accountsService = require("../../services/modules/accounts.service");

exports.listAccounts = asyncHandler(async (req, res) => {
  sendSuccess(res, accountsService.listAccounts(req.user.team_id, req.query), "Accounts fetched.");
});

exports.createAccount = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    accountsService.createAccount(req.user.team_id, req.user.sub, req.body),
    "Account connected.",
    201
  );
});

exports.deleteAccount = asyncHandler(async (req, res) => {
  sendSuccess(res, accountsService.deleteAccount(req.user.team_id, req.params.id), "Account deleted.");
});

exports.syncAccount = asyncHandler(async (req, res) => {
  sendSuccess(res, accountsService.syncAccount(req.user.team_id, req.params.id), "Account synced.");
});
