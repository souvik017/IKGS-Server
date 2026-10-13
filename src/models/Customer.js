const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, default: 'West Bengal' },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      match: [/^[\d\s\-+()]+$/, 'Please enter a valid phone number'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        'Please enter a valid email',
      ],
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    tags: [{ type: String, trim: true }],
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

customerSchema.index({ customerId: 1 }, { unique: true });
customerSchema.index({ name: 'text', phone: 'text', email: 'text' });
customerSchema.index({ 'address.city': 1 });
customerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);
