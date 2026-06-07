const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const env = require("../../config/env");
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

exports.getMetaConnectUrl = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    accountsService.buildMetaConnectUrl(req.user.team_id, req.user.sub, req.query.platform),
    "Meta authorization URL generated."
  );
});

exports.handleMetaCallback = async (req, res) => {
  try {
    const { redirectUrl } = await accountsService.handleMetaCallback(req.query);
    res.redirect(redirectUrl);
  } catch (error) {
    const url = new URL("/settings", env.appUrl);
    url.searchParams.set("meta_status", "error");
    url.searchParams.set("meta_error", error.message || "Meta connection failed.");
    url.hash = "accounts";
    res.redirect(url.toString());
  }
};
