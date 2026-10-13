const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Review must reference a customer'],
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    // Snapshot so a public testimonial survives customer deletion.
    customerName: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
      required: [true, 'Rating is required'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    serviceName: {
      type: String,
      trim: true,
    },
    // Moderation: reviews never become public testimonials automatically.
    status: {
      type: String,
      enum: ['pending', 'approved', 'hidden'],
      default: 'pending',
    },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    moderatedAt: { type: Date },
  },
  { timestamps: true }
);

reviewSchema.index({ status: 1 });
reviewSchema.index({ customer: 1 });
reviewSchema.index({ appointment: 1 });
reviewSchema.index({ createdAt: -1 });

// Only approved reviews may be shown on the public website.
reviewSchema.statics.publicFilter = function publicFilter() {
  return { status: 'approved' };
};

module.exports = mongoose.model('Review', reviewSchema);
