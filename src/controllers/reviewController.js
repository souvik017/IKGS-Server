const Review = require('../models/Review');
const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');

const STATUSES = ['pending', 'approved', 'hidden'];

// @desc    List reviews
// @route   GET /api/reviews
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.appointment) query.appointment = req.query.appointment;

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('customer', 'name phone email')
      .populate('appointment', 'appointmentId date')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(query),
  ]);
  return sendList(res, reviews, { page, limit, total });
});

// @desc    Get a review
// @route   GET /api/reviews/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id).populate('customer', 'name phone email');
  if (!review) throw ApiError.notFound('Review not found');
  return sendSuccess(res, { review });
});

// @desc    Create a review manually
// @route   POST /api/reviews
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { customer, appointment, rating, comment, status } = req.body;
  if (!customer || !rating) throw ApiError.badRequest('Customer and rating are required');

  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) throw ApiError.badRequest('Customer not found');
  const numeric = Number(rating);
  if (Number.isNaN(numeric) || numeric < 1 || numeric > 5) {
    throw ApiError.badRequest('Rating must be between 1 and 5');
  }

  const review = await Review.create({
    customer,
    appointment,
    rating: numeric,
    comment,
    customerName: customerDoc.name,
    status: STATUSES.includes(status) ? status : 'pending',
  });
  return sendSuccess(res, { review }, 201);
});

// @desc    Moderate a review (approve / hide)
// @route   PUT /api/reviews/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw ApiError.badRequest(`Invalid status. Allowed: ${STATUSES.join(', ')}`);

  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');

  review.status = status;
  review.moderatedBy = req.admin?._id;
  review.moderatedAt = new Date();
  await review.save();
  return sendSuccess(res, { review });
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  return sendSuccess(res, { message: 'Review deleted' });
});
