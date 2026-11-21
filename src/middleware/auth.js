const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');
const config = require('../config/env');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return { token: header.slice(7), source: 'header' };
  }
  const cookieToken = req.cookies?.[config.jwt.cookieName];
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }
  return { token: null, source: null };
}

/**
 * Require a valid admin session. Cookie-authenticated requests must also pass
 * the double-submit CSRF check on unsafe methods.
 */
const protect = asyncHandler(async (req, res, next) => {
  const { token, source } = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Session expired or invalid');
  }

  if (source === 'cookie' && !SAFE_METHODS.includes(req.method)) {
    const csrfCookie = req.cookies?.[config.jwt.csrfCookieName];
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw ApiError.forbidden('Invalid CSRF token');
    }
  }

  if (decoded.type === 'employee') throw ApiError.forbidden('Employee accounts cannot access this admin resource');
  const admin = await Admin.findById(decoded.id);
  if (!admin || !admin.active) {
    throw ApiError.unauthorized('Account not found or inactive');
  }

  req.admin = admin;
  next();
});

const protectEmployee = asyncHandler(async (req, res, next) => {
  const { token, source } = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');
  let decoded;
  try { decoded = verifyToken(token); } catch { throw ApiError.unauthorized('Session expired or invalid'); }
  if (decoded.type !== 'employee') throw ApiError.forbidden('Employee account required');
  if (source === 'cookie' && !SAFE_METHODS.includes(req.method)) {
    const csrfCookie=req.cookies?.[config.jwt.csrfCookieName], csrfHeader=req.headers['x-csrf-token'];
    if(!csrfCookie||!csrfHeader||csrfCookie!==csrfHeader) throw ApiError.forbidden('Invalid CSRF token');
  }
  const employee = await Employee.findById(decoded.id);
  if (!employee || !employee.active) throw ApiError.unauthorized('Employee account not found or inactive');
  req.employee = employee;
  next();
});

const protectAnyAccount = asyncHandler(async (req, res, next) => {
  const { token, source } = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');
  let decoded;
  try { decoded = verifyToken(token); } catch { throw ApiError.unauthorized('Session expired or invalid'); }
  if (source === 'cookie' && !SAFE_METHODS.includes(req.method)) {
    const csrfCookie=req.cookies?.[config.jwt.csrfCookieName], csrfHeader=req.headers['x-csrf-token'];
    if(!csrfCookie||!csrfHeader||csrfCookie!==csrfHeader) throw ApiError.forbidden('Invalid CSRF token');
  }
  if(decoded.type==='employee') {
    const employee=await Employee.findById(decoded.id);
    if(!employee||!employee.active) throw ApiError.unauthorized('Employee account not found or inactive');
    req.employee=employee;
  } else {
    const admin=await Admin.findById(decoded.id);
    if(!admin||!admin.active) throw ApiError.unauthorized('Account not found or inactive');
    req.admin=admin;
  }
  next();
});

/** Restrict to specific admin roles. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return next(ApiError.forbidden('Your role is not permitted to perform this action'));
  }
  next();
};

module.exports = { protect, protectEmployee, protectAnyAccount, authorize };
