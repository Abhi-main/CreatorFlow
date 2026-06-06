const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");
const env = require("../../config/env");
const authService = require("../../services/auth.service");

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function sessionMeta(req) {
  return {
    userAgent: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip
  };
}

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, sessionMeta(req));
  res.cookie(env.refreshCookieName, result.refreshToken, cookieOptions());
  sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.accessToken
    },
    "User registered successfully.",
    201
  );
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password, sessionMeta(req));
  res.cookie(env.refreshCookieName, result.refreshToken, cookieOptions());
  sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.accessToken
    },
    "Logged in successfully."
  );
});

exports.refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[env.refreshCookieName];
  const result = await authService.refresh(refreshToken, sessionMeta(req));
  res.cookie(env.refreshCookieName, result.refreshToken, cookieOptions());
  sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.accessToken
    },
    "Access token refreshed."
  );
});

exports.logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[env.refreshCookieName];
  const result = await authService.logout(refreshToken);
  res.clearCookie(env.refreshCookieName, cookieOptions());
  sendSuccess(res, result, "Logged out successfully.");
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  sendSuccess(res, result, "Password reset instructions sent.");
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.params.token, req.body.password);
  sendSuccess(res, result, "Password reset successfully.");
});
