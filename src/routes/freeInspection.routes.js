const express = require('express');
const controller = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const router = express.Router();
router.use(protect);
router.get('/', (req, res, next) => { req.query.source = 'website'; next(); }, controller.list);
router.put('/:id/status', controller.updateStatus);
router.post('/:id/convert', controller.convertToAppointment);
module.exports = router;
