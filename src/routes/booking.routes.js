const express = require('express');
const controller = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router
  .route('/')
  .get(controller.list)
  .post(
    validate({
      name: [rules.required('Name')],
      phone: [rules.required('Phone'), rules.phone()],
    }),
    controller.create
  );

router.route('/:id').get(controller.getById).put(controller.update).delete(controller.remove);
router.put('/:id/status', controller.updateStatus);
router.post('/:id/convert', controller.convertToAppointment);

module.exports = router;
