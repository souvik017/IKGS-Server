const express = require('express');
const controller = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');
const { uploadServiceImages } = require('../middleware/upload');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

// `uploadServiceImages` must run before `validate` so that, when the form is
// submitted as multipart/form-data with an attached image, the text fields are
// already parsed onto req.body.
router
  .route('/')
  .get(controller.list)
  .post(
    authorize('super_admin', 'admin'),
    uploadServiceImages,
    validate({ title: [rules.required('Title')] }),
    controller.create
  );

router
  .route('/:id')
  .get(controller.getById)
  .put(uploadServiceImages, controller.update)
  .delete(controller.remove);

module.exports = router;
