const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAccessToken(payload) {
  return jwt.sign(
    {
      ...payload,
      token_type: "access"
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtAccessExpiresIn
    }
  );
}

function signRefreshToken(payload) {
  return jwt.sign(
    {
      ...payload,
      token_type: "refresh"
    },
    env.jwtRefreshSecret,
    {
      expiresIn: env.jwtRefreshExpiresIn
    }
  );
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (decoded.token_type !== "access") {
    throw new Error("Invalid access token.");
  }
  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, env.jwtRefreshSecret);
  if (decoded.token_type !== "refresh") {
    throw new Error("Invalid refresh token.");
  }
  return decoded;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
