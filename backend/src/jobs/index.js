const cron = require("node-cron");
const { runPostPublisher } = require("./postPublisher");
const { runWeeklyRollup } = require("./weeklyRollup");

function startSchedulers() {
  cron.schedule("* * * * *", () => {
    runPostPublisher().catch((error) => {
      console.error("[postPublisher] failed", error);
    });
  });

  cron.schedule("0 0 * * 0", () => {
    runWeeklyRollup().catch((error) => {
      console.error("[weeklyRollup] failed", error);
    });
  });
}

module.exports = {
  startSchedulers
};
