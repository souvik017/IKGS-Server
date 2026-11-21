const crypto = require('crypto');
const ApiError = require('./ApiError');

function key() {
  const value = process.env.PII_ENCRYPTION_KEY;
  if (!value) throw new Error('PII_ENCRYPTION_KEY must be configured to store Aadhaar numbers');
  return crypto.createHash('sha256').update(value).digest();
}

function encryptAadhaar(value) {
  const digits = String(value || '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(digits)) throw ApiError.badRequest('Aadhaar number must contain exactly 12 digits');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

function aadhaarLast4(value) {
  if (!value) return '';
  try {
    const [iv, tag, data] = value.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString().slice(-4);
  } catch { return ''; }
}

module.exports = { encryptAadhaar, aadhaarLast4 };
