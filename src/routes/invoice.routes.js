const express = require('express');
const controller = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.route('/').get(controller.list).post(controller.create);
router.post(
  '/appointment',
  validate({ appointment: [rules.required('Appointment'), rules.objectId('Appointment')] }),
  controller.createFromAppointment
);

router.route('/:id').get(controller.getById).put(controller.update).delete(controller.remove);
router.put('/:id/payment', controller.updatePayment);
router.get('/:id/pdf', controller.downloadPdf);

module.exports = router;
