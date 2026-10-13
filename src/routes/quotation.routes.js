const express = require('express');
const controller = require('../controllers/quotationController');
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
      items: [rules.required('Items'), rules.array('Items')],
    }),
    controller.create
  );

router.route('/:id').get(controller.getById).put(controller.update).delete(controller.remove);
router.put('/:id/status', controller.updateStatus);
router.get('/:id/pdf', controller.downloadPdf);

module.exports = router;
