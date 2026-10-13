const config = require('../config/env');

/**
 * Build a consistent pagination envelope.
 */
function buildPagination({ page, limit, total }) {
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(
    Math.max(1, parseInt(limit, 10) || config.pagination.defaultLimit),
    config.pagination.maxLimit
  );
  return {
    page: currentPage,
    limit: perPage,
    total,
    pages: Math.ceil(total / perPage) || 1,
    hasNext: currentPage * perPage < total,
    hasPrev: currentPage > 1,
  };
}

/**
 * Parse page/limit/sort from a request query with safe bounds.
 */
function parsePagination(query, defaultSort = { createdAt: -1 }) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    Math.max(1, parseInt(query.limit, 10) || config.pagination.defaultLimit),
    config.pagination.maxLimit
  );
  let sort = defaultSort;
  if (query.sort) {
    const order = String(query.sort).startsWith('-') ? -1 : 1;
    const field = String(query.sort).replace(/^-/, '');
    if (/^[a-zA-Z0-9_.]+$/.test(field)) sort = { [field]: order };
  }
  return { page, limit, skip: (page - 1) * limit, sort };
}

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function sendList(res, items, { page, limit, total }) {
  return res.status(200).json({
    success: true,
    count: items.length,
    pagination: buildPagination({ page, limit, total }),
    data: items,
  });
}

module.exports = { sendSuccess, sendList, parsePagination, buildPagination };
