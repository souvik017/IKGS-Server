/**
 * Escape user input used inside a case-insensitive regex search.
 */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build an $or regex search across the given fields.
 */
function buildSearch(search, fields) {
  if (!search || !fields.length) return {};
  const term = escapeRegex(search);
  return { $or: fields.map((field) => ({ [field]: { $regex: term, $options: 'i' } })) };
}

/**
 * Merge filter clauses into a single query object.
 */
function buildQuery(clauses = []) {
  const query = {};
  clauses.forEach((clause) => {
    Object.assign(query, clause);
  });
  return query;
}

module.exports = { escapeRegex, buildSearch, buildQuery };
