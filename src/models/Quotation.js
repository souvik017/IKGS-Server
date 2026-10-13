const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: [true, 'Line item name is required'], trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 1 },
    unitPrice: { type: Number, required: true, min: [0, 'Unit price cannot be negative'], default: 0 },
    discount: { type: Number, min: [0, 'Discount cannot be negative'], default: 0 },
    taxRate: { type: Number, min: [0, 'Tax rate cannot be negative'], default: 0 },
    tax: { type: Number, min: [0, 'Tax cannot be negative'], default: 0 },
    lineTotal: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Quotation must reference a customer'],
    },
    items: {
      type: [lineItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one line item is required',
      },
    },
    subtotal: { type: Number, default: 0, min: 0 },
    lineDiscountTotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    validUntil: { type: Date },
    terms: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
      default: 'draft',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

quotationSchema.index({ quotationNumber: 1 }, { unique: true });
quotationSchema.index({ status: 1 });
quotationSchema.index({ customer: 1 });
quotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
