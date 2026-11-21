const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { uploadImage } = require('../services/storageService');
const { removeLegacyServicePrices } = require('../services/serviceCatalogService');

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
  await removeLegacyServicePrices();
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
  await removeLegacyServicePrices();
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

  await Service.collection.updateOne({ _id: service._id }, { $unset: { startingPrice: 1 } });
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

exports.bulk = asyncHandler(async (req, res) => {
  await removeLegacyServicePrices();
  const rows = req.body.services;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw ApiError.badRequest('Provide between 1 and 100 services in the services array');
  const normalized = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !String(row.title || '').trim()) throw ApiError.badRequest(`Service at index ${index} needs a title`);
    const title = String(row.title).trim();
    const slug = slugify(row.slug || title);
    if (!slug) throw ApiError.badRequest(`Service at index ${index} has an invalid slug`);
    return { title, slug, shortDescription: row.shortDescription || '', description: row.description || '', image: row.image || '', icon: row.icon || '', active: toBool(row.active, true), featured: toBool(row.featured, false), displayOrder: toNumber(row.displayOrder, 0), seoTitle: row.seoTitle || title, seoDescription: row.seoDescription || row.shortDescription || '' };
  });
  const slugs = normalized.map((s) => s.slug);
  if (new Set(slugs).size !== slugs.length) throw ApiError.conflict('The JSON contains duplicate service slugs');
  const conflicts = await Service.find({ slug: { $in: slugs } }).select('slug').lean();
  if (conflicts.length) throw ApiError.conflict(`These service slugs already exist: ${conflicts.map((s) => s.slug).join(', ')}`);
  const services = await Service.insertMany(normalized, { ordered: true });
  return sendSuccess(res, { imported: services.length, services }, 201);
});

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');
  return sendSuccess(res, { message: 'Service deleted' });
});
