const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const { demoState, nextId, getCampaignById } = require("./store");
const analyticsService = require("./analytics.service");

function listCampaigns(teamId, query) {
  const { page, pageSize } = parsePagination(query);
  const campaigns = demoState.campaigns.filter((campaign) => Number(campaign.team_id) === Number(teamId));
  return paginate(campaigns, page, pageSize);
}

function createCampaign(teamId, userId, payload) {
  const campaign = {
    id: nextId("campaigns"),
    team_id: Number(teamId),
    owner_user_id: Number(userId),
    name: payload.name,
    objective: payload.objective,
    description: payload.description || "",
    budget: Number(payload.budget || 0),
    status: payload.status || "draft",
    starts_at: payload.starts_at || null,
    ends_at: payload.ends_at || null
  };

  demoState.campaigns.unshift(campaign);
  return campaign;
}

function getCampaign(teamId, campaignId) {
  const campaign = getCampaignById(campaignId);
  if (!campaign || Number(campaign.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Campaign not found.");
  }
  return campaign;
}

function updateCampaign(teamId, campaignId, payload) {
  const campaign = getCampaign(teamId, campaignId);
  Object.assign(campaign, {
    name: payload.name ?? campaign.name,
    objective: payload.objective ?? campaign.objective,
    description: payload.description ?? campaign.description,
    budget: payload.budget ?? campaign.budget,
    status: payload.status ?? campaign.status,
    starts_at: payload.starts_at ?? campaign.starts_at,
    ends_at: payload.ends_at ?? campaign.ends_at
  });
  return campaign;
}

function deleteCampaign(teamId, campaignId) {
  const campaign = getCampaign(teamId, campaignId);
  demoState.campaigns = demoState.campaigns.filter((item) => Number(item.id) !== Number(campaign.id));
  return { deleted: true };
}

function getCampaignAnalytics(teamId, campaignId) {
  return analyticsService.getCampaignAnalytics(teamId, campaignId);
}

module.exports = {
  listCampaigns,
  createCampaign,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignAnalytics
};
