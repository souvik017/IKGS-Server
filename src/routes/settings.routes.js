const express = require('express');
const controller = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', controller.get);
router.put('/', protect, authorize('super_admin', 'admin'), controller.update);

module.exports = router;
