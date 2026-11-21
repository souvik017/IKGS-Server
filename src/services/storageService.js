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
  if (!cloudinaryEnabled) {
    throw new ApiError(503, 'Image uploads require Cloudinary. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
  }

  // Re-encode to a sane size/format to strip metadata and bound upload size.
  const optimized = await sharp(file.buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${config.cloudinary.folder}/${folder}`,
        resource_type: 'image',
        format: 'jpg',
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, `Cloudinary image upload failed: ${error.message}`));
        if (!result?.secure_url) return reject(new ApiError(502, 'Cloudinary did not return a secure image URL'));
        resolve(result.secure_url);
      }
    );
    stream.end(optimized);
  });
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
