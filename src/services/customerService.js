const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const { customerId: newCustomerId } = require('../utils/ids');

const normaliseEmail = (email) => (email ? String(email).toLowerCase() : undefined);

/**
 * Locate existing customers by phone/email. Used to avoid duplicate records.
 */
async function findMatches({ phone, email }) {
  const or = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email: normaliseEmail(email) });
  if (!or.length) return [];
  return Customer.find({ $or: or }).limit(10);
}

/**
 * Reuse a reliable existing match unless the caller explicitly resolves it.
 * @param {Object} params
 * @param {boolean} params.allowCreate - whether to create when nothing matches
 * @param {boolean} params.strictAmbiguity - throw when multiple matches exist
 */
async function findOrCreateCustomer(
  { name, phone, email, address },
  { allowCreate = true, strictAmbiguity = false, createdBy } = {}
) {
  const matches = await findMatches({ phone, email });

  if (matches.length === 1) return { customer: matches[0], created: false };
  if (matches.length > 1) {
    if (strictAmbiguity) {
      throw ApiError.conflict('Multiple matching customers found. Please resolve manually.', {
        matches: matches.map((c) => ({ id: c._id, name: c.name, phone: c.phone })),
      });
    }
    return { customer: matches[0], created: false, ambiguous: true, matches };
  }

  if (!allowCreate) return { customer: null, created: false };

  const customer = await Customer.create({
    customerId: newCustomerId(),
    name,
    phone,
    email: normaliseEmail(email),
    address: address || undefined,
    createdBy,
  });
  return { customer, created: true };
}

module.exports = { findMatches, findOrCreateCustomer, normaliseEmail };
