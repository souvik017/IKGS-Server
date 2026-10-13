const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [150, 'Item name cannot exceed 150 characters'],
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    unit: {
      type: String,
      enum: ['kg', 'liter', 'piece', 'box', 'bundle', 'bottle', 'packet'],
      default: 'piece',
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    supplier: {
      type: String,
      trim: true,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Low stock threshold cannot be negative'],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ itemName: 'text', sku: 'text' });
inventoryItemSchema.index({ quantity: 1 });
inventoryItemSchema.index({ active: 1 });

// Virtual (not persisted) so it is always consistent with current quantity.
inventoryItemSchema.virtual('isLowStock').get(function isLowStock() {
  return Number(this.quantity) <= Number(this.lowStockThreshold);
});

inventoryItemSchema.set('toJSON', { virtuals: true });
inventoryItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
