const express = require('express');
const controller = require('../controllers/galleryController');
const { protect } = require('../middleware/auth');
const { uploadGalleryImage } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router.get('/categories', controller.listCategories);
router.put('/reorder', controller.reorder);

router.route('/').get(controller.list).post(uploadGalleryImage, controller.create);

router
  .route('/:id')
  .get(controller.getById)
  .put(uploadGalleryImage, controller.update)
  .delete(controller.remove);

module.exports = router;
