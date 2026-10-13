const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/services', require('./service.routes'));
router.use('/enquiries', require('./enquiry.routes'));
router.use('/bookings', require('./booking.routes'));
router.use('/appointments', require('./appointment.routes'));
router.use('/employees', require('./employee.routes'));
router.use('/quotations', require('./quotation.routes'));
router.use('/invoices', require('./invoice.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/closures', require('./closure.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/gallery', require('./gallery.routes'));
router.use('/settings', require('./settings.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/public', require('./public.routes'));

module.exports = router;
