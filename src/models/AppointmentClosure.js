const mongoose = require('mongoose');

const appointmentClosureSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment reference is required'],
      unique: true, // one closure record per appointment
    },
    images: {
      type: [String],
      validate: {
        validator: (images) => !images || images.length <= 2,
        message: 'A maximum of two service images is allowed',
      },
      default: [],
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comments cannot exceed 2000 characters'],
    },
    closingRemarks: {
      type: String,
      trim: true,
      maxlength: [2000, 'Closing remarks cannot exceed 2000 characters'],
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

appointmentClosureSchema.index({ appointment: 1 }, { unique: true });
appointmentClosureSchema.index({ completedAt: -1 });

module.exports = mongoose.model('AppointmentClosure', appointmentClosureSchema);
