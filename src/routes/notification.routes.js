const express = require('express');
const controller = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.get('/stream', protect, controller.stream);
module.exports = router;
