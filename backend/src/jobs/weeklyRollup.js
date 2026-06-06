const { demoState, nextId, getAccountById } = require("../services/modules/store");

function startOfLastMonday() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff - 7);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

async function runWeeklyRollup() {
  const weekStart = startOfLastMonday();
  const processed = [];

  demoState.socialAccounts.forEach((account) => {
    const recent = demoState.dailyAnalytics.filter(
      (item) =>
        Number(item.social_account_id) === Number(account.id) &&
        item.analytics_date >= weekStart
    );

    demoState.weeklyAnalytics.unshift({
      id: nextId("weeklyAnalytics"),
      social_account_id: account.id,
      week_start: weekStart,
      impressions: recent.reduce((sum, item) => sum + Number(item.impressions || 0), 0),
      reach_count: recent.reduce((sum, item) => sum + Number(item.reach_count || 0), 0),
      engagement_count: recent.reduce((sum, item) => sum + Number(item.engagement_count || 0), 0),
      follower_growth: recent.length
        ? recent[recent.length - 1].follower_count - recent[0].follower_count
        : 0,
      posts_published: recent.reduce((sum, item) => sum + Number(item.posts_published || 0), 0)
    });

    processed.push(getAccountById(account.id)?.account_name || account.id);
  });

  console.log(`[weeklyRollup] Processed ${processed.length} accounts for ${weekStart}`);
}

module.exports = {
  runWeeklyRollup
};
