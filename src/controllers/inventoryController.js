const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { applyMovement, lowStockItems } = require('../services/inventoryService');

// @desc    List inventory items
// @route   GET /api/inventory/items
// @access  Private
exports.listItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { itemName: 1 });
  const query = {};
  if (req.query.category) query.category = req.query.category;
  if (req.query.active !== undefined && req.query.active !== 'all') {
    query.active = req.query.active === 'true';
  }
  if (req.query.lowStock === 'true') {
    query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
  }
  Object.assign(query, buildSearch(req.query.search, ['itemName', 'category', 'supplier', 'sku']));

  const [items, total] = await Promise.all([
    InventoryItem.find(query).sort({ itemName: 1 }).skip(skip).limit(limit),
    InventoryItem.countDocuments(query),
  ]);
  return sendList(res, items, { page, limit, total });
});

// @desc    Get an inventory item
// @route   GET /api/inventory/items/:id
// @access  Private
exports.getItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Inventory item not found');
  const transactions = await InventoryTransaction.find({ item: item._id })
    .sort({ createdAt: -1 })
    .limit(20);
  return sendSuccess(res, { item, transactions });
});

// @desc    Create an inventory item
// @route   POST /api/inventory/items
// @access  Private
exports.createItem = asyncHandler(async (req, res) => {
  const { itemName } = req.body;
  if (!itemName) throw ApiError.badRequest('Item name is required');

  const item = await InventoryItem.create({
    itemName,
    sku: req.body.sku,
    category: req.body.category,
    quantity: req.body.quantity || 0,
    unit: req.body.unit,
    purchasePrice: req.body.purchasePrice,
    supplier: req.body.supplier,
    lowStockThreshold: req.body.lowStockThreshold,
    active: req.body.active,
  });
  return sendSuccess(res, { item }, 201);
});

// @desc    Update an inventory item (metadata only; quantity changes go through movements)
// @route   PUT /api/inventory/items/:id
// @access  Private
exports.updateItem = asyncHandler(async (req, res) => {
  const allowed = ['itemName', 'sku', 'category', 'unit', 'purchasePrice', 'supplier', 'lowStockThreshold', 'active'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const item = await InventoryItem.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!item) throw ApiError.notFound('Inventory item not found');
  return sendSuccess(res, { item });
});

// @desc    Record a stock movement (stock-in, stock-out, adjustment)
// @route   POST /api/inventory/movements
// @access  Private
exports.createMovement = asyncHandler(async (req, res) => {
  const { item, type, quantity, reference, notes } = req.body;
  if (!item || !type || quantity === undefined) {
    throw ApiError.badRequest('item, type and quantity are required');
  }
  const result = await applyMovement({
    itemId: item,
    type,
    quantity,
    reference,
    notes,
    performedBy: req.admin?._id,
  });
  return sendSuccess(res, result, 201);
});

// @desc    List stock movements
// @route   GET /api/inventory/movements
// @access  Private
exports.listMovements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.item) query.item = req.query.item;
  if (req.query.type) query.type = req.query.type;

  const [movements, total] = await Promise.all([
    InventoryTransaction.find(query).populate('item', 'itemName unit').sort({ createdAt: -1 }).skip(skip).limit(limit),
    InventoryTransaction.countDocuments(query),
  ]);
  return sendList(res, movements, { page, limit, total });
});

// @desc    Low-stock items
// @route   GET /api/inventory/low-stock
// @access  Private
exports.getLowStock = asyncHandler(async (req, res) => {
  const items = await lowStockItems();
  return sendSuccess(res, { items });
});

// @desc    Basic inventory usage report (stock-out totals per item)
// @route   GET /api/inventory/report
// @access  Private
exports.getReport = asyncHandler(async (req, res) => {
  const match = { type: 'stock-out' };
  if (req.query.from || req.query.to) {
    match.createdAt = {};
    if (req.query.from) match.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) match.createdAt.$lte = new Date(req.query.to);
  }

  const usage = await InventoryTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$item',
        totalOut: { $sum: '$quantity' },
        movements: { $sum: 1 },
      },
    },
    { $sort: { totalOut: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: '_id',
        foreignField: '_id',
        as: 'item',
      },
    },
    { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        itemId: '$_id',
        itemName: '$item.itemName',
        unit: '$item.unit',
        currentQuantity: '$item.quantity',
        totalOut: 1,
        movements: 1,
      },
    },
  ]);

  return sendSuccess(res, { usage });
});

// @desc    Delete an inventory item
// @route   DELETE /api/inventory/items/:id
// @access  Private
exports.removeItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findByIdAndDelete(req.params.id);
  if (!item) throw ApiError.notFound('Inventory item not found');
  return sendSuccess(res, { message: 'Inventory item deleted' });
});
