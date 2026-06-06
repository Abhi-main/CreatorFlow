const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const campaignsService = require("../../services/modules/campaigns.service");

exports.listCampaigns = asyncHandler(async (req, res) => {
  sendSuccess(res, campaignsService.listCampaigns(req.user.team_id, req.query), "Campaigns fetched.");
});

exports.createCampaign = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    campaignsService.createCampaign(req.user.team_id, req.user.sub, req.body),
    "Campaign created.",
    201
  );
});

exports.getCampaign = asyncHandler(async (req, res) => {
  sendSuccess(res, campaignsService.getCampaign(req.user.team_id, req.params.id), "Campaign fetched.");
});

exports.updateCampaign = asyncHandler(async (req, res) => {
  sendSuccess(res, campaignsService.updateCampaign(req.user.team_id, req.params.id, req.body), "Campaign updated.");
});

exports.deleteCampaign = asyncHandler(async (req, res) => {
  sendSuccess(res, campaignsService.deleteCampaign(req.user.team_id, req.params.id), "Campaign deleted.");
});

exports.getCampaignAnalytics = asyncHandler(async (req, res) => {
  sendSuccess(res, campaignsService.getCampaignAnalytics(req.user.team_id, req.params.id), "Campaign analytics fetched.");
});
