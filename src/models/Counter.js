const mongoose = require('mongoose');

/**
 * Infrastructure model (not a business entity) used to generate sequential
 * document numbers atomically via findOneAndUpdate + $inc.
 */
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counter', counterSchema);
