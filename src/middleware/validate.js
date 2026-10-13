const ApiError = require('../utils/ApiError');

/**
 * Lightweight, dependency-free request validation.
 *
 * Each field rule is a function that receives the value and returns either
 * `undefined` (valid) or an error message string.
 */
const rules = {
  required: (label = 'Field') => (v) =>
    v === undefined || v === null || v === '' ? `${label} is required` : undefined,
  string: (label = 'Field') => (v) =>
    v === undefined || v === null || typeof v === 'string' ? undefined : `${label} must be a string`,
  number: (label = 'Field') => (v) =>
    v === undefined || v === '' || (typeof v === 'number' && !Number.isNaN(v)) || (!Number.isNaN(Number(v)))
      ? undefined
      : `${label} must be a number`,
  positive: (label = 'Field') => (v) =>
    v === undefined || Number(v) >= 0 ? undefined : `${label} must be zero or greater`,
  email: (label = 'Email') => (v) =>
    v === undefined || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v))
      ? undefined
      : `${label} is invalid`,
  phone: (label = 'Phone') => (v) =>
    v === undefined || v === '' || /^[\d\s\-+()]{7,20}$/.test(String(v))
      ? undefined
      : `${label} is invalid`,
  enum: (values, label = 'Field') => (v) =>
    v === undefined || values.includes(v) ? undefined : `${label} must be one of: ${values.join(', ')}`,
  minLength: (min, label = 'Field') => (v) =>
    v === undefined || String(v).length >= min ? undefined : `${label} must be at least ${min} characters`,
  maxLength: (max, label = 'Field') => (v) =>
    v === undefined || String(v).length <= max ? undefined : `${label} must be at most ${max} characters`,
  objectId: (label = 'Field') => (v) =>
    v === undefined || /^[a-fA-F0-9]{24}$/.test(String(v)) ? undefined : `${label} is not a valid id`,
  array: (label = 'Field') => (v) =>
    v === undefined || Array.isArray(v) ? undefined : `${label} must be an array`,
};

/**
 * @param {Object} schema - { fieldName: [ruleFn, ruleFn] }
 * @param {'body'|'query'|'params'} source
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = [];

    Object.entries(schema).forEach(([field, fieldRules]) => {
      const list = Array.isArray(fieldRules) ? fieldRules : [fieldRules];
      for (const rule of list) {
        const message = rule(data[field]);
        if (message) {
          errors.push({ field, message });
          break;
        }
      }
    });

    if (errors.length) {
      return next(ApiError.unprocessable('Validation failed', errors));
    }
    next();
  };
}

module.exports = { validate, rules };
