const Service = require('../models/Service');
const Review = require('../models/Review');
const Enquiry = require('../models/Enquiry');
const GalleryImage = require('../models/GalleryImage');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { getSettings, toPublicSettings } = require('../services/settingsService');
const { createBooking } = require('./bookingController');
const { enquiryId: newEnquiryId } = require('../utils/ids');

// @desc    Public site settings
// @route   GET /api/public/settings
// @access  Public
exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return sendSuccess(res, { settings: toPublicSettings(settings) });
});

// @desc    Active services for the public catalogue
// @route   GET /api/public/services
// @access  Public
exports.listServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ active: true })
    .select('title slug shortDescription description image icon startingPrice featured displayOrder seoTitle seoDescription')
    .sort({ displayOrder: 1, title: 1 });
  return sendSuccess(res, { services });
});

// @desc    A single public service by slug
// @route   GET /api/public/services/:slug
// @access  Public
exports.getServiceBySlug = asyncHandler(async (req, res) => {
  const service = await Service.findOne({ slug: req.params.slug, active: true }).select(
    '-seoKeywords -__v'
  );
  if (!service) throw ApiError.notFound('Service not found');
  return sendSuccess(res, { service });
});

// @desc    Approved testimonials only
// @route   GET /api/public/testimonials
// @access  Public
exports.listTestimonials = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
  const reviews = await Review.find(Review.publicFilter())
    .select('rating comment customerName serviceName createdAt')
    .sort({ createdAt: -1 })
    .limit(limit);

  // Never leak the customer reference; fall back to a friendly display name.
  const data = reviews.map((r) => ({
    id: r._id,
    rating: r.rating,
    comment: r.comment,
    name: r.customerName || 'IKGS Customer',
    service: r.serviceName,
    createdAt: r.createdAt,
  }));
  return sendSuccess(res, { testimonials: data });
});

// @desc    Published gallery images
// @route   GET /api/public/gallery
// @access  Public
// @note    Only published images are exposed. Unpublished or draft uploads
//          are never visible publicly.
exports.listGallery = asyncHandler(async (req, res) => {
  const query = { ...GalleryImage.publicFilter() };
  if (req.query.category && req.query.category !== 'All') {
    query.category = req.query.category;
  }

  const images = await GalleryImage.find(query)
    .select('title alt caption image category displayOrder')
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(120);

  return sendSuccess(res, {
    images,
    categories: [...new Set(images.map((i) => i.category).filter(Boolean))],
  });
});

// @desc    Submit a public booking
// @route   POST /api/public/bookings
// @access  Public
exports.submitBooking = asyncHandler(async (req, res) => {
  const { booking } = await createBooking(req.body, { source: 'website' });
  return sendSuccess(
    res,
    {
      booking: {
        bookingId: booking.bookingId,
        name: booking.name,
        status: booking.status,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
      },
      message: `Booking ${booking.bookingId} received. Our team will contact you shortly.`,
    },
    201
  );
});

// @desc    Submit a public enquiry
// @route   POST /api/public/enquiries
// @access  Public
exports.submitEnquiry = asyncHandler(async (req, res) => {
  const { name, phone, email, details, service } = req.body;
  if (!name || !phone) throw ApiError.badRequest('Name and phone are required');

  const enquiry = await Enquiry.create({
    enquiryId: newEnquiryId(),
    name,
    phone,
    email: email ? String(email).toLowerCase() : undefined,
    details: details || req.body.message,
    service: service || undefined,
    source: 'website',
    status: 'new',
  });

  return sendSuccess(
    res,
    { reference: enquiry.enquiryId, message: 'Thank you. Our team will get in touch shortly.' },
    201
  );
});
