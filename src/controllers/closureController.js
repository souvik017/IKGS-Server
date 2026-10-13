const Appointment = require('../models/Appointment');
const AppointmentClosure = require('../models/AppointmentClosure');
const Review = require('../models/Review');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { uploadImages } = require('../services/storageService');

// States from which an appointment may be closed.
const CLOSABLE_STATES = ['scheduled', 'confirmed', 'assigned', 'in-progress'];

// @desc    List closures
// @route   GET /api/closures
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { completedAt: -1 });
  const query = {};
  if (req.query.appointment) query.appointment = req.query.appointment;

  const [closures, total] = await Promise.all([
    AppointmentClosure.find(query)
      .populate('appointment', 'appointmentId date time status address')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit),
    AppointmentClosure.countDocuments(query),
  ]);
  return sendList(res, closures, { page, limit, total });
});

// @desc    Get a closure
// @route   GET /api/closures/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const closure = await AppointmentClosure.findById(req.params.id).populate(
    'appointment',
    'appointmentId date time status address'
  );
  if (!closure) throw ApiError.notFound('Closure not found');
  return sendSuccess(res, { closure });
});

// @desc    Create a closure
// @route   POST /api/closures
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { appointment: appointmentId, rating, comments, closingRemarks } = req.body;
  if (!appointmentId) throw ApiError.badRequest('Appointment reference is required');

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  // Duplicate detection takes precedence over state checks so that a repeat
  // submission reports the real reason instead of a misleading state error.
  const existing = await AppointmentClosure.findOne({ appointment: appointmentId });
  if (existing) {
    throw ApiError.conflict('A closure already exists for this appointment. Edit the existing closure instead.');
  }

  if (appointment.status === 'cancelled') {
    throw ApiError.badRequest('A cancelled appointment cannot be closed');
  }
  if (!CLOSABLE_STATES.includes(appointment.status)) {
    throw ApiError.badRequest(`Appointment in status "${appointment.status}" cannot be closed`);
  }

  const files = req.files || [];
  if (files.length > 2) throw ApiError.badRequest('A maximum of two service images is allowed');
  const images = files.length ? await uploadImages(files, { folder: 'closures' }) : [];

  if (rating !== undefined && rating !== null && rating !== '') {
    const numeric = Number(rating);
    if (Number.isNaN(numeric) || numeric < 1 || numeric > 5) {
      throw ApiError.badRequest('Rating must be between 1 and 5');
    }
  }

  const closure = await AppointmentClosure.create({
    appointment: appointmentId,
    images,
    rating: rating ? Number(rating) : undefined,
    comments,
    closingRemarks,
    completedAt: new Date(), // always recorded server-side
    closedBy: req.admin?._id,
  });

  appointment.status = 'completed';
  if (closingRemarks) appointment.jobNotes = closingRemarks;
  await appointment.save();

  // A closure rating becomes a pending review, never an automatic public testimonial.
  if (rating) {
    await Review.create({
      customer: appointment.customer,
      appointment: appointment._id,
      rating: Number(rating),
      comment: comments,
      status: 'pending',
    });
  }

  return sendSuccess(res, { closure, appointment }, 201);
});

// @desc    Update an existing closure (editing is allowed, duplicates are not)
// @route   PUT /api/closures/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const closure = await AppointmentClosure.findById(req.params.id);
  if (!closure) throw ApiError.notFound('Closure not found');

  const files = req.files || [];
  const existingImages = req.body.existingImages
    ? Array.isArray(req.body.existingImages)
      ? req.body.existingImages
      : [req.body.existingImages]
    : closure.images;

  const uploaded = files.length ? await uploadImages(files, { folder: 'closures' }) : [];
  const images = [...existingImages, ...uploaded];
  if (images.length > 2) throw ApiError.badRequest('A maximum of two service images is allowed');

  closure.images = images;
  if (req.body.rating !== undefined) closure.rating = req.body.rating ? Number(req.body.rating) : undefined;
  if (req.body.comments !== undefined) closure.comments = req.body.comments;
  if (req.body.closingRemarks !== undefined) closure.closingRemarks = req.body.closingRemarks;

  await closure.save();
  return sendSuccess(res, { closure });
});
