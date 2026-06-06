const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

function buildAllowedOrigins(appUrl) {
  const origins = new Set();
  const candidates = String(appUrl || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  candidates.forEach((candidate) => {
    try {
      const url = new URL(candidate);
      const port = url.port ? `:${url.port}` : "";

      origins.add(url.origin);

      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        origins.add(`${url.protocol}//localhost${port}`);
        origins.add(`${url.protocol}//127.0.0.1${port}`);
      }
    } catch {
      origins.add(candidate);
    }
  });

  return origins;
}

const allowedOrigins = buildAllowedOrigins(env.appUrl);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true
  })
);
app.use(helmet());
app.use(morgan(env.isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve(env.uploadRoot)));

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
