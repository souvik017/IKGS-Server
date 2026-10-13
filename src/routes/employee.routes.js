const express = require('express');
const controller = require('../controllers/employeeController');
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
      email: [rules.email()],
    }),
    controller.create
  );

router.route('/:id').get(controller.getById).put(controller.update).delete(controller.remove);
router.put('/:id/status', controller.setStatus);

module.exports = router;
