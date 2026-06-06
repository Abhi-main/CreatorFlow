const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");

function verifyToken(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    next(new ApiError(401, "Authentication required."));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (_error) {
    next(new ApiError(401, "Invalid or expired access token."));
  }
}

function requireRole(roles) {
  return function checkRole(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role_name)) {
      next(new ApiError(403, "You do not have permission to perform this action."));
      return;
    }

    next();
  };
}

module.exports = {
  verifyToken,
  requireRole
};
