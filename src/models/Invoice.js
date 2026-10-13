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

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Invoice must reference a customer'],
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    invoiceType: {
      type: String,
      enum: ['appointment', 'general'],
      default: 'general',
    },
    billingPeriod: {
      type: String,
      trim: true,
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
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially-paid', 'paid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank-transfer', 'cheque', 'card', 'other'],
    },
    dueDate: { type: Date },
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ appointment: 1 });
invoiceSchema.index({ createdAt: -1 });

/**
 * Recalculate payment status from the persisted total and amount paid.
 */
invoiceSchema.methods.applyPayment = function applyPayment(amountPaid) {
  const paid = Math.max(0, Number(amountPaid) || 0);
  const total = Number(this.total) || 0;
  this.amountPaid = Math.min(paid, total);
  this.balanceDue = Math.round((total - this.amountPaid) * 100) / 100;
  if (this.balanceDue <= 0) this.paymentStatus = 'paid';
  else if (this.amountPaid > 0) this.paymentStatus = 'partially-paid';
  else this.paymentStatus = 'unpaid';
};

module.exports = mongoose.model('Invoice', invoiceSchema);
