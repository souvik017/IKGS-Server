const express = require('express');
const controller = require('../controllers/closureController');
const { protect } = require('../middleware/auth');
const { uploadServiceImages } = require('../middleware/upload');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router
  .route('/')
  .get(controller.list)
  .post(
    uploadServiceImages,
    validate({ appointment: [rules.required('Appointment'), rules.objectId('Appointment')] }),
    controller.create
  );

router.route('/:id').get(controller.getById).put(uploadServiceImages, controller.update);

module.exports = router;
