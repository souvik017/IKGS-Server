const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { buildFinancials } = require('../services/calculationService');
const { nextQuotationNumber } = require('../services/numberingService');
const { getSettings } = require('../services/settingsService');
const { generateQuotationPdf } = require('../services/pdfService');

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

// @desc    List quotations
// @route   GET /api/quotations
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.customer) query.customer = req.query.customer;
  Object.assign(query, buildSearch(req.query.search, ['quotationNumber']));

  const [quotations, total] = await Promise.all([
    Quotation.find(query).populate('customer', 'name phone email').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quotation.countDocuments(query),
  ]);
  return sendList(res, quotations, { page, limit, total });
});

// @desc    Get a quotation
// @route   GET /api/quotations/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).populate('customer', 'name phone email address');
  if (!quotation) throw ApiError.notFound('Quotation not found');
  return sendSuccess(res, { quotation });
});

// @desc    Create a quotation
// @route   POST /api/quotations
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { customer, validUntil, terms, notes, status } = req.body;
  if (!customer) throw ApiError.badRequest('Customer is required');
  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) throw ApiError.badRequest('Customer not found');

  const settings = await getSettings();
  const { items, totals } = await buildFinancials(req.body);

  const validityDays = settings.defaultQuotationValidityDays || 30;
  const quotation = await Quotation.create({
    quotationNumber: await nextQuotationNumber(),
    customer,
    items,
    subtotal: totals.subtotal,
    lineDiscountTotal: totals.lineDiscountTotal,
    discount: totals.discount,
    taxRate: totals.taxRate,
    tax: totals.tax,
    total: totals.total,
    validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + validityDays * 86400000),
    terms: terms || settings.defaultTerms,
    notes,
    status: STATUSES.includes(status) ? status : 'draft',
    createdBy: req.admin?._id,
  });

  return sendSuccess(res, { quotation }, 201);
});

// @desc    Update a quotation (recalculates totals)
// @route   PUT /api/quotations/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound('Quotation not found');

  if (req.body.items) {
    const { items, totals } = await buildFinancials({
      items: req.body.items,
      discount: req.body.discount !== undefined ? req.body.discount : quotation.discount,
      taxRate: req.body.taxRate !== undefined ? req.body.taxRate : quotation.taxRate,
    });
    quotation.items = items;
    quotation.subtotal = totals.subtotal;
    quotation.lineDiscountTotal = totals.lineDiscountTotal;
    quotation.discount = totals.discount;
    quotation.taxRate = totals.taxRate;
    quotation.tax = totals.tax;
    quotation.total = totals.total;
  }

  ['validUntil', 'terms', 'notes', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) quotation[field] = req.body[field];
  });
  if (req.body.validUntil) quotation.validUntil = new Date(req.body.validUntil);

  await quotation.save();
  return sendSuccess(res, { quotation });
});

// @desc    Update quotation status
// @route   PUT /api/quotations/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw ApiError.badRequest(`Invalid status. Allowed: ${STATUSES.join(', ')}`);

  const quotation = await Quotation.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!quotation) throw ApiError.notFound('Quotation not found');
  return sendSuccess(res, { quotation });
});

// @desc    Download a quotation as PDF
// @route   GET /api/quotations/:id/pdf
// @access  Private
exports.downloadPdf = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).populate(
    'customer',
    'name phone email address'
  );
  if (!quotation) throw ApiError.notFound('Quotation not found');

  const settings = await getSettings();
  const buffer = await generateQuotationPdf(quotation, { settings });

  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${quotation.quotationNumber}.pdf"`
  );
  return res.send(buffer);
});

// @desc    Delete a quotation
// @route   DELETE /api/quotations/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findByIdAndDelete(req.params.id);
  if (!quotation) throw ApiError.notFound('Quotation not found');
  return sendSuccess(res, { message: 'Quotation deleted' });
});
