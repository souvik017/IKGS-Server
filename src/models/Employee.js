const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
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
    designation: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    joiningDate: {
      type: Date,
    },
    active: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ email: 1 });
employeeSchema.index({ active: 1 });
employeeSchema.index({ name: 'text' });

module.exports = mongoose.model('Employee', employeeSchema);
