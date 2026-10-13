const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const Appointment = require('../models/Appointment');
const Employee = require('../models/Employee');
const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { bookingId: newBookingId, appointmentId: newAppointmentId } = require('../utils/ids');
const { findOrCreateCustomer } = require('../services/customerService');

const STATUSES = ['new', 'pending', 'confirmed', 'completed', 'cancelled'];

// @desc    List bookings
// @route   GET /api/bookings
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.from || req.query.to) {
    query.preferredDate = {};
    if (req.query.from) query.preferredDate.$gte = new Date(req.query.from);
    if (req.query.to) query.preferredDate.$lte = new Date(req.query.to);
  }
  Object.assign(query, buildSearch(req.query.search, ['name', 'phone', 'email', 'bookingId']));

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('service', 'title slug')
      .populate('customer', 'name phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(query),
  ]);
  return sendList(res, bookings, { page, limit, total });
});

// @desc    Get a booking
// @route   GET /api/bookings/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('service', 'title slug')
    .populate('customer', 'name phone email address');
  if (!booking) throw ApiError.notFound('Booking not found');
  const appointment = await Appointment.findOne({ booking: booking._id });
  return sendSuccess(res, { booking, appointment });
});

/**
 * Core booking creation shared by the authenticated and public endpoints.
 */
async function createBooking(payload, { source = 'admin', adminId } = {}) {
  const { name, phone, email, address, service, preferredDate, preferredTime, message } = payload;
  if (!name || !phone) throw ApiError.badRequest('Name and phone are required');

  if (service) {
    const exists = await Service.findById(service);
    if (!exists) throw ApiError.badRequest('Selected service does not exist');
  }

  const { customer } = await findOrCreateCustomer(
    { name, phone, email, address: address ? { street: address } : undefined },
    { allowCreate: true, createdBy: adminId }
  );

  const booking = await Booking.create({
    bookingId: newBookingId(),
    name,
    phone,
    email: email ? String(email).toLowerCase() : undefined,
    address,
    service: service || undefined,
    preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    preferredTime,
    message,
    customer: customer._id,
    source,
    status: 'new',
  });

  return { booking, customer };
}

// @desc    Create a booking
// @route   POST /api/bookings
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { booking } = await createBooking(req.body, { source: 'admin', adminId: req.admin?._id });
  return sendSuccess(res, { booking }, 201);
});

// @desc    Update a booking
// @route   PUT /api/bookings/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'email', 'address', 'service', 'preferredDate', 'preferredTime', 'message', 'adminNotes'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.preferredDate) updates.preferredDate = new Date(updates.preferredDate);

  const booking = await Booking.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  })
    .populate('service', 'title slug')
    .populate('customer', 'name phone email');
  if (!booking) throw ApiError.notFound('Booking not found');
  return sendSuccess(res, { booking });
});

// @desc    Update booking status
// @route   PUT /api/bookings/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw ApiError.badRequest(`Invalid status. Allowed: ${STATUSES.join(', ')}`);

  const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!booking) throw ApiError.notFound('Booking not found');
  return sendSuccess(res, { booking });
});

// @desc    Convert a booking into a linked appointment
// @route   POST /api/bookings/:id/convert
// @access  Private
exports.convertToAppointment = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  const existing = await Appointment.findOne({ booking: booking._id });
  if (existing) throw ApiError.conflict('This booking already has an appointment', { appointmentId: existing.appointmentId });

  const { date, time, employee, jobNotes } = req.body;
  if (!date) throw ApiError.badRequest('Appointment date is required');

  if (employee) {
    const emp = await Employee.findById(employee);
    if (!emp) throw ApiError.badRequest('Selected employee does not exist');
    if (!emp.active) throw ApiError.badRequest('Selected employee is inactive');
  }

  const appointment = await Appointment.create({
    appointmentId: newAppointmentId(),
    customer: booking.customer,
    booking: booking._id,
    service: booking.service,
    date: new Date(date),
    time: time || booking.preferredTime,
    address: booking.address,
    employee: employee || undefined,
    jobNotes,
    status: employee ? 'assigned' : 'scheduled',
    createdBy: req.admin?._id,
  });

  booking.status = 'confirmed';
  await booking.save();

  // Keep any originating enquiry in sync.
  if (booking.enquiry) {
    await Enquiry.findByIdAndUpdate(booking.enquiry, {
      status: 'converted',
      linkedAppointment: appointment._id,
    });
  }

  return sendSuccess(res, { appointment, booking }, 201);
});

// @desc    Delete a booking
// @route   DELETE /api/bookings/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  return sendSuccess(res, { message: 'Booking deleted' });
});

exports.createBooking = createBooking;
