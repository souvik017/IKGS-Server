const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Admin email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        'Please enter a valid email',
      ],
    },
    passwordHash: {
      type: String,
      required: [true, 'Admin password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin'],
      default: 'admin',
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

adminSchema.index({ email: 1 });
adminSchema.index({ active: 1 });

// Hash password whenever it is set to a plaintext value.
adminSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

adminSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

adminSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Admin', adminSchema);
