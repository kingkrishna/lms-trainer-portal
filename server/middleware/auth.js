const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT authentication middleware.
 * Expects token in HTTP-only cookie (lms_token) or Authorization: Bearer <token>.
 * Attaches req.user = { id, email, role } on success.
 */
function authenticate(req, res, next) {
  const token =
    req.cookies?.[config.jwt.cookieName] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based access: allow only listed roles.
 * Use after authenticate().
 * @param  {...string} allowedRoles - e.g. 'student', 'trainer', 'recruiter', 'super_admin'
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Optional auth: attaches req.user if valid token, otherwise continues without it.
 */
function optionalAuth(req, res, next) {
  const token =
    req.cookies?.[config.jwt.cookieName] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
  } catch (_) {}
  next();
}

module.exports = {
  authenticate,
  requireRole,
  optionalAuth,
};
