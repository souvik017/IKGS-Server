const { calculateTotals } = require('../utils/money');
const { getSettings } = require('./settingsService');
const ApiError = require('../utils/ApiError');

/**
 * Normalise and validate incoming line items, then calculate all totals
 * server-side. Browser-supplied totals are always ignored.
 */
function normaliseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('At least one line item is required');
  }

  return items.map((line, index) => {
    if (!line || !line.item) {
      throw ApiError.badRequest(`Line item ${index + 1} is missing a name`);
    }
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    if (Number.isNaN(quantity) || quantity <= 0) {
      throw ApiError.badRequest(`Line item ${index + 1} has an invalid quantity`);
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw ApiError.badRequest(`Line item ${index + 1} has an invalid unit price`);
    }
    return {
      item: String(line.item).trim(),
      description: line.description ? String(line.description).trim() : undefined,
      quantity,
      unitPrice,
      discount: line.discount ? Number(line.discount) : 0,
      taxRate: line.taxRate ? Number(line.taxRate) : 0,
    };
  });
}

/**
 * Calculate document totals for a quotation or invoice.
 * Tax is applied only when settings.tax.enabled is true and a rate is provided.
 */
async function buildFinancials(payload, { forceTaxDisabled = false } = {}) {
  const settings = await getSettings();
  const items = normaliseItems(payload.items);

  const taxEnabled = !forceTaxDisabled && Boolean(settings.tax?.enabled);
  const requestedRate = payload.taxRate !== undefined ? Number(payload.taxRate) : settings.tax?.rate || 0;

  const totals = calculateTotals(items, {
    documentDiscount: payload.discount ? Number(payload.discount) : 0,
    taxRate: requestedRate,
    taxEnabled,
  });

  return { items: totals.items, totals, taxEnabled };
}

module.exports = { buildFinancials, normaliseItems };
