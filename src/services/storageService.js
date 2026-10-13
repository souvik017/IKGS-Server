const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { cloudinary, cloudinaryEnabled } = require('../config/cloudinary');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Normalise and persist an uploaded image buffer.
 * @returns {Promise<string>} public URL/path of the stored image
 */
async function uploadImage(file, { folder = 'services' } = {}) {
  if (!file || !file.buffer) return null;

  // Re-encode to a sane size/format to strip metadata and bound upload size.
  const optimized = await sharp(file.buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  if (cloudinaryEnabled) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${config.cloudinary.folder}/${folder}`,
          resource_type: 'image',
          format: 'jpg',
        },
        (error, result) => {
          if (error) return reject(ApiError.badRequest(`Image upload failed: ${error.message}`));
          resolve(result.secure_url);
        }
      );
      stream.end(optimized);
    });
  }

  // Local disk fallback (development / self-hosted deployments).
  const dir = path.join(process.cwd(), config.upload.localDir, folder);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  await fs.writeFile(path.join(dir, filename), optimized);
  return `/uploads/${folder}/${filename}`;
}

async function uploadImages(files = [], options) {
  const results = [];
  for (const file of files) {
    // Sequential to avoid unbounded concurrent sharp work.
    // eslint-disable-next-line no-await-in-loop
    results.push(await uploadImage(file, options));
  }
  return results;
}

module.exports = { uploadImage, uploadImages, cloudinaryEnabled };
