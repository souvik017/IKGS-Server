const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    clientName: { type: String, trim: true, maxlength: 120 },
    clientPhone: { type: String, trim: true },
    clientEmail: { type: String, trim: true, lowercase: true },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    time: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    jobNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Job notes cannot exceed 2000 characters'],
    },
    materials: [{
      item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
      itemName: { type: String, required: true, trim: true },
      quantity: { type: Number, required: true, min: 0 },
      unit: { type: String, trim: true },
      assignedAt: { type: Date, default: Date.now },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    }],
    status: {
      type: String,
      enum: [
        'scheduled',
        'confirmed',
        'assigned',
        'in-progress',
        'completion-requested',
        'completed',
        'cancelled',
        'rescheduled',
      ],
      default: 'scheduled',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ appointmentId: 1 }, { unique: true });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ date: 1 });
appointmentSchema.index({ employee: 1 });
appointmentSchema.index({ customer: 1 });

// Virtual link to the closure record (kept on the closure document).
appointmentSchema.virtual('closure', {
  ref: 'AppointmentClosure',
  localField: '_id',
  foreignField: 'appointment',
  justOne: true,
});

appointmentSchema.set('toObject', { virtuals: true });
appointmentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
