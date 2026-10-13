const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
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
      match: [/^[\d\s\-+()]+$/, 'Please enter a valid phone number'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        'Please enter a valid email',
      ],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    preferredDate: {
      type: Date,
    },
    preferredTime: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['new', 'pending', 'confirmed', 'completed', 'cancelled'],
      default: 'new',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enquiry',
    },
    source: {
      type: String,
      enum: ['website', 'phone', 'walk-in', 'admin'],
      default: 'website',
    },
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ bookingId: 1 }, { unique: true });
bookingSchema.index({ status: 1 });
bookingSchema.index({ preferredDate: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ name: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Booking', bookingSchema);
