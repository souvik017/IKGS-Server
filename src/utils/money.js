/**
 * Money helpers.
 *
 * All financial arithmetic is performed on integer paise (1 rupee = 100 paise)
 * to avoid binary floating point drift, then converted back to rupees with
 * exactly two decimal places.
 */

const toPaise = (amount) => Math.round((Number(amount) || 0) * 100);
const toRupees = (paise) => Math.round(paise) / 100;

/**
 * Recalculate a single line item in paise.
 * lineTotal = (unitPrice * qty) - discount + tax
 */
function calculateLine(line) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = toPaise(line.unitPrice);
  const discount = toPaise(line.discount);
  const taxRate = Number(line.taxRate) || 0;

  const gross = unitPrice * quantity;
  const net = gross - discount;
  const tax = Math.round((net * taxRate) / 100);
  const lineTotal = net + tax;

  return {
    item: line.item,
    description: line.description,
    quantity,
    unitPrice: toRupees(unitPrice),
    discount: toRupees(discount),
    taxRate,
    tax: toRupees(tax),
    lineTotal: toRupees(lineTotal),
    _paise: { gross, net, tax, lineTotal },
  };
}

/**
 * Recalculate an entire document. `documentTaxRate` is applied on the
 * post-line-discount subtotal, and a document-level discount is applied before tax.
 * Tax is only included when enabled by configuration.
 */
function calculateTotals(items = [], { documentDiscount = 0, taxRate = 0, taxEnabled = false } = {}) {
  const lines = items.map((line) => calculateLine(line));

  let subtotalPaise = 0;
  let lineDiscountTotalPaise = 0;
  let lineTaxTotalPaise = 0;

  lines.forEach((line) => {
    subtotalPaise += line._paise.gross;
    lineDiscountTotalPaise += line._paise.net === line._paise.gross ? 0 : toPaise(line.discount);
    lineTaxTotalPaise += line._paise.tax;
  });

  const netSubtotalPaise = lines.reduce((sum, l) => sum + l._paise.net, 0);
  const discountPaise = toPaise(documentDiscount);
  const taxablePaise = Math.max(0, netSubtotalPaise - discountPaise);

  const documentTaxPaise = taxEnabled ? Math.round((taxablePaise * (Number(taxRate) || 0)) / 100) : 0;
  const totalTaxPaise = lineTaxTotalPaise + documentTaxPaise;
  const totalPaise = taxablePaise + totalTaxPaise;

  return {
    items: lines.map(({ _paise, ...rest }) => rest),
    subtotal: toRupees(subtotalPaise),
    lineDiscountTotal: toRupees(lineDiscountTotalPaise),
    discount: toRupees(discountPaise),
    taxRate: taxEnabled ? Number(taxRate) || 0 : 0,
    tax: toRupees(totalTaxPaise),
    total: toRupees(totalPaise),
  };
}

module.exports = { toPaise, toRupees, calculateLine, calculateTotals };
