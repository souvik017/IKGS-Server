const express = require('express');
const controller = require('../controllers/publicController');
const { publicLimiter } = require('../middleware/rateLimit');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();

router.get('/settings', controller.getSettings);
router.get('/services', controller.listServices);
router.get('/services/:slug', controller.getServiceBySlug);
router.get('/testimonials', controller.listTestimonials);
router.get('/gallery', controller.listGallery);

router.post(
  '/bookings',
  publicLimiter,
  validate({
    name: [rules.required('Name'), rules.maxLength(120, 'Name')],
    phone: [rules.required('Phone'), rules.phone()],
    email: [rules.email()],
  }),
  controller.submitBooking
);

router.post(
  '/enquiries',
  publicLimiter,
  validate({
    name: [rules.required('Name')],
    phone: [rules.required('Phone'), rules.phone()],
    email: [rules.email()],
  }),
  controller.submitEnquiry
);

module.exports = router;
