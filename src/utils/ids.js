const crypto = require('crypto');
const Counter = require('../models/Counter');

/**
 * Short, sortable, collision-resistant suffix used for business identifiers.
 */
function uniqueSuffix() {
  const now = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${now}${rand}`;
}

/** e.g. CUST-M8F3K2A1B4 */
const customerId = () => `CUST-${uniqueSuffix()}`;
const employeeId = () => `EMP-${uniqueSuffix()}`;
const bookingId = () => `BK-${uniqueSuffix()}`;
const appointmentId = () => `APT-${uniqueSuffix()}`;
const enquiryId = () => `ENQ-${uniqueSuffix()}`;
const receiptId = () => `RCPT-${uniqueSuffix()}`;

/**
 * Sequential, human-friendly document number: PREFIX-YYYY-0001.
 * Uses an atomic counter so concurrent requests never collide.
 */
async function nextDocumentNumber(prefix, { year = new Date().getFullYear(), pad = 4 } = {}) {
  const key = `${prefix}-${year}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(pad, '0')}`;
}

module.exports = {
  uniqueSuffix,
  customerId,
  employeeId,
  bookingId,
  appointmentId,
  enquiryId,
  receiptId,
  nextDocumentNumber,
};
