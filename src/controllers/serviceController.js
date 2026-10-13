const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { uploadImage } = require('../services/storageService');

const slugify = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * Requests may arrive as JSON or as multipart/form-data (when an image file is
 * attached). Multipart sends every value as a string, so booleans and numbers
 * have to be normalised or `active: "false"` would be read as truthy.
 */
const toBool = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Resolve the service image for this request. An uploaded file wins, otherwise
 * an image path/URL supplied in the body is used. Returns `undefined` when the
 * request does not touch the image at all, so an update can leave it alone.
 */
async function resolveImage(req) {
  const file = req.files?.[0] || req.file;
  if (file) return uploadImage(file, { folder: 'services' });
  if (req.body.image !== undefined) return String(req.body.image).trim();
  return undefined;
}

// @desc    List services
// @route   GET /api/services
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { displayOrder: 1, createdAt: -1 });
  const query = {};
  if (req.query.active !== undefined && req.query.active !== 'all') {
    query.active = req.query.active === 'true';
  }
  Object.assign(query, buildSearch(req.query.search, ['title', 'slug', 'shortDescription']));

  const [services, total] = await Promise.all([
    Service.find(query).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
    Service.countDocuments(query),
  ]);
  return sendList(res, services, { page, limit, total });
});

// @desc    Get a service
// @route   GET /api/services/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');
  return sendSuccess(res, { service });
});

// @desc    Create a service
// @route   POST /api/services
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) throw ApiError.badRequest('Service title is required');

  const slug = req.body.slug ? slugify(req.body.slug) : slugify(title);
  const exists = await Service.findOne({ slug });
  if (exists) throw ApiError.conflict('A service with this slug already exists');

  const image = await resolveImage(req);

  const service = await Service.create({
    title,
    slug,
    shortDescription: req.body.shortDescription,
    description: req.body.description,
    image: image ?? '',
    icon: req.body.icon,
    startingPrice: toNumber(req.body.startingPrice, 0),
    active: toBool(req.body.active, true),
    featured: toBool(req.body.featured, false),
    displayOrder: toNumber(req.body.displayOrder, 0),
    seoTitle: req.body.seoTitle || title,
    seoDescription: req.body.seoDescription || req.body.shortDescription,
    seoKeywords: req.body.seoKeywords,
  });
  return sendSuccess(res, { service }, 201);
});

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');

  const allowed = [
    'title',
    'shortDescription',
    'description',
    'icon',
    'seoTitle',
    'seoDescription',
    'seoKeywords',
  ];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) service[field] = req.body[field];
  });

  if (req.body.startingPrice !== undefined) {
    service.startingPrice = toNumber(req.body.startingPrice, 0);
  }
  if (req.body.displayOrder !== undefined) {
    service.displayOrder = toNumber(req.body.displayOrder, 0);
  }
  if (req.body.active !== undefined) service.active = toBool(req.body.active, service.active);
  if (req.body.featured !== undefined) service.featured = toBool(req.body.featured, service.featured);

  const image = await resolveImage(req);
  if (image !== undefined) service.image = image;

  // Keep the public URL stable. The slug only changes when the title changes
  // AND the new slug is free; otherwise existing /services/<slug> links, which
  // are indexed and shared, would break or collide with another service.
  if (req.body.title !== undefined && req.body.title !== service.title) {
    const nextSlug = slugify(req.body.title);
    if (nextSlug && nextSlug !== service.slug) {
      const clash = await Service.findOne({ slug: nextSlug, _id: { $ne: service._id } });
      if (!clash) service.slug = nextSlug;
    }
  }

  await service.save();
  return sendSuccess(res, { service });
});

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');
  return sendSuccess(res, { message: 'Service deleted' });
});
