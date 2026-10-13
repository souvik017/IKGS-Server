const GalleryImage = require('../models/GalleryImage');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { uploadImage } = require('../services/storageService');

/**
 * Resolve the image source for a request: an uploaded file takes precedence,
 * otherwise an image URL supplied in the body.
 */
async function resolveImage(req) {
  if (req.file) {
    return uploadImage(req.file, { folder: 'gallery' });
  }
  const url = req.body.image;
  if (!url || !String(url).trim()) {
    throw ApiError.badRequest('Please upload an image or provide an image URL');
  }
  return String(url).trim();
}

// @desc    List gallery images (admin)
// @route   GET /api/gallery
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { displayOrder: 1, createdAt: -1 });
  const query = {};
  if (req.query.published !== undefined && req.query.published !== 'all') {
    query.published = req.query.published === 'true';
  }
  if (req.query.category) query.category = req.query.category;
  Object.assign(query, buildSearch(req.query.search, ['title', 'alt', 'category', 'caption']));

  const [images, total] = await Promise.all([
    GalleryImage.find(query).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
    GalleryImage.countDocuments(query),
  ]);
  return sendList(res, images, { page, limit, total });
});

// @desc    Get a gallery image
// @route   GET /api/gallery/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const image = await GalleryImage.findById(req.params.id);
  if (!image) throw ApiError.notFound('Gallery image not found');
  return sendSuccess(res, { image });
});

// @desc    List distinct categories (used by gallery filters)
// @route   GET /api/gallery/categories
// @access  Private
exports.listCategories = asyncHandler(async (req, res) => {
  const categories = await GalleryImage.distinct('category');
  return sendSuccess(res, { categories: categories.filter(Boolean).sort() });
});

// @desc    Create a gallery image
// @route   POST /api/gallery
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { title, alt, caption, category, displayOrder, published } = req.body;
  if (!title) throw ApiError.badRequest('Image title is required');
  if (!alt) throw ApiError.badRequest('Alt text is required');

  const image = await GalleryImage.create({
    title,
    alt,
    caption,
    image: await resolveImage(req),
    category: category || 'General',
    displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
    published: published === undefined ? true : published === 'true' || published === true,
    createdBy: req.admin?._id,
  });
  return sendSuccess(res, { image }, 201);
});

// @desc    Update a gallery image
// @route   PUT /api/gallery/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const record = await GalleryImage.findById(req.params.id);
  if (!record) throw ApiError.notFound('Gallery image not found');

  const allowed = ['title', 'alt', 'caption', 'category', 'displayOrder'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) record[field] = req.body[field];
  });
  if (req.body.displayOrder !== undefined) record.displayOrder = Number(req.body.displayOrder);
  if (req.body.published !== undefined) {
    record.published = req.body.published === 'true' || req.body.published === true;
  }
  if (req.file || req.body.image) {
    record.image = await resolveImage(req);
  }

  await record.save();
  return sendSuccess(res, { image: record });
});

// @desc    Reorder gallery images
// @route   PUT /api/gallery/reorder
// @access  Private
exports.reorder = asyncHandler(async (req, res) => {
  const { order } = req.body; // [{ id, displayOrder }]
  if (!Array.isArray(order) || order.length === 0) {
    throw ApiError.badRequest('An order array is required');
  }

  await Promise.all(
    order.map(({ id, displayOrder }) =>
      GalleryImage.findByIdAndUpdate(id, { displayOrder: Number(displayOrder) }, { runValidators: false })
    )
  );
  return sendSuccess(res, { message: 'Gallery order updated' });
});

// @desc    Delete a gallery image
// @route   DELETE /api/gallery/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const image = await GalleryImage.findByIdAndDelete(req.params.id);
  if (!image) throw ApiError.notFound('Gallery image not found');
  return sendSuccess(res, { message: 'Gallery image deleted' });
});
