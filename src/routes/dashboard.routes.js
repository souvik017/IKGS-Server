const express = require('express');
const controller = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/summary', controller.summary);

module.exports = router;
