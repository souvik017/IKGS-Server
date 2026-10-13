const express = require('express');
const controller = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/low-stock', controller.getLowStock);
router.get('/report', controller.getReport);
router.get('/movements', controller.listMovements);
router.post(
  '/movements',
  validate({
    item: [rules.required('Item'), rules.objectId('Item')],
    type: [rules.required('Type'), rules.enum(['stock-in', 'stock-out', 'adjustment'], 'Type')],
    quantity: [rules.required('Quantity'), rules.number('Quantity'), rules.positive('Quantity')],
  }),
  controller.createMovement
);

router
  .route('/items')
  .get(controller.listItems)
  .post(validate({ itemName: [rules.required('Item name')] }), controller.createItem);

router.route('/items/:id').get(controller.getItem).put(controller.updateItem).delete(controller.removeItem);

module.exports = router;
