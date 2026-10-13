const express = require('express');
const controller = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router
  .route('/')
  .get(controller.list)
  .post(
    validate({
      customer: [rules.required('Customer'), rules.objectId('Customer')],
      rating: [rules.required('Rating'), rules.number('Rating')],
    }),
    controller.create
  );

router.route('/:id').get(controller.getById).delete(controller.remove);
router.put('/:id/status', controller.updateStatus);

module.exports = router;
