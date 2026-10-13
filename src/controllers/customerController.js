const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const Appointment = require('../models/Appointment');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const Enquiry = require('../models/Enquiry');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { customerId: newCustomerId } = require('../utils/ids');

// @desc    List customers
// @route   GET /api/customers
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  Object.assign(query, buildSearch(req.query.search, ['name', 'phone', 'email', 'customerId']));

  const [customers, total] = await Promise.all([
    Customer.find(query).sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(query),
  ]);
  return sendList(res, customers, { page, limit, total });
});

// @desc    Get a customer with all linked business records
// @route   GET /api/customers/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');

  const [enquiries, bookings, appointments, quotations, invoices] = await Promise.all([
    Enquiry.find({ customer: customer._id }).sort({ createdAt: -1 }),
    Booking.find({ customer: customer._id }).populate('service', 'title').sort({ createdAt: -1 }),
    Appointment.find({ customer: customer._id })
      .populate('service', 'title')
      .populate('employee', 'name employeeId')
      .sort({ date: -1 }),
    Quotation.find({ customer: customer._id }).sort({ createdAt: -1 }),
    Invoice.find({ customer: customer._id }).sort({ createdAt: -1 }),
  ]);

  return sendSuccess(res, {
    customer,
    records: { enquiries, bookings, appointments, quotations, invoices },
  });
});

// @desc    Create a customer
// @route   POST /api/customers
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { name, phone, email, address, notes, tags } = req.body;
  if (!name) throw ApiError.badRequest('Customer name is required');

  if (phone || email) {
    const duplicate = await Customer.findOne({
      $or: [...(phone ? [{ phone }] : []), ...(email ? [{ email: String(email).toLowerCase() }] : [])],
    });
    if (duplicate) throw ApiError.conflict('A customer with this phone or email already exists');
  }

  const customer = await Customer.create({
    customerId: newCustomerId(),
    name,
    phone,
    email: email ? String(email).toLowerCase() : undefined,
    address,
    notes,
    tags,
    createdBy: req.admin?._id,
  });
  return sendSuccess(res, { customer }, 201);
});

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'email', 'address', 'notes', 'tags', 'status'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.email) updates.email = String(updates.email).toLowerCase();

  const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!customer) throw ApiError.notFound('Customer not found');
  return sendSuccess(res, { customer });
});

// @desc    Soft-deactivate a customer
// @route   DELETE /api/customers/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { status: 'inactive' },
    { new: true }
  );
  if (!customer) throw ApiError.notFound('Customer not found');
  return sendSuccess(res, { message: 'Customer deactivated', customer });
});
