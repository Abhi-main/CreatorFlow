const path = require("path");
require("dotenv").config();

const jwtSecret = process.env.JWT_SECRET || "creatorflow-super-secret";
const port = Number(process.env.PORT || 5000);
const appUrl = process.env.APP_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || process.env.BACKEND_URL || `http://localhost:${port}`;

function parseList(value, fallback) {
  return String(value || fallback || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port,
  appMode: process.env.APP_MODE || "demo",
  appUrl,
  apiUrl,
  jwtSecret,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || `${jwtSecret}:refresh`,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "creatorflow_refresh",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "creatorflow",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || ""
  },
  mail: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "no-reply@creatorflow.local"
  },
  uploadRoot: path.resolve(process.cwd(), process.env.UPLOAD_ROOT || "uploads"),
  s3: {
    region: process.env.AWS_REGION || "",
    bucket: process.env.AWS_S3_BUCKET || "",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  },
  meta: {
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
    graphVersion: process.env.META_GRAPH_VERSION || "v23.0",
    configId: process.env.META_CONFIG_ID || "",
    redirectUri: process.env.META_REDIRECT_URI || `${apiUrl}/api/accounts/meta/callback`,
    scopes: {
      facebook: parseList(
        process.env.META_FACEBOOK_SCOPES,
        "pages_show_list,pages_read_engagement,pages_manage_posts,business_management"
      ),
      instagram: parseList(
        process.env.META_INSTAGRAM_SCOPES,
        "pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_content_publish"
      )
    }
  }
};
