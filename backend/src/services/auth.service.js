const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const ApiError = require("../utils/ApiError");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const { PASSWORD_ROUNDS } = require("../data/demoData");
const { sendMail } = require("./email.service");
const {
  demoState,
  nextId,
  getRoleByName,
  getUserById,
  sanitizeUser,
  createNotification,
  createLog
} = require("./modules/store");

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAuthTokens(user) {
  const payload = sanitizeUser(user);

  return {
    accessToken: signAccessToken({
      sub: payload.id,
      email: payload.email,
      role_id: payload.role_id,
      role_name: payload.role_name,
      team_id: payload.team_id
    }),
    refreshToken: signRefreshToken({
      sub: payload.id,
      email: payload.email,
      role_id: payload.role_id,
      role_name: payload.role_name,
      team_id: payload.team_id
    })
  };
}

function issueSession(user, meta = {}) {
  const { accessToken, refreshToken } = buildAuthTokens(user);

  demoState.sessions.push({
    id: nextId("sessions"),
    user_id: user.id,
    refresh_token_hash: hashRefreshToken(refreshToken),
    user_agent: meta.userAgent || "unknown",
    ip_address: meta.ipAddress || "127.0.0.1",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken
  };
}

function findUserByEmail(email) {
  return demoState.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

async function register(payload, meta = {}) {
  if (findUserByEmail(payload.email)) {
    throw new ApiError(409, "A user with that email already exists.");
  }

  const teamId = nextId("teams");
  const userId = nextId("users");
  const teamName = payload.team_name || `${payload.full_name.split(" ")[0]}'s Team`;
  const defaultRole = getRoleByName("admin");

  demoState.teams.push({
    id: teamId,
    name: teamName,
    slug: slugify(teamName),
    plan_name: "Starter",
    timezone: payload.timezone || "UTC"
  });

  const user = {
    id: userId,
    role_id: defaultRole.id,
    team_id: teamId,
    full_name: payload.full_name,
    email: payload.email,
    password_hash: await bcrypt.hash(payload.password, PASSWORD_ROUNDS),
    avatar_url: "",
    timezone: payload.timezone || "UTC",
    status: "active"
  };

  demoState.users.push(user);
  demoState.teamMembers.push({
    id: nextId("teamMembers"),
    team_id: teamId,
    user_id: userId,
    role_id: defaultRole.id,
    title: "Owner",
    status: "active"
  });

  createNotification({
    user_id: user.id,
    team_id: teamId,
    title: "Workspace created",
    body: `${teamName} is ready for scheduling and analytics.`,
    variant: "success"
  });
  createLog({
    source: "auth",
    message: `User ${user.email} registered a new workspace.`,
    metadata: { userId: user.id, teamId }
  });

  return issueSession(user, meta);
}

async function login(email, password, meta = {}) {
  const user = findUserByEmail(email);

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const matches = await bcrypt.compare(password, user.password_hash);

  if (!matches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  createLog({
    source: "auth",
    message: `User ${user.email} logged in.`,
    metadata: { userId: user.id }
  });

  return issueSession(user, meta);
}

async function refresh(refreshToken, meta = {}) {
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing.");
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const session = demoState.sessions.find(
    (item) => item.user_id === decoded.sub && item.refresh_token_hash === tokenHash
  );

  if (!session) {
    throw new ApiError(401, "Refresh session not found.");
  }

  const user = getUserById(decoded.sub);

  if (!user) {
    throw new ApiError(401, "User no longer exists.");
  }

  demoState.sessions = demoState.sessions.filter((item) => item.id !== session.id);
  return issueSession(user, meta);
}

async function logout(refreshToken) {
  if (!refreshToken) {
    return { loggedOut: true };
  }

  const tokenHash = hashRefreshToken(refreshToken);
  demoState.sessions = demoState.sessions.filter((session) => session.refresh_token_hash !== tokenHash);
  return { loggedOut: true };
}

async function forgotPassword(email) {
  const user = findUserByEmail(email);

  if (!user) {
    return { queued: true };
  }

  const rawToken = crypto.randomBytes(24).toString("hex");
  demoState.passwordResets.push({
    id: nextId("passwordResets"),
    user_id: user.id,
    token: rawToken,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  });

  createNotification({
    user_id: user.id,
    team_id: user.team_id,
    title: "Password reset requested",
    body: "A password reset token has been generated for your account.",
    variant: "info"
  });

  await sendMail({
    to: user.email,
    subject: "Reset your CreatorFlow password",
    html: `<p>Hello ${user.full_name},</p><p>Use this token to reset your password:</p><p><strong>${rawToken}</strong></p>`
  });

  return {
    queued: true,
    resetTokenPreview: rawToken
  };
}

async function resetPassword(token, password) {
  const reset = demoState.passwordResets.find((item) => item.token === token);

  if (!reset) {
    throw new ApiError(400, "Reset token is invalid or expired.");
  }

  const user = getUserById(reset.user_id);
  user.password_hash = await bcrypt.hash(password, PASSWORD_ROUNDS);
  demoState.passwordResets = demoState.passwordResets.filter((item) => item.id !== reset.id);

  return { reset: true };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  sanitizeUser
};
