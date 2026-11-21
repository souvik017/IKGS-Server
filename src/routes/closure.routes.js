const express = require('express');
const controller = require('../controllers/closureController');
const { protect } = require('../middleware/auth');
const { uploadServiceImages } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router
  .route('/')
  .get(controller.list);

router.put('/:id/approve', controller.approve);
router.put('/:id/reject', controller.reject);

router.route('/:id').get(controller.getById).put(uploadServiceImages, controller.update);

module.exports = router;
