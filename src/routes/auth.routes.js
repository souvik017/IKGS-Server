const express = require('express');
const controller = require('../controllers/authController');
const { protect, protectAnyAccount, authorize } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();

router.post('/password/forgot', loginLimiter, validate({ email: [rules.required('Email'), rules.email()] }), controller.requestPasswordReset);
router.post('/password/reset', loginLimiter, validate({ token: [rules.required('Reset token')], password: [rules.required('New password'), rules.minLength(8, 'New password')] }), controller.resetPassword);

router.post(
  '/login',
  loginLimiter,
  validate({
    email: [rules.required('Email'), rules.email()],
    password: [rules.required('Password'), rules.string('Password')],
  }),
  controller.login
);

router.post('/logout', controller.logout);
router.post('/refresh', protectAnyAccount, controller.refresh);
router.get('/me', protectAnyAccount, controller.getMe);
router.put(
  '/password',
  protectAnyAccount,
  validate({
    currentPassword: [rules.required('Current password')],
    newPassword: [rules.required('New password'), rules.minLength(8, 'New password')],
  }),
  controller.changePassword
);

// ---------------------------------------------------------------------------
// Admin creation
// ---------------------------------------------------------------------------

/**
 * One-time bootstrap: creates the FIRST super_admin over HTTP and then locks
 * itself out (403 once any admin exists). No token required, so it can be
 * called from Postman on a fresh database.
 *
 * curl -X POST http://localhost:5000/api/auth/bootstrap \
 *   -H 'Content-Type: application/json' \
 *   -d '{
 *     "name": "Owner",
 *     "email": "owner@example.com",
 *     "password": "Str0ngPass!"
 *   }'
 */
router.post(
  '/bootstrap',
  loginLimiter,
  validate({
    name: [rules.required('Name'), rules.maxLength(100, 'Name')],
    email: [rules.required('Email'), rules.email()],
    password: [rules.required('Password'), rules.minLength(8, 'Password')],
  }),
  controller.bootstrapAdmin
);

// Admin account management (super_admin only)
router.get('/admins', protect, authorize('super_admin'), controller.listAdmins);

/**
 * Create an additional admin. Requires a super_admin Bearer token, which you
 * get from POST /api/auth/login.
 *
 * curl -X POST http://localhost:5000/api/auth/admins \
 *   -H 'Authorization: Bearer <super_admin JWT>' \
 *   -H 'Content-Type: application/json' \
 *   -d '{
 *     "name": "Front Desk",
 *     "email": "frontdesk@example.com",
 *     "password": "Str0ngPass!",
 *     "role": "admin"
 *   }'
 */
router.post(
  '/admins',
  protect,
  authorize('super_admin'),
  validate({
    name: [rules.required('Name'), rules.maxLength(100, 'Name')],
    email: [rules.required('Email'), rules.email()],
    password: [rules.required('Password'), rules.minLength(8, 'Password')],
    role: [rules.enum(['super_admin', 'admin'], 'Role')],
  }),
  controller.createAdmin
);

router.put('/admins/:id', protect, authorize('super_admin'), controller.updateAdmin);

module.exports = router;
