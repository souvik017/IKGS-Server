const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

const signToken = (admin) =>
  jwt.sign({ id: admin._id.toString(), role: admin.role }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });

const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  maxAge: config.cookie.maxAgeMs,
  path: '/',
});

/**
 * Issue the auth JWT as an httpOnly cookie plus a readable CSRF token cookie
 * (double-submit pattern). The raw token is also returned for non-cookie clients.
 */
function issueSession(res, admin) {
  const token = signToken(admin);
  const csrfToken = crypto.randomBytes(24).toString('hex');

  res.cookie(config.jwt.cookieName, token, cookieOptions());
  res.cookie(config.jwt.csrfCookieName, csrfToken, {
    ...cookieOptions(),
    httpOnly: false,
  });

  return { token, csrfToken };
}

function clearSession(res) {
  res.clearCookie(config.jwt.cookieName, { ...cookieOptions(), maxAge: undefined });
  res.clearCookie(config.jwt.csrfCookieName, { ...cookieOptions(), maxAge: undefined });
}

module.exports = { signToken, verifyToken, issueSession, clearSession, cookieOptions };
