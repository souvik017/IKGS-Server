const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { issueSession, clearSession, signToken } = require('../utils/jwt');
const crypto = require('crypto');
const config = require('../config/env');
const { sendSystemMail } = require('../services/mailService');

exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const account = await Admin.findOne({ email, active: true }) || await Employee.findOne({ email, active: true });
  // Always return the same response to avoid revealing whether an account exists.
  if (account) {
    const token = crypto.randomBytes(32).toString('hex');
    account.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    account.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await account.save({ validateBeforeSave: false });
    const link = `${config.siteUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    await sendSystemMail({ to: account.email, subject: 'Reset your IKGS account password', text: `Use this link within 30 minutes to reset your password: ${link}`, html: `<p>Use the link below within 30 minutes to reset your IKGS account password.</p><p><a href="${link}">Reset password</a></p>` });
  }
  return sendSuccess(res, { message: 'If an active account matches that email, password reset instructions have been sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || String(password).length < 8) throw ApiError.badRequest('A valid reset token and password of at least 8 characters are required');
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  let account = await Admin.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } }).select('+passwordHash +passwordResetTokenHash +passwordResetExpires');
  let isEmployee = false;
  if (!account) {
    account = await Employee.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } }).select('+passwordHash +passwordResetTokenHash +passwordResetExpires');
    isEmployee = Boolean(account);
  }
  if (!account || !account.active) throw ApiError.badRequest('This password reset link is invalid or expired. Request a new one.');
  account.passwordHash = await require('bcryptjs').hash(String(password), 12);
  account.passwordResetTokenHash = undefined;
  account.passwordResetExpires = undefined;
  await account.save();
  return sendSuccess(res, { message: `Password reset successfully. You can now sign in${isEmployee ? ' to the employee portal' : ''}.` });
});

// @desc    Authenticate an admin
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest('Email and password are required');

  let admin = await Admin.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  let employee = null;
  if (!admin) employee = await Employee.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  const account = admin || employee;
  if (!account || !account.passwordHash) throw ApiError.unauthorized('Invalid email or password');
  if (!account.active) throw ApiError.forbidden('This account has been deactivated');

  const matches = await require('bcryptjs').compare(password, account.passwordHash);
  if (!matches) throw ApiError.unauthorized('Invalid email or password');

  if (admin) { admin.lastLogin = new Date(); await admin.save({ validateBeforeSave: false }); }

  const { token, csrfToken } = issueSession(res, account, employee ? 'employee' : 'admin');

  return sendSuccess(res, { admin: admin ? admin.toSafeObject() : { ...employee.toObject(), passwordHash: undefined, accountType: 'employee' }, token, csrfToken });
});

// @desc    Clear the admin session
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  clearSession(res);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

// @desc    Current admin profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => sendSuccess(res, { admin: req.admin ? req.admin.toSafeObject() : { ...req.employee.toObject(), passwordHash: undefined, accountType: 'employee' } }));

// @desc    Refresh the session cookie expiry
// @route   POST /api/auth/refresh
// @access  Private
exports.refresh = asyncHandler(async (req, res) => {
  const account = req.admin || req.employee;
  const type = req.employee ? 'employee' : 'admin';
  const { token, csrfToken } = issueSession(res, account, type);
  return sendSuccess(res, { admin: req.admin ? req.admin.toSafeObject() : { ...req.employee.toObject(), passwordHash: undefined, accountType: type }, token, csrfToken });
});

// @desc    Change own password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current and new password are required');
  }
  if (String(newPassword).length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }

  const account = req.employee
    ? await Employee.findById(req.employee._id).select('+passwordHash')
    : await Admin.findById(req.admin._id).select('+passwordHash');
  const matches = await require('bcryptjs').compare(currentPassword, account.passwordHash);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  account.passwordHash = await require('bcryptjs').hash(newPassword, 12);
  await account.save();
  return sendSuccess(res, { message: 'Password updated successfully' });
});

// @desc    List admin accounts
// @route   GET /api/auth/admins
// @access  Private (super_admin)
exports.listAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find().sort({ createdAt: -1 });
  return sendSuccess(res, admins.map((a) => a.toSafeObject()));
});

// @desc    Create the first super_admin account when none exists yet
// @route   POST /api/auth/bootstrap
// @access  Public (one-time; refuses as soon as any admin exists)
//
// @note    This exists so the very first admin can be created over HTTP (e.g.
//          from Postman) without needing a token that cannot exist yet. It
//          permanently locks itself out once an admin row is present, and the
//          account it creates is always a super_admin.
exports.bootstrapAdmin = asyncHandler(async (req, res) => {
  const existing = await Admin.estimatedDocumentCount();
  if (existing > 0) {
    throw ApiError.forbidden(
      'Setup is already complete. Ask a super_admin to create this account via POST /api/auth/admins.'
    );
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) throw ApiError.badRequest('Name, email and password are required');
  if (String(password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

  const duplicate = await Admin.findOne({ email: String(email).toLowerCase() });
  if (duplicate) throw ApiError.conflict('An admin with this email already exists');

  const admin = await Admin.create({
    name,
    email: String(email).toLowerCase(),
    passwordHash: await Admin.hashPassword(password),
    role: 'super_admin',
  });

  return sendSuccess(res, { admin: admin.toSafeObject() }, 201);
});

// @desc    Create an admin account
// @route   POST /api/auth/admins
// @access  Private (super_admin)
exports.createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw ApiError.badRequest('Name, email and password are required');
  if (String(password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

  const exists = await Admin.findOne({ email: String(email).toLowerCase() });
  if (exists) throw ApiError.conflict('An admin with this email already exists');

  const admin = await Admin.create({
    name,
    email: String(email).toLowerCase(),
    passwordHash: await Admin.hashPassword(password),
    role: role === 'super_admin' ? 'super_admin' : 'admin',
  });

  return sendSuccess(res, { admin: admin.toSafeObject() }, 201);
});

// @desc    Update an admin account
// @route   PUT /api/auth/admins/:id
// @access  Private (super_admin)
exports.updateAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id).select('+passwordHash');
  if (!admin) throw ApiError.notFound('Admin not found');

  const { name, role, active, password } = req.body;
  if (name !== undefined) admin.name = name;
  if (role !== undefined) admin.role = role === 'super_admin' ? 'super_admin' : 'admin';
  if (active !== undefined) admin.active = Boolean(active);
  if (password) {
    if (String(password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
    admin.passwordHash = await Admin.hashPassword(password);
  }

  await admin.save();
  return sendSuccess(res, { admin: admin.toSafeObject() });
});

exports.signToken = signToken;
