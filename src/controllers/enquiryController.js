const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { enquiryId: newEnquiryId, bookingId: newBookingId, customerId: newCustomerId } = require('../utils/ids');

const STATUSES = ['new', 'in-progress', 'follow-up', 'converted', 'closed'];

// @desc    List enquiries
// @route   GET /api/enquiries
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.source) query.source = req.query.source;
  Object.assign(query, buildSearch(req.query.search, ['name', 'phone', 'email', 'details', 'enquiryId']));

  const [enquiries, total] = await Promise.all([
    Enquiry.find(query)
      .populate('customer', 'name email phone')
      .populate('service', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Enquiry.countDocuments(query),
  ]);
  return sendList(res, enquiries, { page, limit, total });
});

// @desc    Get an enquiry
// @route   GET /api/enquiries/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('service', 'title')
    .populate('linkedBooking', 'bookingId status')
    .populate('linkedAppointment', 'appointmentId status date');
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  return sendSuccess(res, { enquiry });
});

// @desc    Create an enquiry (admin/phone/walk-in)
// @route   POST /api/enquiries
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { name, phone, email, details, source, service, status } = req.body;
  if (!name || !phone) throw ApiError.badRequest('Name and phone are required');

  const enquiry = await Enquiry.create({
    enquiryId: newEnquiryId(),
    name,
    phone,
    email: email ? String(email).toLowerCase() : undefined,
    details,
    source: source || 'phone',
    status: STATUSES.includes(status) ? status : 'new',
    service,
  });
  return sendSuccess(res, { enquiry }, 201);
});

// @desc    Update an enquiry
// @route   PUT /api/enquiries/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'email', 'details', 'source', 'service'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  return sendSuccess(res, { enquiry });
});

// @desc    Update enquiry status
// @route   PUT /api/enquiries/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!STATUSES.includes(status)) throw ApiError.badRequest(`Invalid status. Allowed: ${STATUSES.join(', ')}`);

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');

  enquiry.status = status;
  if (note) {
    enquiry.followUps.push({ note, status, createdBy: req.admin?._id });
  }
  await enquiry.save();
  return sendSuccess(res, { enquiry });
});

// @desc    Add a follow-up note
// @route   POST /api/enquiries/:id/follow-ups
// @access  Private
exports.addFollowUp = asyncHandler(async (req, res) => {
  const { note, status } = req.body;
  if (!note) throw ApiError.badRequest('A follow-up note is required');

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');

  enquiry.followUps.push({ note, status, createdBy: req.admin?._id });
  if (status && STATUSES.includes(status)) enquiry.status = status;
  await enquiry.save();
  return sendSuccess(res, { enquiry }, 201);
});

/**
 * Find a reliable existing customer match for an enquiry, so converting leads
 * never creates accidental duplicates. Returns null when nothing matches.
 */
async function findMatchingCustomer(enquiry) {
  const or = [];
  if (enquiry.phone) or.push({ phone: enquiry.phone });
  if (enquiry.email) or.push({ email: String(enquiry.email).toLowerCase() });
  if (!or.length) return null;
  const matches = await Customer.find({ $or: or }).limit(5);
  if (matches.length === 1) return matches[0];
  return null; // ambiguous or none
}

// @desc    Check for existing customer matches before converting
// @route   GET /api/enquiries/:id/matches
// @access  Private
exports.matchCustomers = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');

  const or = [];
  if (enquiry.phone) or.push({ phone: enquiry.phone });
  if (enquiry.email) or.push({ email: String(enquiry.email).toLowerCase() });
  const matches = or.length ? await Customer.find({ $or: or }).limit(10) : [];
  return sendSuccess(res, { matches });
});

// @desc    Convert an enquiry into a customer and optionally a booking
// @route   POST /api/enquiries/:id/convert
// @access  Private
exports.convert = asyncHandler(async (req, res) => {
  const { customerId, createBooking = true, booking = {} } = req.body;

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');

  // Resolve or create the customer, reusing existing records where possible.
  let customer;
  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer) throw ApiError.notFound('Selected customer not found');
  } else {
    const match = await findMatchingCustomer(enquiry);
    if (match) {
      customer = match;
    } else {
      const ambiguous = await Customer.find({
        $or: [...(enquiry.phone ? [{ phone: enquiry.phone }] : []), ...(enquiry.email ? [{ email: enquiry.email }] : [])],
      }).limit(2);
      if (ambiguous.length > 1) {
        throw ApiError.conflict('Multiple matching customers found. Pass customerId to resolve.', {
          matches: ambiguous.map((c) => ({ id: c._id, name: c.name, phone: c.phone })),
        });
      }
      customer = await Customer.create({
        customerId: newCustomerId(),
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email,
        address: booking.address ? { street: booking.address } : undefined,
        createdBy: req.admin?._id,
      });
    }
  }

  let linkedBooking;
  if (createBooking) {
    linkedBooking = await Booking.create({
      bookingId: newBookingId(),
      name: enquiry.name,
      phone: enquiry.phone,
      email: enquiry.email,
      address: booking.address,
      service: booking.service || enquiry.service,
      preferredDate: booking.preferredDate ? new Date(booking.preferredDate) : undefined,
      preferredTime: booking.preferredTime,
      message: booking.message || enquiry.details,
      customer: customer._id,
      enquiry: enquiry._id,
      source: 'admin',
      status: 'new',
    });
  }

  enquiry.status = 'converted';
  enquiry.customer = customer._id;
  if (linkedBooking) enquiry.linkedBooking = linkedBooking._id;
  enquiry.followUps.push({ note: 'Converted to customer', status: 'converted', createdBy: req.admin?._id });
  await enquiry.save();

  return sendSuccess(res, { enquiry, customer, booking: linkedBooking });
});

// @desc    Delete an enquiry
// @route   DELETE /api/enquiries/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  return sendSuccess(res, { message: 'Enquiry deleted' });
});
