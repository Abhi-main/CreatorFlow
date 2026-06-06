const env = require("./config/env");
const app = require("./app");
const { startSchedulers } = require("./jobs");

app.listen(env.port, () => {
  console.log(`CreatorFlow backend listening on port ${env.port} in ${env.appMode} mode`);
});

startSchedulers();
