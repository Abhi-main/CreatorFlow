import { verifyAccessToken } from "../config/jwt.js";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided", code: 401 });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token", code: 401 });
  }
};

export const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role_name)) {
    return res.status(403).json({ success: false, error: "Access denied", code: 403 });
  }
  return next();
};
