const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

/**
 * Apply a stock movement and always record an InventoryTransaction.
 *
 * Atomicity strategy:
 *  - The quantity change is a single atomic `$inc` guarded by a `$gte` filter
 *    for stock-outs, so two concurrent requests can never produce negative stock.
 *  - When MongoDB transactions are available they are used to also make the
 *    transaction-record insertion part of the same unit of work. For standalone
 *    mongod deployments (no replica set) we fall back to the guarded update,
 *    which is still safe because the guard is evaluated atomically by MongoDB.
 */
async function applyMovement({ itemId, type, quantity, reference, notes, performedBy }) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw ApiError.badRequest('Quantity must be a positive number');
  }
  if (!['stock-in', 'stock-out', 'adjustment'].includes(type)) {
    throw ApiError.badRequest('Invalid transaction type');
  }

  const item = await InventoryItem.findById(itemId);
  if (!item) throw ApiError.notFound('Inventory item not found');

  const session = config.mongoTransactions ? await mongoose.startSession() : null;
  let updated;
  let change;

  try {
    if (session) session.startTransaction();

    const opts = session ? { new: true, session } : { new: true };

    if (type === 'stock-in') {
      change = qty;
      updated = await InventoryItem.findOneAndUpdate(
        { _id: itemId },
        { $inc: { quantity: qty } },
        opts
      );
    } else if (type === 'stock-out') {
      change = -qty;
      updated = await InventoryItem.findOneAndUpdate(
        { _id: itemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        opts
      );
      if (!updated) {
        throw ApiError.badRequest('Insufficient stock for this stock-out operation');
      }
    } else {
      // adjustment sets the absolute quantity
      change = qty - Number(item.quantity);
      updated = await InventoryItem.findOneAndUpdate(
        { _id: itemId },
        { $set: { quantity: qty } },
        opts
      );
    }

    const [transaction] = await InventoryTransaction.create(
      [
        {
          item: itemId,
          type,
          quantity: qty,
          change,
          balanceAfter: updated.quantity,
          reference: reference || '',
          notes: notes || '',
          performedBy,
        },
      ],
      session ? { session } : {}
    );

    if (session) await session.commitTransaction();
    return { item: updated, transaction };
  } catch (error) {
    if (session) await session.abortTransaction();
    throw error;
  } finally {
    if (session) session.endSession();
  }
}

/** Summary used for the dashboard low-stock card and reports. */
async function lowStockItems() {
  const items = await InventoryItem.find({ active: true });
  return items.filter((i) => Number(i.quantity) <= Number(i.lowStockThreshold));
}

module.exports = { applyMovement, lowStockItems };
