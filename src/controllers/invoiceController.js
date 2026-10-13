const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { buildFinancials } = require('../services/calculationService');
const { nextInvoiceNumber } = require('../services/numberingService');
const { getSettings } = require('../services/settingsService');
const { generateInvoicePdf } = require('../services/pdfService');

// @desc    List invoices
// @route   GET /api/invoices
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
  if (req.query.customer) query.customer = req.query.customer;
  if (req.query.invoiceType) query.invoiceType = req.query.invoiceType;
  Object.assign(query, buildSearch(req.query.search, ['invoiceNumber', 'billingPeriod']));

  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate('customer', 'name phone email')
      .populate('appointment', 'appointmentId date')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(query),
  ]);
  return sendList(res, invoices, { page, limit, total });
});

// @desc    Get an invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('appointment', 'appointmentId date time address');
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return sendSuccess(res, { invoice });
});

/**
 * Build line items for an appointment-based invoice when none are supplied.
 */
async function itemsFromAppointment(appointment) {
  const populated = await appointment.populate('service', 'title startingPrice');
  const service = populated.service;
  return [
    {
      item: service?.title || `Service charge (${appointment.appointmentId})`,
      description: appointment.jobNotes || undefined,
      quantity: 1,
      unitPrice: service?.startingPrice || 0,
    },
  ];
}

/**
 * Shared invoice creation.
 * @param {'appointment'|'general'} mode
 */
async function createInvoice(req, mode) {
  const { customer, items, appointment, billingPeriod, discount, taxRate, dueDate, notes, terms } = req.body;

  let resolvedCustomer = customer;
  let appointmentDoc = null;

  if (mode === 'appointment') {
    if (!appointment) throw ApiError.badRequest('An appointment is required for an appointment invoice');
    appointmentDoc = await Appointment.findById(appointment);
    if (!appointmentDoc) throw ApiError.badRequest('Appointment not found');
    resolvedCustomer = resolvedCustomer || appointmentDoc.customer;
  }

  if (!resolvedCustomer) throw ApiError.badRequest('Customer is required');
  const customerDoc = await Customer.findById(resolvedCustomer);
  if (!customerDoc) throw ApiError.badRequest('Customer not found');

  const rawItems =
    items && items.length
      ? items
      : appointmentDoc
      ? await itemsFromAppointment(appointmentDoc)
      : [];

  const { items: pricedItems, totals } = await buildFinancials({ items: rawItems, discount, taxRate });

  const invoice = await Invoice.create({
    invoiceNumber: await nextInvoiceNumber(),
    customer: resolvedCustomer,
    appointment: appointmentDoc ? appointmentDoc._id : undefined,
    invoiceType: mode,
    billingPeriod: mode === 'general' ? billingPeriod : undefined,
    items: pricedItems,
    subtotal: totals.subtotal,
    lineDiscountTotal: totals.lineDiscountTotal,
    discount: totals.discount,
    taxRate: totals.taxRate,
    tax: totals.tax,
    total: totals.total,
    amountPaid: 0,
    balanceDue: totals.total,
    paymentStatus: 'unpaid',
    dueDate: dueDate ? new Date(dueDate) : undefined,
    notes,
    terms,
    createdBy: req.admin?._id,
  });

  return invoice;
}

// @desc    Create an appointment-based invoice
// @route   POST /api/invoices/appointment
// @access  Private
exports.createFromAppointment = asyncHandler(async (req, res) => {
  const invoice = await createInvoice(req, 'appointment');
  return sendSuccess(res, { invoice }, 201);
});

// @desc    Create a general/monthly invoice
// @route   POST /api/invoices
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const invoice = await createInvoice(req, req.body.appointment ? 'appointment' : 'general');
  return sendSuccess(res, { invoice }, 201);
});

// @desc    Update an invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  if (req.body.items) {
    const { items, totals } = await buildFinancials({
      items: req.body.items,
      discount: req.body.discount !== undefined ? req.body.discount : invoice.discount,
      taxRate: req.body.taxRate !== undefined ? req.body.taxRate : invoice.taxRate,
    });
    invoice.items = items;
    invoice.subtotal = totals.subtotal;
    invoice.lineDiscountTotal = totals.lineDiscountTotal;
    invoice.discount = totals.discount;
    invoice.taxRate = totals.taxRate;
    invoice.tax = totals.tax;
    invoice.total = totals.total;
    invoice.applyPayment(invoice.amountPaid);
  }

  ['billingPeriod', 'notes', 'terms', 'paymentMethod'].forEach((field) => {
    if (req.body[field] !== undefined) invoice[field] = req.body[field];
  });
  if (req.body.dueDate) invoice.dueDate = new Date(req.body.dueDate);

  await invoice.save();
  return sendSuccess(res, { invoice });
});

// @desc    Record a payment / update payment status
// @route   PUT /api/invoices/:id/payment
// @access  Private
exports.updatePayment = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const { amountPaid, paymentMethod } = req.body;
  if (amountPaid === undefined && !paymentMethod) {
    throw ApiError.badRequest('Provide amountPaid and/or paymentMethod');
  }

  if (amountPaid !== undefined) invoice.amountPaid = Number(amountPaid);
  if (paymentMethod) invoice.paymentMethod = paymentMethod;

  invoice.applyPayment(invoice.amountPaid);
  await invoice.save();
  return sendSuccess(res, { invoice });
});

// @desc    Download an invoice as PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private
exports.downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('appointment', 'appointmentId');
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const settings = await getSettings();
  const buffer = await generateInvoicePdf(invoice, { settings });

  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.invoiceNumber}.pdf"`);
  return res.send(buffer);
});

// @desc    Delete an invoice
// @route   DELETE /api/invoices/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByIdAndDelete(req.params.id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return sendSuccess(res, { message: 'Invoice deleted' });
});
