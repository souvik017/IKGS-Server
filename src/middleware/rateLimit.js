const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const jsonHandler = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.global,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler('Too many requests, please try again later.'),
});

const publicLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.public,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: jsonHandler('Too many submissions from this IP. Please try again later.'),
});

const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.login,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler('Too many login attempts. Please try again later.'),
});

module.exports = { globalLimiter, publicLimiter, loginLimiter };
