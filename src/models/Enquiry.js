const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true, maxlength: [1000, 'Note too long'] },
    status: {
      type: String,
      enum: ['new', 'in-progress', 'follow-up', 'converted', 'closed'],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const enquirySchema = new mongoose.Schema(
  {
    enquiryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Enquiry name is required'],
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
    details: {
      type: String,
      trim: true,
      maxlength: [2000, 'Details cannot exceed 2000 characters'],
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    source: {
      type: String,
      enum: ['phone', 'walk-in', 'website', 'referral', 'other'],
      default: 'website',
    },
    status: {
      type: String,
      enum: ['new', 'in-progress', 'follow-up', 'converted', 'closed'],
      default: 'new',
    },
    followUps: [followUpSchema],
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    linkedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    linkedAppointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
  },
  { timestamps: true }
);

enquirySchema.index({ enquiryId: 1 }, { unique: true });
enquirySchema.index({ status: 1 });
enquirySchema.index({ source: 1 });
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ name: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Enquiry', enquirySchema);
